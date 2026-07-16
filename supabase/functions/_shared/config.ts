// Runtime configuration: env vars take priority, Supabase Vault is the
// fallback (secrets are synced there because CLI/dashboard secret management
// isn't available from this deployment pipeline). Cached per isolate.

const SECRET_NAMES = [
  "GEMINI_API_KEY",
  "AGENT_SHARED_SECRET",
  "N8N_NOTIFY_WEBHOOK_URL",
] as const;

export type SecretName = (typeof SECRET_NAMES)[number];
export type AgentConfig = Record<SecretName, string>;

let cached: AgentConfig | null = null;

// deno-lint-ignore no-explicit-any
export async function loadConfig(db: any): Promise<AgentConfig> {
  if (cached) return cached;

  const cfg = {} as AgentConfig;
  const missing: SecretName[] = [];
  for (const name of SECRET_NAMES) {
    const v = Deno.env.get(name) ?? "";
    cfg[name] = v;
    if (!v) missing.push(name);
  }

  if (missing.length > 0) {
    const { data, error } = await db.rpc("vault_get_secrets", {
      p_names: missing,
    });
    if (!error) {
      for (const row of data ?? []) {
        cfg[row.name as SecretName] = row.secret ?? "";
      }
    }
  }

  cached = cfg;
  return cfg;
}
