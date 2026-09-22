// CFP Brain — multi-agent financial-planning report engine.
// One module per CFP section (现金流管家/保险佬/投资大师/…/首席规划师), all
// deterministic numbers computed in TypeScript, Gemini narrates one section
// per invocation. Design: docs/superpowers/specs/2026-07-16-cfp-multi-agent-
// report-design.md
//
// modes:
//   generate_section {report_id, section_type}           → draft the section
//   client_view      {report_id, section_type, language} → layman rewrite
//   chat             {report_id, section_type, message}  → ask the agent (脱敏)
//   revise           {report_id, section_type, instruction} → rewrite narrative
//                    per advisor instruction; deterministic numbers untouched
//
//   refresh_fingerprints {report_id}                    → recheck every section
//                    against the current numbers; no LLM, no writes unless
//                    something actually moved
//
// generate_section and revise refuse to overwrite an `approved` section unless
// the caller passes {force: true} — the advisor's sign-off is the one thing in
// this pipeline the model may not quietly discard. The guard lives here rather
// than in React because the n8n path (x-agent-secret) never touches the UI.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type AgentConfig, loadConfig } from "../_shared/config.ts";
import { callGeminiJson } from "../_shared/llm/gemini.ts";
import { fetchCfpData } from "./db.ts";
import { computeAll } from "./orchestrator.ts";
import {
  markFailed,
  readPriorSection,
  saveDraft,
  upsertGenerating,
} from "./sectionLifecycle.ts";
import { sectionFingerprint } from "./fingerprint.ts";
import { sweepStaleness } from "./staleness.ts";
import { findModule, ORDERED_MODULES, SECTION_LABELS } from "./modules/registry.ts";
import { generateGenericClientView } from "./clientView.ts";
import {
  buildChatPrompt,
  buildRevisePrompt,
  type ChatTurn,
  generateChatReply,
  redactSensitive,
} from "./chat.ts";
import type { PlanningInputs, SectionType } from "./types.ts";

/** `partner_client_id` non-null = joint household plan; every fetchCfpData call
 * must pass it or chat/revise would recompute against single-client data and
 * disagree with the saved draft. */
interface CfpReportRow {
  id: string;
  client_id: string;
  partner_client_id: string | null;
  planning_inputs: PlanningInputs | null;
}

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
    // Every mode but the whole-report sweep addresses one section.
    const wholeReport = body.mode === "refresh_fingerprints";
    if (!wholeReport && (!sectionType || !SECTION_LABELS[sectionType])) {
      return jsonError("Unknown section_type", 400);
    }

    const { data: report } = await serviceClient
      .from("financial_reports")
      .select("id, client_id, partner_client_id, advisor_id, planning_inputs")
      .eq("id", reportId)
      .single();
    if (!report) return jsonError("Report not found", 404);
    // Advisor-JWT callers may only work on their own clients' reports.
    if (advisorId && report.advisor_id !== advisorId) {
      return jsonError("Forbidden", 403);
    }

    if (wholeReport) {
      return await runRefreshFingerprints(serviceClient, report);
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
        body.force === true,
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

    if (body.mode === "chat") {
      if (typeof body.message !== "string" || !body.message.trim()) {
        return jsonError("message required", 400);
      }
      return await runChat(serviceClient, report, sectionType, module, cfg, body.message);
    }

    if (body.mode === "revise") {
      if (typeof body.instruction !== "string" || !body.instruction.trim()) {
        return jsonError("instruction required", 400);
      }
      return await runRevise(
        serviceClient,
        report,
        sectionType,
        module,
        cfg,
        body.instruction,
        body.force === true,
      );
    }

    return jsonError("Unknown mode", 400);
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Internal error", 500);
  }
});

/**
 * Recheck every section against the numbers as they stand right now.
 *
 * Staleness is otherwise only ever noticed when somebody regenerates something.
 * An advisor who edits an asset in the client's profile and never touches the
 * report leaves eight approved sections quietly rotting while the export gate
 * stays open — which would make the entire guarantee decorative. computeAll is
 * pure and sub-second, so the report page can afford to call this on open and
 * after any edit that moves the numbers.
 *
 * No LLM, and no writes at all unless a fingerprint actually moved.
 */
async function runRefreshFingerprints(
  // deno-lint-ignore no-explicit-any
  db: any,
  report: CfpReportRow,
) {
  const data = await fetchCfpData(db, report.client_id, report.partner_client_id);
  if (!data) return jsonError("Client financial data unavailable", 400);

  const { baseline, det } = computeAll(
    ORDERED_MODULES,
    data,
    report.planning_inputs ?? {},
  );

  // Keep the stored baseline in step with what we just judged against;
  // otherwise the UI's ratios and this sweep's verdict come from different
  // computations of the same client.
  await db.from("financial_reports").update({ baseline }).eq("id", report.id);

  const stale = await sweepStaleness(db, report.id, det, baseline);
  return jsonOk({ stale });
}

/**
 * 409 unless the caller means it. Returned as a body the UI can read, so the
 * review page can offer "regenerate anyway" rather than showing a raw error.
 */
function approvedLock(sectionType: SectionType) {
  return new Response(
    JSON.stringify({
      error: `${SECTION_LABELS[sectionType]} 已定稿，重新生成会覆盖已审核的内容`,
      code: "section_approved",
      section_type: sectionType,
    }),
    { status: 409, headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

async function runGenerateSection(
  // deno-lint-ignore no-explicit-any
  db: any,
  report: CfpReportRow,
  sectionType: SectionType,
  // deno-lint-ignore no-explicit-any
  module: any,
  cfg: AgentConfig,
  force: boolean,
) {
  // Read before writing: upsertGenerating flips status to 'generating', which
  // erases the very state this guard inspects.
  const prior = await readPriorSection(db, report.id, sectionType);
  if (prior.status === "approved" && !force) return approvedLock(sectionType);

  // The function is the sole writer of the section row's lifecycle.
  const sectionId = await upsertGenerating(
    db,
    report.id,
    sectionType,
    module.agent,
  );

  try {
    const data = await fetchCfpData(db, report.client_id, report.partner_client_id);
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

    const fingerprint = await sectionFingerprint(sectionType, sectionDet, baseline);
    const updated = await saveDraft(db, sectionId, content, fingerprint);

    // This run rewrote the shared baseline — including the budget waterfall,
    // which reallocates every other section's spending. Sections whose basis
    // moved lose their approval here, while the advisor is still looking.
    const stale = await sweepStaleness(db, report.id, det, baseline, sectionType);

    return jsonOk({ section: updated, stale });
  } catch (e) {
    const message = (e as Error)?.message ?? "Unknown error";
    await markFailed(db, sectionId, message, prior.hadContent);
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

// deno-lint-ignore no-explicit-any
function narrativeContextFor(module: any, content: unknown): unknown {
  if (module.chatContext) return module.chatContext(content);
  if (module.clientViewInput) return module.clientViewInput(content);
  return {};
}

// Advisor asks the section's agent about its analysis. Both sides of the
// exchange are persisted to cfp_chat_messages. 脱敏: see chat.ts.
async function runChat(
  // deno-lint-ignore no-explicit-any
  db: any,
  report: CfpReportRow,
  sectionType: SectionType,
  // deno-lint-ignore no-explicit-any
  module: any,
  cfg: AgentConfig,
  rawMessage: string,
) {
  const { data: section } = await db
    .from("report_sections")
    .select("id, content")
    .eq("report_id", report.id)
    .eq("section_type", sectionType)
    .single();
  if (!section) {
    return jsonError("Generate the section first, then chat with its agent", 400);
  }

  try {
    const data = await fetchCfpData(db, report.client_id, report.partner_client_id);
    if (!data) throw new Error("Client financial data unavailable");
    const { baseline, det } = computeAll(
      ORDERED_MODULES,
      data,
      report.planning_inputs ?? {},
    );

    const { data: historyRows } = await db
      .from("cfp_chat_messages")
      .select("role, message")
      .eq("section_id", section.id)
      .order("created_at", { ascending: false })
      .limit(10);
    const history = ((historyRows ?? []) as ChatTurn[]).reverse();

    const message = redactSensitive(rawMessage.trim());
    const prompt = buildChatPrompt(
      sectionType,
      module.agent,
      det[sectionType],
      baseline,
      narrativeContextFor(module, section.content),
      history,
      message,
    );
    const reply = await generateChatReply(prompt, cfg.GEMINI_API_KEY);

    const { error: insertErr } = await db.from("cfp_chat_messages").insert([
      { section_id: section.id, role: "advisor", message },
      { section_id: section.id, role: "agent", message: reply },
    ]);
    if (insertErr) throw new Error(insertErr.message);

    return jsonOk({ reply });
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Unknown error", 500);
  }
}

// Advisor instructs the agent to rewrite its narrative. Deterministic numbers
// are recomputed fresh and re-stamped by assemble — the instruction can only
// move prose, never figures. Section returns to draft; stale client_view is
// dropped (regenerate it after approving the new prose).
async function runRevise(
  // deno-lint-ignore no-explicit-any
  db: any,
  report: CfpReportRow,
  sectionType: SectionType,
  // deno-lint-ignore no-explicit-any
  module: any,
  cfg: AgentConfig,
  rawInstruction: string,
  force: boolean,
) {
  const { data: section } = await db
    .from("report_sections")
    .select("id, content, status")
    .eq("report_id", report.id)
    .eq("section_type", sectionType)
    .single();
  if (!section || !section.content) {
    return jsonError("Section not generated yet", 400);
  }
  // Revise rewrites the narrative in place, so it overwrites an approval just
  // as thoroughly as a regeneration does.
  if (section.status === "approved" && !force) return approvedLock(sectionType);

  try {
    const data = await fetchCfpData(db, report.client_id, report.partner_client_id);
    if (!data) throw new Error("Client financial data unavailable");
    const { baseline, det } = computeAll(
      ORDERED_MODULES,
      data,
      report.planning_inputs ?? {},
    );

    const instruction = redactSensitive(rawInstruction.trim());
    const sectionDet = det[sectionType];
    const { prompt, schema } = module.buildPrompt(sectionDet, baseline, data);
    const revisePrompt = buildRevisePrompt(
      prompt,
      narrativeContextFor(module, section.content),
      instruction,
    );
    const narrative = await callGeminiJson(
      revisePrompt,
      schema,
      cfg.GEMINI_API_KEY,
    );
    const content = module.assemble(sectionDet, narrative, data);

    const fingerprint = await sectionFingerprint(sectionType, sectionDet, baseline);
    const updated = await saveDraft(db, section.id, content, fingerprint);

    await db.from("cfp_chat_messages").insert([
      { section_id: section.id, role: "advisor", message: `[修改指示] ${instruction}` },
      {
        section_id: section.id,
        role: "agent",
        message: "已按指示重写本节叙述并更新草稿（数字保持确定性计算结果不变）。",
      },
    ]);

    return jsonOk({ section: updated });
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Unknown error", 500);
  }
}
