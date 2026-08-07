import { describe, expect, it } from "vitest";
import { buildDocumentTimeline } from "./dashboard-timeline";
import { compareDocumentsByIssueDateDesc } from "./document-order";
import type { DocumentRow } from "./types";

function invoice(overrides: Partial<DocumentRow>): DocumentRow {
  return {
    id: "invoice",
    user_id: "user",
    type: "invoice",
    status: "paid",
    number: "INV-001",
    issue_date: "2026-01-10",
    due_date: "2026-01-24",
    paid_at: "2026-03-03T00:00:00Z",
    updated_at: "2026-03-03T00:00:00Z",
    totals: { total: 110, gst: 10 },
    ...overrides
  } as DocumentRow;
}

describe("document issue dates", () => {
  it("sorts documents by issue date instead of update time", () => {
    const olderIssue = invoice({ id: "older", issue_date: "2026-01-10", updated_at: "2026-08-01T00:00:00Z" });
    const newerIssue = invoice({ id: "newer", issue_date: "2026-02-10", updated_at: "2026-03-01T00:00:00Z" });

    expect([olderIssue, newerIssue].sort(compareDocumentsByIssueDateDesc).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("assigns dashboard totals to the issue month", () => {
    const chart = buildDocumentTimeline(
      [invoice({ issue_date: "2026-01-10", paid_at: "2026-03-03T00:00:00Z", updated_at: "2026-03-03T00:00:00Z" })],
      "month",
      new Date("2026-08-07T12:00:00+10:00")
    );

    expect(chart.find((bucket) => bucket.label === "Jan")?.received).toBe(110);
    expect(chart.find((bucket) => bucket.label === "Mar")?.received).toBe(0);
  });
});

