import { describe, expect, it } from "vitest";
import { isMissingColumnError, isMissingTableError } from "../../api/_lib/degrade.js";

describe("isMissingTableError", () => {
  it("detects Postgres relation-does-not-exist by code", () => {
    expect(isMissingTableError({ code: "42P01", message: "relation \"reviews\" does not exist" })).toBe(true);
  });
  it("detects it by message when code is absent", () => {
    expect(isMissingTableError({ message: "relation \"public.reviews\" does not exist" })).toBe(true);
  });
  it("is false for an unrelated error", () => {
    expect(isMissingTableError({ code: "23505", message: "duplicate key value" })).toBe(false);
  });
  it("is false for null/undefined", () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});

describe("isMissingColumnError", () => {
  it("detects Postgres undefined-column by code", () => {
    expect(isMissingColumnError({ code: "42703", message: "column \"review_id\" does not exist" })).toBe(true);
  });
  it("detects PostgREST's schema-cache code", () => {
    expect(isMissingColumnError({ code: "PGRST204" })).toBe(true);
  });
  it("detects it by message when code is absent", () => {
    expect(isMissingColumnError({ message: "Could not find the 'unexplained_gap' column in the schema cache" })).toBe(true);
  });
  it("is false for an unrelated error", () => {
    expect(isMissingColumnError({ code: "23505", message: "duplicate key value" })).toBe(false);
  });
});
