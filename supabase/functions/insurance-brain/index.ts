// Insurance Brain (保险佬) — paraplanner agent #1, analysis core.
// mode:'prospect'  → deterministic CNA for the n8n policy-review funnel engine.
// mode:'cfp'       → full deep-dive for an existing client: DB data → CNA →
//                    Gemini report draft → policy_review_requests → n8n notify.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeCna } from "./cna.ts";
import {
  annualPremiumTotal,
  buildCfpCnaInput,
  buildProspectCnaInput,
} from "./mapping.ts";
import { fetchClientFinancials } from "./db.ts";
import { generateReport, placeholderReport } from "./report.ts";
import { type AgentConfig, loadConfig } from "./config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const jsonOk = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}

/** Constant-time secret comparison via digest equality. */
async function secretMatches(
  candidate: string,
  expected: string,
): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const cfg = await loadConfig(serviceClient);

    // --- Auth: n8n agent secret OR advisor JWT ---
    let advisorId: string | null = null;
    const agentSecret = req.headers.get("x-agent-secret");
    if (agentSecret !== null) {
      if (!(await secretMatches(agentSecret, cfg.AGENT_SHARED_SECRET))) {
        return jsonError("Unauthorized", 401);
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonError("Unauthorized", 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth
        .getUser();
      if (userErr || !user) return jsonError("Unauthorized", 401);
      const { data: adv } = await serviceClient
        .from("advisors")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!adv) return jsonError("Advisor not found", 403);
      advisorId = adv.id;
    }

    const body = await req.json();

    if (body.mode === "prospect") {
      const cna = computeCna(
        buildProspectCnaInput(body.profile ?? {}, body.extracted_policies ?? []),
      );
      return jsonOk({ cna });
    }

    if (body.mode === "cfp") {
      const clientId = body.client_id;
      if (!clientId) return jsonError("client_id required", 400);
      return await runCfp(serviceClient, clientId, advisorId, cfg);
    }

    return jsonError("Unknown mode", 400);
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Internal error", 500);
  }
});

async function runCfp(
  // deno-lint-ignore no-explicit-any
  db: any,
  clientId: string,
  advisorId: string | null,
  cfg: AgentConfig,
) {
  // Advisor-JWT callers may only analyse their own clients.
  const { data: clientRow } = await db
    .from("clients")
    .select("id, advisor_id, full_name, email, phone")
    .eq("id", clientId)
    .single();
  if (!clientRow) return jsonError("Client not found", 404);
  if (advisorId && clientRow.advisor_id !== advisorId) {
    return jsonError("Forbidden", 403);
  }

  const reportToken = crypto.randomUUID();
  const reviewToken = crypto.randomUUID();
  const { data: request, error: insertErr } = await db
    .from("policy_review_requests")
    .insert({
      token: reportToken,
      review_token: reviewToken,
      name: clientRow.full_name,
      email: clientRow.email,
      whatsapp: clientRow.phone,
      source: "cfp",
      agent: "insurance_brain",
      client_id: clientId,
      status: "processing",
    })
    .select("id")
    .single();
  if (insertErr || !request) {
    return jsonError(`Insert failed: ${insertErr?.message}`, 500);
  }

  try {
    const financials = await fetchClientFinancials(db, clientId);
    if (!financials) throw new Error("Client financial data unavailable");

    const cna = computeCna(buildCfpCnaInput(financials));

    let report;
    try {
      report = await generateReport(cna, financials, cfg.GEMINI_API_KEY);
    } catch (_e) {
      report = placeholderReport(); // keep the lead alive; advisor edits manually
    }

    const policySummaries = financials.policies.map((p, i) => ({
      policy_id: `db-${i}`,
      insurer: p.provider ?? "unknown",
      policy_type: p.policy_type,
      plan_name: "unknown",
      sum_assured: p.sum_assured != null ? String(p.sum_assured) : "unknown",
      annual_premium: p.premium != null
        ? String(
          annualPremiumTotal([p]),
        )
        : "unknown",
      payment_term: "unknown",
      highlights: [],
      confidence: "high", // structured DB data, not OCR
    }));

    const draft = {
      engine: "insurance-brain-v1",
      source: "cfp",
      policy_summaries: policySummaries,
      gaps: report.gaps,
      recommendations: report.recommendations,
      overall_comment: report.overall_comment,
      cna,
      needs_human_ids: [],
    };

    await db
      .from("policy_review_requests")
      .update({ draft_json: draft, status: "draft_ready", error: null })
      .eq("id", request.id);

    await notifyN8n(cfg, {
      request_id: request.id,
      review_token: reviewToken,
      name: clientRow.full_name,
      source: "cfp",
      life_gap: cna.gaps.find((g) => g.key === "life")?.gap ?? null,
      ci_gap: cna.gaps.find((g) => g.key === "ci")?.gap ?? null,
      insufficient: cna.insufficient,
    });

    return jsonOk({ request_id: request.id, review_token: reviewToken });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unknown error";
    await db
      .from("policy_review_requests")
      .update({ status: "failed", error: message })
      .eq("id", request.id);
    return jsonError(message, 500);
  }
}

async function notifyN8n(cfg: AgentConfig, payload: Record<string, unknown>) {
  if (!cfg.N8N_NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(cfg.N8N_NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": cfg.AGENT_SHARED_SECRET,
      },
      body: JSON.stringify(payload),
    });
  } catch (_e) {
    // Telegram notification failure must not fail the analysis itself;
    // the n8n error workflow covers alerting.
  }
}
