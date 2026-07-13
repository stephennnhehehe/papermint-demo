import { Suspense } from "react";
import { DocumentEditor } from "@/components/documents/DocumentEditor";

export default function NewDocumentPage() {
  return (
    <Suspense>
      <DocumentEditor />
    </Suspense>
  );
}
