import { statusForDueDate } from "./documents";
import type { DocumentRow } from "./types";

export type DashboardPeriod = "week" | "month" | "fiscal";

const dayMs = 86_400_000;

function overdue(document: DocumentRow) {
  return document.type === "invoice" && statusForDueDate(document.status, document.due_date ?? "") === "overdue";
}

function startOfFiscalYear(today: Date) {
  return new Date(today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1, 6, 1);
}

export function buildDocumentTimeline(documents: DocumentRow[], period: DashboardPeriod, now = new Date()) {
  const weekly = period === "week";
  const start = weekly
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 11 * 7)
    : period === "fiscal"
      ? startOfFiscalYear(now)
      : new Date(now.getFullYear(), 0, 1);
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = weekly
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + index * 7)
      : new Date(start.getFullYear(), start.getMonth() + index, 1);
    const bucketEnd = weekly
      ? new Date(bucketStart.getTime() + 7 * dayMs - 1)
      : new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      label: weekly ? bucketStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : bucketStart.toLocaleDateString("en-AU", { month: "short" }),
      start: bucketStart,
      end: bucketEnd,
      received: 0,
      expected: 0,
      overdue: 0,
      gst: 0
    };
  });

  for (const document of documents.filter((item) => item.type === "invoice" && item.status !== "cancelled" && item.status !== "draft")) {
    const issueDate = new Date(`${document.issue_date}T12:00:00`);
    if (Number.isNaN(issueDate.getTime())) continue;
    const bucket = buckets.find((item) => issueDate >= item.start && issueDate <= item.end);
    if (!bucket) continue;
    const total = Number(document.totals?.total ?? 0);
    const gst = Number(document.totals?.gst ?? 0);
    if (document.status === "paid") {
      bucket.received += total;
      bucket.gst += gst;
    } else if (overdue(document)) {
      bucket.overdue += total;
    } else {
      bucket.expected += total;
    }
  }

  return buckets.map(({ label, received, expected, overdue: late, gst }) => ({ label, received, expected, overdue: late, gst }));
}

