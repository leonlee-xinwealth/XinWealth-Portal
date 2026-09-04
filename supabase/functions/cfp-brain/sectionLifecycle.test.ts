import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  markFailed,
  readPriorSection,
  saveDraft,
  upsertGenerating,
} from "./sectionLifecycle.ts";

/**
 * A minimal stand-in for the PostgREST builder. Records every write so the test
 * can assert on the patch that would have been sent.
 */
function fakeDb(priorContent: unknown = null, priorStatus: string | null = "draft") {
  const writes: Array<Record<string, unknown>> = [];
  const api = {
    writes,
    from(_table: string) {
      return {
        select(_cols: string) {
          const chain = {
            eq() {
              return chain;
            },
            maybeSingle() {
              return Promise.resolve({
                data: { content: priorContent, status: priorStatus },
                error: null,
              });
            },
            single() {
              return Promise.resolve({ data: { id: "sec-1" }, error: null });
            },
          };
          return chain;
        },
        upsert(row: Record<string, unknown>) {
          writes.push({ op: "upsert", ...row });
          return {
            select() {
              return { single: () => Promise.resolve({ data: { id: "sec-1" }, error: null }) };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          writes.push({ op: "update", ...patch });
          const chain = {
            eq: () => chain,
            select: () => chain,
            single: () => Promise.resolve({ data: { id: "sec-1" }, error: null }),
            then: (
              res: (v: { data: null; error: null }) => unknown,
            ) => Promise.resolve({ data: null, error: null }).then(res),
          };
          return chain;
        },
      };
    },
  };
  return api;
}

Deno.test("readPriorSection reports the state that exists BEFORE anything writes", () => {
  // The order this enforces: upsertGenerating sets status to 'generating',
  // which erases the very state the approval guard inspects. Reading has to
  // happen first, which is why it is a separate call.
  return Promise.all([
    readPriorSection(fakeDb({ version: 1 }, "approved"), "r1", "tax_planning"),
    readPriorSection(fakeDb(null, null), "r1", "tax_planning"),
  ]).then(([existing, fresh]) => {
    assertEquals(existing, { status: "approved", hadContent: true });
    assertEquals(fresh, { status: null, hadContent: false });
  });
});

Deno.test("upsertGenerating returns the row id it claimed", async () => {
  assertEquals(
    await upsertGenerating(fakeDb(), "r1", "tax_planning", "tax_expert"),
    "sec-1",
  );
});

Deno.test("landing a draft writes the fingerprint in the same statement as the content", async () => {
  // A row whose content and fingerprint disagree is exactly the condition the
  // staleness sweep exists to detect; we must not manufacture it ourselves.
  const db = fakeDb();
  await saveDraft(db, "sec-1", { version: 1 }, "abc123");
  const patch = db.writes.find((w) => w.op === "update")!;
  assertEquals(patch.input_fingerprint, "abc123");
  assertEquals(patch.status, "draft");
});

Deno.test("landing a draft clears any stale flag", async () => {
  // This prose was just written against the basis we hashed, so whatever the
  // row was flagged for no longer applies.
  const db = fakeDb();
  await saveDraft(db, "sec-1", { version: 1 }, "abc123");
  const patch = db.writes.find((w) => w.op === "update")!;
  assertEquals(patch.stale_reason, null);
  assertEquals(patch.stale_at, null);
});

Deno.test("a failed run on a never-generated section marks it failed", async () => {
  const db = fakeDb();
  await markFailed(db, "sec-1", "Gemini 503", false);
  const patch = db.writes.find((w) => w.op === "update")!;
  assertEquals(patch.status, "failed");
  assertEquals(patch.error, "Gemini 503");
});

Deno.test("a failed run does NOT destroy an existing draft", async () => {
  // The regression this guards: marking the row 'failed' sent the card to the
  // "generate this section" empty screen, so one transient model error made an
  // advisor's reviewed and edited prose look like it had never existed.
  const db = fakeDb();
  await markFailed(db, "sec-1", "Gemini 503", true);
  const patch = db.writes.find((w) => w.op === "update")!;
  assertEquals(patch.status, "draft");
  assertEquals(patch.error, "Gemini 503", "the error still has to surface to the advisor");
});

Deno.test("markFailed defaults to the destructive-free reading only when told there was content", async () => {
  // Default parameter keeps old call sites behaving as before (failed), so the
  // preservation is opt-in and explicit at the call site.
  const db = fakeDb();
  await markFailed(db, "sec-1", "boom");
  assertEquals(db.writes.find((w) => w.op === "update")!.status, "failed");
});
