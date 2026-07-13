import type { DocumentStatus } from "@/lib/types";

const classes: Record<DocumentStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
  cancelled: "bg-zinc-100 text-zinc-600"
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`status-pill ${classes[status]}`}>{status}</span>;
}
