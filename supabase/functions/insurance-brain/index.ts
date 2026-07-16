// Insurance Brain (保险佬) — prospect-funnel analysis core.
// mode:'prospect' → deterministic CNA for the n8n policy-review funnel engine.
//
// The CFP report sections (mode:'cfp_section' / 'cfp_client_view') moved to
// the multi-agent cfp-brain function (modules/insurance) on 2026-07-16 — see
// docs/superpowers/specs/2026-07-16-cfp-multi-agent-report-design.md.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeCna } from "../_shared/insurance/cna.ts";
import { buildProspectCnaInput } from "../_shared/insurance/mapping.ts";
import { loadConfig } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // --- Auth: n8n agent secret only (the funnel engine is the sole caller) ---
    const agentSecret = req.headers.get("x-agent-secret");
    if (
      agentSecret === null ||
      !(await secretMatches(agentSecret, cfg.AGENT_SHARED_SECRET))
    ) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();

    if (body.mode === "prospect") {
      const cna = computeCna(
        buildProspectCnaInput(body.profile ?? {}, body.extracted_policies ?? []),
      );
      return jsonOk({ cna });
    }

    return jsonError("Unknown mode", 400);
  } catch (e) {
    return jsonError((e as Error)?.message ?? "Internal error", 500);
  }
});
