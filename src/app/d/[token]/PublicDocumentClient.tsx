"use client";

import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { CheckCircle2, Download, Loader2, Printer } from "lucide-react";
import { Brand } from "@/components/app/Brand";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { PaperMintPdf } from "@/components/pdf/DocumentPdf";
import { acceptPublicQuote } from "@/lib/document-delivery";
import { localFetchDocument, localSaveDocument } from "@/lib/local-store";
import type { PaperDocument } from "@/lib/types";

export function PublicDocumentClient({ initialDocument, token, showBranding = true }: { initialDocument: PaperDocument | null; token: string; showBranding?: boolean }) {
  const [document, setDocument] = useState(initialDocument);
  const [acceptedBy, setAcceptedBy] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!initialDocument && token.startsWith("demo-")) {
      const id = token.slice(5);
      const demoDocument = localFetchDocument("demo-user", id);
      if (demoDocument) {
        const viewed = { ...demoDocument, firstViewedAt: demoDocument.firstViewedAt ?? new Date().toISOString() };
        localSaveDocument("demo-user", viewed);
        setDocument(viewed);
      }
    }
  }, [initialDocument, token]);

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      const blob = await pdf(<PaperMintPdf document={document} showBranding={showBranding} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${document.type}-${document.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleAccept() {
    if (!document || acceptedBy.trim().length < 2) return;
    setAccepting(true);
    setMessage("");
    try {
      await acceptPublicQuote(token, acceptedBy.trim());
      setDocument({ ...document, acceptedAt: new Date().toISOString(), acceptedBy: acceptedBy.trim() });
      setMessage("Quote accepted. The issuer has been notified in PaperMint.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to accept quote.");
    } finally {
      setAccepting(false);
    }
  }

  if (!document) return <main className="grid min-h-screen place-items-center p-6"><div className="panel max-w-md p-8 text-center"><h1 className="text-2xl font-black">Document unavailable</h1><p className="mt-2 text-sm text-[var(--muted)]">This secure link may have expired or been disabled.</p></div></main>;

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-5 sm:px-6">
      <header className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white p-3 shadow-sm">
        <Brand />
        <div className="flex gap-2">
          <button className="icon-btn" onClick={() => window.print()} title="Print" type="button"><Printer className="h-4 w-4" /></button>
          <button className="btn-primary" disabled={downloading} onClick={handleDownload} type="button">{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download</button>
        </div>
      </header>
      {document.type === "quote" ? (
        <section className="mx-auto mb-4 max-w-5xl rounded-lg border border-[#cfe4d8] bg-white p-4 shadow-sm">
          {document.acceptedAt ? (
            <div className="flex items-center gap-3 text-[var(--mint-dark)]"><CheckCircle2 className="h-5 w-5" /><div><p className="font-black">Quote accepted</p><p className="text-sm">Accepted by {document.acceptedBy || "customer"}.</p></div></div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1"><span className="label">Name of person accepting</span><input className="field" value={acceptedBy} onChange={(event) => setAcceptedBy(event.target.value)} /></label>
              <button className="btn-primary" disabled={accepting || acceptedBy.trim().length < 2} onClick={handleAccept} type="button">{accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept quote</button>
            </div>
          )}
          {message ? <p className="mt-3 text-sm font-semibold text-[var(--muted)]">{message}</p> : null}
        </section>
      ) : null}
      <div className="mx-auto max-w-5xl overflow-x-auto"><DocumentPreview document={document} showBranding={showBranding} /></div>
    </main>
  );
}
