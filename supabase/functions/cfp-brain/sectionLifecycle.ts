// The edge function is the sole writer of a section row's lifecycle:
// generating → draft | failed. Advisors then edit content / flip status to
// approved through RLS.

// deno-lint-ignore no-explicit-any
type Db = any;

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
  return data.id;
}

export async function saveDraft(
  db: Db,
  sectionId: string,
  content: unknown,
): Promise<unknown> {
  const { data, error } = await db
    .from("report_sections")
    .update({
      content,
      status: "draft",
      generated_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function markFailed(
  db: Db,
  sectionId: string,
  message: string,
): Promise<void> {
  await db
    .from("report_sections")
    .update({ status: "failed", error: message })
    .eq("id", sectionId);
}
