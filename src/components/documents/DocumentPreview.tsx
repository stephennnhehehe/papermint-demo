import { calculateTotals, formatAud, lineGstAmount, lineTotal } from "@/lib/calculations";
import type { PaperDocument } from "@/lib/types";

export function DocumentPreview({
  document,
  showBranding = false
}: {
  document: PaperDocument;
  showBranding?: boolean;
}) {
  const totals = calculateTotals(
    document.lineItems,
    document.orderDiscount,
    document.gstEnabled,
    document.gstRate
  );
  const labels = {
    invoice: "TAX INVOICE", quote: "QUOTE", issue: "Issue date", due: "Due date",
    valid: "Valid until", from: "From", bill: "Bill To", ship: "Ship To",
    desc: "Description", qty: "Qty", price: "Unit price", itemDiscount: "Discount",
    gstColumn: "GST", amount: "Amount", subtotal: "Subtotal", discount: "Order discount",
    gst: "GST", total: "Total", notes: "Notes", payment: "Payment",
    acceptedBy: "Accepted by / Authorised signature", signatureDate: "Date"
  };
  const orderDiscountLabel =
    document.orderDiscount.type === "percent" && document.orderDiscount.value > 0
      ? `${labels.discount} (${document.orderDiscount.value}%)`
      : labels.discount;

  return (
    <div className="print-page mx-auto flex min-h-[1120px] w-full max-w-[794px] flex-col rounded-lg border border-[var(--line)] bg-white p-6 text-left text-[#17211b] shadow-sm sm:p-8" dir="ltr" lang="en">
      <div className="flex min-h-16 flex-col justify-between gap-4 border-b border-[#dfe6df] pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-[var(--mint-dark)]">
            {document.type === "invoice" ? (document.gstEnabled ? labels.invoice : "INVOICE") : labels.quote}
          </p>
          <h2 className="mt-1 break-words text-2xl font-black tracking-normal">
            {document.number || "DRAFT"}
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#66736b]">
            {labels.issue}: {document.issueDate || "-"}
            <br />
            {document.type === "invoice" ? labels.due : labels.valid}:{" "}
            {document.type === "invoice" ? document.dueDate || "-" : document.validUntil || "-"}
          </p>
        </div>
        {document.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Company logo" className="h-16 max-w-36 object-contain" src={document.logoUrl} />
        ) : null}
      </div>

      <div className="grid gap-4 border-b border-[#dfe6df] py-4 md:grid-cols-3">
        <PartyBlock label={labels.from} party={document.company} />
        <PartyBlock label={labels.bill} party={document.billTo} />
        {document.shipTo ? <PartyBlock label={labels.ship} party={document.shipTo} /> : null}
      </div>

      <div className="overflow-hidden py-4">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#dfe6df] text-xs uppercase text-[#66736b]">
              <th className="w-[34%] py-2 pr-2">{labels.desc}</th>
              <th className="w-[7%] px-1 text-right">{labels.qty}</th>
              <th className="w-[14%] px-1 text-right">{labels.price}</th>
              <th className="w-[13%] px-1 text-right">{labels.itemDiscount}</th>
              <th className="w-[11%] px-1 text-right">{labels.gstColumn}</th>
              <th className="w-[21%] py-2 pl-1 text-right">{labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {document.lineItems.map((item) => (
              <tr className="border-b border-[#eef2ef]" key={item.id}>
                <td className="py-2 pr-2 align-top">
                  <p className="break-words font-black" dir="auto">{item.description || "Item"}</p>
                  {item.details ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-4 text-[#66736b]" dir="auto">
                      {item.details}
                    </p>
                  ) : null}
                </td>
                <td className="px-1 py-2 text-right align-top">{item.quantity}</td>
                <td className="px-1 py-2 text-right align-top">{formatAud(item.unitPrice)}</td>
                <td
                  className={`px-1 py-2 text-right align-top font-bold ${
                    item.discount.value > 0 ? "text-[var(--rose)]" : "text-[#66736b]"
                  }`}
                >
                  {formatLineItemDiscount(item)}
                </td>
                <td className="px-1 py-2 text-right align-top">
                  {formatAud(lineGstAmount(item, document.lineItems, document.orderDiscount, document.gstEnabled, document.gstRate))}
                </td>
                <td className="py-2 pl-1 text-right align-top">
                  <p className={`font-black ${lineTotal(item) < 0 ? "text-[var(--rose)]" : ""}`}>{formatAud(lineTotal(item))}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto grid w-full max-w-sm gap-1.5 text-xs">
        <AmountRow label={labels.subtotal} value={formatAud(totals.subtotal)} />
        {totals.orderDiscountTotal > 0 ? (
          <AmountRow label={orderDiscountLabel} value={`-${formatAud(totals.orderDiscountTotal)}`} />
        ) : null}
        {document.gstEnabled ? (
          <AmountRow label={`${labels.gst} ${document.gstRate}%`} value={formatAud(totals.gst)} />
        ) : null}
        <div className="mt-1 flex items-center justify-between rounded-lg bg-[#17211b] px-3 py-2 text-white">
          <span className="font-black">{labels.total}</span>
          <span className="text-lg font-black tracking-normal">{formatAud(totals.total)}</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_96px] gap-4 text-[10px] text-[#66736b]">
          <div>
            <div className="h-7 border-b border-[#9aa59d]" />
            <span>{labels.acceptedBy}</span>
          </div>
          <div>
            <div className="h-7 border-b border-[#9aa59d]" />
            <span>{labels.signatureDate}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[#dfe6df] pt-4 md:grid-cols-2">
        {document.paymentMethods ? (
          <TextBlock label={labels.payment} value={document.paymentMethods} />
        ) : null}
        {document.notes ? <TextBlock label={labels.notes} value={document.notes} /> : null}
      </div>
      {showBranding ? (
        <div className="mt-auto border-t border-[#eef2ef] pt-5 text-center text-[10px] font-bold text-[#879189]">
          Generated by PaperMint
        </div>
      ) : null}
    </div>
  );
}

function formatLineItemDiscount(item: PaperDocument["lineItems"][number]) {
  if (item.discount.value <= 0) return "0";
  return item.discount.type === "percent" ? `${item.discount.value}%` : formatAud(item.discount.value);
}

function PartyBlock({ label, party }: { label: string; party: PaperDocument["company"] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-black uppercase tracking-normal text-[#66736b]">{label}</p>
      <p className="break-words text-base font-black" dir="auto">{party.name || "-"}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#66736b]" dir="auto">
        {[party.address, party.email, party.phone, party.abn ? `ABN ${party.abn}` : ""]
          .filter(Boolean)
          .join("\n")}
      </p>
    </div>
  );
}

function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="font-semibold text-[#66736b]">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-normal text-[#66736b]">{label}</p>
      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[#66736b]" dir="auto">{value}</p>
    </div>
  );
}
