// CFP Brain — multi-agent financial-planning report engine.
// One module per CFP section (现金流管家/保险佬/投资大师/…/首席规划师), all
// deterministic numbers computed in TypeScript, Gemini narrates one section
// per invocation. Design: docs/superpowers/specs/2026-07-16-cfp-multi-agent-
// report-design.md
//
// modes:
//   generate_section {report_id, section_type}          → draft the section
//   client_view      {report_id, section_type, language} → layman rewrite

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type AgentConfig, loadConfig } from "../_shared/config.ts";
import { callGeminiJson } from "../_shared/llm/gemini.ts";
import { fetchCfpData } from "./db.ts";
import { computeAll } from "./orchestrator.ts";
import { markFailed, saveDraft, upsertGenerating } from "./sectionLifecycle.ts";
import { findModule, ORDERED_MODULES, SECTION_LABELS } from "./modules/registry.ts";
import { generateGenericClientView } from "./clientView.ts";
import type { PlanningInputs, SectionType } from "./types.ts";

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

    // --- Auth: n8n agent secret OR advisor JWT (same as insurance-brain) ---
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
    const reportId = body.report_id;
    const sectionType = body.section_type as SectionType;
    if (!reportId) return jsonError("report_id required", 400);
    if (!sectionType || !SECTION_LABELS[sectionType]) {
      return jsonError("Unknown section_type", 400);
    }

    const { data: report } = await serviceClient
      .from("financial_reports")
      .select("id, client_id, advisor_id, planning_inputs")
      .eq("id", reportId)
      .single();
    if (!report) return jsonError("Report not found", 404);
    // Advisor-JWT callers may only work on their own clients' reports.
    if (advisorId && report.advisor_id !== advisorId) {
      return jsonError("Forbidden", 403);
    }

    const module = findModule(sectionType);
    if (!module) {
      return jsonError(`Section ${sectionType} is not available yet`, 400);
    }

    if (body.mode === "generate_section") {
      return await runGenerateSection(
        serviceClient,
        report,
        sectionType,
        module,
        cfg,
      );
    }

    if (body.mode === "client_view") {
      const language = body.language === "zh" ? "zh" : "en";
      return await runClientView(
        serviceClient,
        report.id,
        sectionType,
        module,
        language,
        cfg,
      );
    }

    return jsonError("Unknown mode", 400);
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Internal error", 500);
  }
});

async function runGenerateSection(
  // deno-lint-ignore no-explicit-any
  db: any,
  report: { id: string; client_id: string; planning_inputs: PlanningInputs | null },
  sectionType: SectionType,
  // deno-lint-ignore no-explicit-any
  module: any,
  cfg: AgentConfig,
) {
  // The function is the sole writer of the section row's lifecycle.
  const sectionId = await upsertGenerating(
    db,
    report.id,
    sectionType,
    module.agent,
  );

  try {
    const data = await fetchCfpData(db, report.client_id);
    if (!data) throw new Error("Client financial data unavailable");

    const { baseline, det } = computeAll(
      ORDERED_MODULES,
      data,
      report.planning_inputs ?? {},
    );

    // Persist the shared baseline for the UI / audit trail.
    await db
      .from("financial_reports")
      .update({ baseline })
      .eq("id", report.id);

    const sectionDet = det[sectionType];
    const { prompt, schema } = module.buildPrompt(sectionDet, baseline, data);
    const narrative = await callGeminiJson(prompt, schema, cfg.GEMINI_API_KEY);
    const content = module.assemble(sectionDet, narrative, data);

    const updated = await saveDraft(db, sectionId, content);
    return jsonOk({ section: updated });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unknown error";
    await markFailed(db, sectionId, message);
    return jsonError(message, 500);
  }
}

// Second pass: rewrite the drafted section prose into warm, layman language,
// merged into content.client_view. Does not touch section status — it augments
// an existing draft/approved section. Numbers are reused verbatim.
async function runClientView(
  // deno-lint-ignore no-explicit-any
  db: any,
  reportId: string,
  sectionType: SectionType,
  // deno-lint-ignore no-explicit-any
  module: any,
  language: "en" | "zh",
  cfg: AgentConfig,
) {
  const { data: section } = await db
    .from("report_sections")
    .select("id, content")
    .eq("report_id", reportId)
    .eq("section_type", sectionType)
    .single();
  if (!section || !section.content) {
    return jsonError("Section not generated yet", 400);
  }

  try {
    let clientView: unknown;
    if (module.generateClientView) {
      clientView = await module.generateClientView(
        section.content,
        language,
        cfg.GEMINI_API_KEY,
      );
    } else if (module.clientViewInput) {
      clientView = await generateGenericClientView(
        SECTION_LABELS[sectionType],
        module.clientViewInput(section.content),
        language,
        cfg.GEMINI_API_KEY,
      );
    } else {
      return jsonError("Section does not support client view", 400);
    }

    const merged = { ...section.content, client_view: clientView };
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
