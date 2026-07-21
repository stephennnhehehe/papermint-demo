import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { calculateTotals, formatAud, lineGstAmount, lineTotal } from "@/lib/calculations";
import type { PaperDocument, Party } from "@/lib/types";
import { registerPdfFonts } from "./fonts";

registerPdfFonts();

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    color: "#17211b",
    fontFamily: "PaperMintSans"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6df",
    paddingBottom: 16
  },
  headerLeft: {
    width: "52%",
    paddingRight: 20
  },
  headerRight: {
    width: "42%",
    alignItems: "flex-end"
  },
  docTitle: {
    color: "#166146",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase"
  },
  docNumber: {
    marginTop: 5,
    fontSize: 22,
    fontWeight: 700
  },
  muted: {
    color: "#66736b",
    lineHeight: 1.05
  },
  logo: {
    width: 112,
    height: 56,
    objectFit: "contain"
  },
  parties: {
    flexDirection: "row",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6df",
    paddingVertical: 16
  },
  party: {
    width: "31%"
  },
  sectionLabel: {
    color: "#66736b",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 5,
    textTransform: "uppercase"
  },
  partyName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6df",
    color: "#66736b",
    fontSize: 9,
    fontWeight: 700,
    paddingBottom: 7,
    paddingTop: 16,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ef",
    paddingVertical: 7
  },
  desc: {
    width: "34%",
    paddingRight: 8
  },
  qty: {
    width: "7%",
    textAlign: "right"
  },
  unit: {
    width: "13%",
    textAlign: "right"
  },
  discountHeader: {
    width: "13%",
    color: "#66736b",
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right"
  },
  discountColumn: {
    width: "13%",
    color: "#c2384c",
    fontWeight: 700,
    textAlign: "right"
  },
  zeroDiscount: {
    color: "#66736b"
  },
  gstColumn: {
    width: "11%",
    textAlign: "right"
  },
  amount: {
    width: "22%",
    textAlign: "right",
    fontWeight: 700
  },
  negativeAmount: {
    color: "#c2384c"
  },
  totals: {
    marginTop: 16,
    marginLeft: "auto",
    width: 300
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#17211b",
    color: "white",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 5,
    fontSize: 13,
    fontWeight: 700
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 700
  },
  signature: {
    marginTop: 12,
    marginLeft: "auto",
    width: 300,
    flexDirection: "row",
    gap: 18,
    color: "#66736b",
    fontSize: 8
  },
  signatureMain: { width: 204 },
  signatureDate: { width: 78 },
  signatureLine: {
    height: 17,
    borderBottomWidth: 1,
    borderBottomColor: "#9aa59d",
    marginBottom: 4
  },
  footer: {
    flexDirection: "row",
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: "#dfe6df",
    paddingTop: 14,
    marginTop: 18
  },
  footerBlock: {
    flex: 1
  },
  branding: {
    position: "absolute",
    bottom: 18,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#eef2ef",
    paddingTop: 7,
    color: "#879189",
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center"
  },
  arabicText: {
    direction: "rtl",
    fontFamily: "PaperMintArabic",
    textAlign: "right"
  }
});

const arabicTextPattern = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/;

function userTextStyle(value: string) {
  return arabicTextPattern.test(value) ? styles.arabicText : {};
}

export function PaperMintPdf({
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
    gst: "GST", total: "Total", payment: "Payment", notes: "Notes",
    acceptedBy: "Accepted by / Authorised signature", signatureDate: "Date"
  };
  const orderDiscountLabel =
    document.orderDiscount.type === "percent" && document.orderDiscount.value > 0
      ? `${labels.discount} (${document.orderDiscount.value}%)`
      : labels.discount;

  return (
    <Document title={`${document.type}-${document.number}`}>
      <Page size="A4" style={[styles.page, showBranding ? { paddingBottom: 54 } : {}]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.docTitle}>
              {document.type === "invoice" ? (document.gstEnabled ? labels.invoice : "INVOICE") : labels.quote}
            </Text>
            <Text style={styles.docNumber}>{document.number || "DRAFT"}</Text>
            <Text style={[styles.muted, { marginTop: 5 }]}>
              {labels.issue}: {document.issueDate || "-"}
            </Text>
            <Text style={styles.muted}>
              {document.type === "invoice" ? labels.due : labels.valid}:{" "}
              {document.type === "invoice" ? document.dueDate || "-" : document.validUntil || "-"}
            </Text>
          </View>
          {document.logoUrl ? (
            <View style={styles.headerRight}>
              <Image src={document.logoUrl} style={styles.logo} />
            </View>
          ) : null}
        </View>

        <View style={styles.parties}>
          <PdfParty label={labels.from} party={document.company} />
          <PdfParty label={labels.bill} party={document.billTo} />
          {document.shipTo ? <PdfParty label={labels.ship} party={document.shipTo} /> : null}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.desc}>{labels.desc}</Text>
          <Text style={styles.qty}>{labels.qty}</Text>
          <Text style={styles.unit}>{labels.price}</Text>
          <Text style={styles.discountHeader}>{labels.itemDiscount}</Text>
          <Text style={styles.gstColumn}>{labels.gstColumn}</Text>
          <Text style={styles.amount}>{labels.amount}</Text>
        </View>

        {document.lineItems.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.desc}>
              <Text style={[{ fontWeight: 700 }, userTextStyle(item.description)]}>{item.description || "Item"}</Text>
              {item.details ? <Text style={[styles.muted, { marginTop: 2, lineHeight: 0.85 }, userTextStyle(item.details)]}>{item.details}</Text> : null}
            </View>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Text style={styles.unit}>{formatAud(item.unitPrice)}</Text>
            <Text style={item.discount.value > 0 ? styles.discountColumn : [styles.discountColumn, styles.zeroDiscount]}>
              {formatLineItemDiscount(item)}
            </Text>
            <Text style={styles.gstColumn}>
              {formatAud(lineGstAmount(item, document.lineItems, document.orderDiscount, document.gstEnabled, document.gstRate))}
            </Text>
            <Text style={lineTotal(item) < 0 ? [styles.amount, styles.negativeAmount] : styles.amount}>{formatAud(lineTotal(item))}</Text>
          </View>
        ))}

        <View wrap={false}>
          <View style={styles.totals}>
            <PdfAmount label={labels.subtotal} value={formatAud(totals.subtotal)} />
            {totals.orderDiscountTotal > 0 ? (
              <PdfAmount label={orderDiscountLabel} value={`-${formatAud(totals.orderDiscountTotal)}`} />
            ) : null}
            {document.gstEnabled ? (
              <PdfAmount label={`${labels.gst} ${document.gstRate}%`} value={formatAud(totals.gst)} />
            ) : null}
            <View style={styles.grandTotal}>
              <Text>{labels.total}</Text>
              <Text style={styles.grandTotalValue}>{formatAud(totals.total)}</Text>
            </View>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureMain}>
              <View style={styles.signatureLine} />
              <Text>{labels.acceptedBy}</Text>
            </View>
            <View style={styles.signatureDate}>
              <View style={styles.signatureLine} />
              <Text>{labels.signatureDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {document.paymentMethods ? (
            <View style={styles.footerBlock}>
              <Text style={styles.sectionLabel}>{labels.payment}</Text>
              <Text style={[styles.muted, userTextStyle(document.paymentMethods)]}>{document.paymentMethods}</Text>
            </View>
          ) : null}
          {document.notes ? (
            <View style={styles.footerBlock}>
              <Text style={styles.sectionLabel}>{labels.notes}</Text>
              <Text style={[styles.muted, userTextStyle(document.notes)]}>{document.notes}</Text>
            </View>
          ) : null}
        </View>
        {showBranding ? <Text fixed style={styles.branding}>Generated by PaperMint</Text> : null}
      </Page>
    </Document>
  );
}

function formatLineItemDiscount(item: PaperDocument["lineItems"][number]) {
  if (item.discount.value <= 0) return "0";
  return item.discount.type === "percent" ? `${item.discount.value}%` : formatAud(item.discount.value);
}

function PdfParty({ label, party }: { label: string; party: Party }) {
  const details = [party.address, party.email, party.phone, party.abn ? `ABN ${party.abn}` : ""]
    .filter(Boolean)
    .join("\n");
  return (
    <View style={styles.party}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={[styles.partyName, userTextStyle(party.name)]}>{party.name || "-"}</Text>
      <Text style={[styles.muted, userTextStyle(details)]}>{details}</Text>
    </View>
  );
}

function PdfAmount({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={{ fontWeight: 700 }}>{value}</Text>
    </View>
  );
}
