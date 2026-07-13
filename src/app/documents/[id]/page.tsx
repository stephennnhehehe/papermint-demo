import { Suspense } from "react";
import { DocumentEditor } from "@/components/documents/DocumentEditor";

export default async function EditDocumentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <DocumentEditor documentId={id} />
    </Suspense>
  );
}
