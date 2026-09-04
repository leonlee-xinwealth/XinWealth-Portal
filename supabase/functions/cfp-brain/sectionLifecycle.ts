// The edge function is the sole writer of a section row's lifecycle:
// generating → draft | failed. Advisors then edit content / flip status to
// approved through RLS.

// deno-lint-ignore no-explicit-any
type Db = any;

export interface PriorSection {
  /** null when the row does not exist yet */
  status: string | null;
  /**
   * Whether the row already held a generated section. If it did, a failure must
   * not erase it — see markFailed.
   */
  hadContent: boolean;
}

/**
 * Read a section's state BEFORE anything writes to it.
 *
 * Order matters: `upsertGenerating` sets status to 'generating', which destroys
 * the evidence the approval guard needs. Callers must read first, decide, then
 * upsert — that is why this is a separate call rather than a field on the
 * upsert result.
 */
export async function readPriorSection(
  db: Db,
  reportId: string,
  sectionType: string,
): Promise<PriorSection> {
  const { data } = await db
    .from("report_sections")
    .select("status, content")
    .eq("report_id", reportId)
    .eq("section_type", sectionType)
    .maybeSingle();
  return { status: data?.status ?? null, hadContent: data?.content != null };
}

export async function upsertGenerating(
  db: Db,
  reportId: string,
  sectionType: string,
  agent: string,
): Promise<string> {
  const { data, error } = await db
    .from("report_sections")
    .upsert(
      {
        report_id: reportId,
        section_type: sectionType,
        agent,
        status: "generating",
        error: null,
      },
      { onConflict: "report_id,section_type" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Section upsert failed: ${error?.message}`);
  }
  return data.id as string;
}

/**
 * Land a generated section as a draft.
 *
 * The fingerprint is written in the same statement as the content on purpose:
 * a row whose content and fingerprint could disagree is exactly the condition
 * the staleness sweep exists to detect, and we must not manufacture it
 * ourselves. Landing here also clears any stale flag — this prose was written
 * against the basis we just hashed.
 */
export async function saveDraft(
  db: Db,
  sectionId: string,
  content: unknown,
  fingerprint: string | null = null,
): Promise<unknown> {
  const { data, error } = await db
    .from("report_sections")
    .update({
      content,
      status: "draft",
      generated_at: new Date().toISOString(),
      error: null,
      input_fingerprint: fingerprint,
      stale_reason: null,
      stale_at: null,
    })
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Record a failed run without destroying work.
 *
 * `failed` sends the card to the "generate this section" empty screen, so
 * marking a row failed when it already held a good draft made one transient
 * Gemini 503 look like the section had never been generated — the advisor's
 * reviewed and edited prose appeared to vanish. When there was prior content we
 * keep the row at `draft` and surface `error` as a banner instead; `failed` is
 * reserved for a section that genuinely has nothing to show.
 */
export async function markFailed(
  db: Db,
  sectionId: string,
  message: string,
  hadContent = false,
): Promise<void> {
  await db
    .from("report_sections")
    .update({ status: hadContent ? "draft" : "failed", error: message })
    .eq("id", sectionId);
}
