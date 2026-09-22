import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  applyStaleness,
  planStaleness,
  type SectionReviewRow,
  STALE_BASIS_CHANGED,
} from "./staleness.ts";
import type { SectionType } from "./types.ts";

function row(over: Partial<SectionReviewRow> = {}): SectionReviewRow {
  return {
    id: "sec-1",
    section_type: "retirement_planning",
    status: "approved",
    content: { version: 1 },
    input_fingerprint: "old",
    ...over,
  };
}

const NEXT: Partial<Record<SectionType, string>> = { retirement_planning: "new" };

Deno.test("an approved section whose basis moved loses its approval", () => {
  const actions = planStaleness([row()], NEXT);
  assertEquals(actions.length, 1);
  assertEquals(actions[0].kind, "demote");
});

Deno.test("a draft whose basis moved is flagged but not demoted", () => {
  // It is already a draft; the only thing to add is the reason.
  const actions = planStaleness([row({ status: "draft" })], NEXT);
  assertEquals(actions.map((a) => a.kind), ["flag"]);
});

Deno.test("a matching fingerprint is left completely alone", () => {
  assertEquals(planStaleness([row({ input_fingerprint: "new" })], NEXT), []);
});

Deno.test("a null fingerprint is NEVER auto-flipped", () => {
  // The compatibility gate. Every section approved before this pipeline shipped
  // has a null fingerprint, and we cannot know what its prose was written
  // against — demoting them all on the first deploy would be worse than
  // leaving them. They pick one up the next time they are generated.
  assertEquals(planStaleness([row({ input_fingerprint: null })], NEXT), []);
});

Deno.test("a section that was never generated has nothing to stale", () => {
  assertEquals(
    planStaleness([row({ content: null, input_fingerprint: "old" })], NEXT),
    [],
  );
});

Deno.test("a run in flight is not touched", () => {
  // generating: its own saveDraft is about to write the authoritative
  // fingerprint. failed: there is nothing to preserve.
  for (const status of ["generating", "failed"]) {
    assertEquals(planStaleness([row({ status })], NEXT), [], status);
  }
});

Deno.test("a section missing from the new fingerprints is left alone", () => {
  // A module that is not registered yet computes no det; treating its absence
  // as "changed" would demote sections for a deployment detail.
  assertEquals(planStaleness([row()], {}), []);
});

Deno.test("only the sections that actually moved are touched", () => {
  const rows = [
    row({ id: "a", section_type: "retirement_planning", input_fingerprint: "old" }),
    row({ id: "b", section_type: "tax_planning", input_fingerprint: "same" }),
    row({ id: "c", section_type: "legacy_planning", input_fingerprint: "old", status: "draft" }),
  ];
  const actions = planStaleness(rows, {
    retirement_planning: "new",
    tax_planning: "same",
    legacy_planning: "new",
  });
  assertEquals(actions.map((a) => `${a.id}:${a.kind}`), ["a:demote", "c:flag"]);
});

// --------------------------------------------------------------------------

function fakeDb() {
  const writes: Array<Record<string, unknown>> = [];
  return {
    writes,
    from() {
      return {
        update(patch: Record<string, unknown>) {
          writes.push(patch);
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    },
  };
}

Deno.test("a demotion withdraws the approval outright", async () => {
  // Leaving status 'approved' with only a warning flag would let the export
  // gate open on prose nobody has re-read — the gate keys off status.
  const db = fakeDb();
  await applyStaleness(
    db,
    [{ id: "a", section_type: "retirement_planning", kind: "demote" }],
    new Date("2026-08-20T00:00:00Z"),
  );
  assertEquals(db.writes[0], {
    stale_reason: STALE_BASIS_CHANGED,
    stale_at: "2026-08-20T00:00:00.000Z",
    status: "draft",
    approved_at: null,
    approved_by: null,
  });
});

Deno.test("a flag records the reason and nothing else", async () => {
  const db = fakeDb();
  await applyStaleness(db, [{ id: "a", section_type: "tax_planning", kind: "flag" }]);
  assertEquals(Object.keys(db.writes[0]).sort(), ["stale_at", "stale_reason"]);
});

Deno.test("nothing to do writes nothing", async () => {
  const db = fakeDb();
  await applyStaleness(db, []);
  assertEquals(db.writes.length, 0);
});
