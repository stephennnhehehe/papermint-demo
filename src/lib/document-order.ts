import type { DocumentRow } from "./types";

export function compareDocumentsByIssueDateDesc(a: DocumentRow, b: DocumentRow) {
  return (
    b.issue_date.localeCompare(a.issue_date) ||
    b.updated_at.localeCompare(a.updated_at) ||
    b.number.localeCompare(a.number)
  );
}

