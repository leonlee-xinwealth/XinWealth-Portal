// Insurance Brain (保险佬) — paraplanner agent #1, analysis core.
// mode:'prospect'     → deterministic CNA for the n8n policy-review funnel engine.
// mode:'cfp_section'  → drafts the Insurance Planning section of a CFP report:
//                       DB data → CNA → Gemini narrative → report_sections.
//                       In-portal only; no Telegram/n8n involvement.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeCna } from "../_shared/insurance/cna.ts";
import { buildCfpCnaInput, buildProspectCnaInput } from "../_shared/insurance/mapping.ts";
import { fetchClientFinancials } from "./db.ts";
import { generateSectionNarrative } from "./section.ts";
import { buildSectionContent } from "./assemble.ts";
import { generateClientView } from "./clientView.ts";
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

    if (body.mode === "cfp_section") {
      const reportId = body.report_id;
      if (!reportId) return jsonError("report_id required", 400);
      return await runCfpSection(serviceClient, reportId, advisorId, cfg);
    }

    if (body.mode === "cfp_client_view") {
      const reportId = body.report_id;
      if (!reportId) return jsonError("report_id required", 400);
      const language = body.language === "zh" ? "zh" : "en";
      return await runCfpClientView(
        serviceClient,
        reportId,
        advisorId,
        cfg,
        language,
      );
    }

    return jsonError("Unknown mode", 400);
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Internal error", 500);
  }
});

async function runCfpSection(
  // deno-lint-ignore no-explicit-any
  db: any,
  reportId: string,
  advisorId: string | null,
  cfg: AgentConfig,
) {
  const { data: report } = await db
    .from("financial_reports")
    .select("id, client_id, advisor_id")
    .eq("id", reportId)
    .single();
  if (!report) return jsonError("Report not found", 404);
  // Advisor-JWT callers may only work on their own clients' reports.
  if (advisorId && report.advisor_id !== advisorId) {
    return jsonError("Forbidden", 403);
  }

  // The function is the sole writer of the section row's lifecycle.
  const { data: section, error: upsertErr } = await db
    .from("report_sections")
    .upsert(
      {
        report_id: report.id,
        section_type: "insurance_planning",
        agent: "insurance_brain",
        status: "generating",
        error: null,
      },
      { onConflict: "report_id,section_type" },
    )
    .select("id")
    .single();
  if (upsertErr || !section) {
    return jsonError(`Section upsert failed: ${upsertErr?.message}`, 500);
  }

  try {
    const financials = await fetchClientFinancials(db, report.client_id);
    if (!financials) throw new Error("Client financial data unavailable");

    const cna = computeCna(buildCfpCnaInput(financials));
    const narrative = await generateSectionNarrative(
      cna,
      financials,
      cfg.GEMINI_API_KEY,
    );
    const content = buildSectionContent(financials, cna, narrative);

    const { data: updated, error: updateErr } = await db
      .from("report_sections")
      .update({
        content,
        status: "draft",
        generated_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", section.id)
      .select("*")
      .single();
    if (updateErr) throw new Error(updateErr.message);

    return jsonOk({ section: updated });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unknown error";
    await db
      .from("report_sections")
      .update({ status: "failed", error: message })
      .eq("id", section.id);
    return jsonError(message, 500);
  }
}

// Second pass: rewrite the already-drafted section prose into warm, layman
// language for the client-facing PDF, merged into content.client_view. Does not
// touch the section's status/lifecycle — it augments an existing draft/approved
// section. Numbers are reused verbatim; the LLM only rephrases.
async function runCfpClientView(
  // deno-lint-ignore no-explicit-any
  db: any,
  reportId: string,
  advisorId: string | null,
  cfg: AgentConfig,
  language: "en" | "zh",
) {
  const { data: report } = await db
    .from("financial_reports")
    .select("id, advisor_id")
    .eq("id", reportId)
    .single();
  if (!report) return jsonError("Report not found", 404);
  if (advisorId && report.advisor_id !== advisorId) {
    return jsonError("Forbidden", 403);
  }

  const { data: section } = await db
    .from("report_sections")
    .select("id, content")
    .eq("report_id", reportId)
    .eq("section_type", "insurance_planning")
    .single();
  if (!section || !section.content || !section.content.cna) {
    return jsonError("Insurance section not generated yet", 400);
  }

  try {
    const content = section.content;
    // InsuranceSectionContent extends SectionNarrative, so the base prose lives
    // directly on content — reconstruct the narrative for the simplify pass.
    const narrative = {
      executive_summary: content.executive_summary,
      coverage_review: content.coverage_review ?? [],
      gap_analysis: content.gap_analysis ?? "",
      recommendations: content.recommendations ?? [],
      scenarios: content.scenarios ?? [],
    };
    const clientView = await generateClientView(
      narrative,
      content.cna,
      language,
      cfg.GEMINI_API_KEY,
    );
    const merged = { ...content, client_view: clientView };

    const { data: updated, error: updateErr } = await db
      .from("report_sections")
      .update({ content: merged })
      .eq("id", section.id)
      .select("*")
      .single();
    if (updateErr) throw new Error(updateErr.message);

    return jsonOk({ section: updated });
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Unknown error", 500);
  }
}
