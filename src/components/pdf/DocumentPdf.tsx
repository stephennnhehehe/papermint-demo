import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { calculateTotals, formatAud, lineGstAmount, lineTotal } from "@/lib/calculations";
import type { Language } from "@/lib/i18n";
import type { PaperDocument, Party } from "@/lib/types";
import { registerPdfFonts } from "./fonts";

registerPdfFonts();

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 10,
    color: "#17211b",
    fontFamily: "PaperMintSans"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6df",
    paddingBottom: 28
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
    marginTop: 8,
    fontSize: 26,
    fontWeight: 700
  },
  muted: {
    color: "#66736b",
    lineHeight: 1.5
  },
  logo: {
    width: 112,
    height: 56,
    objectFit: "contain"
  },
  logoPlaceholder: {
    width: 112,
    height: 56,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#dfe6df",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    color: "#66736b",
    fontWeight: 700
  },
  parties: {
    flexDirection: "row",
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#dfe6df",
    paddingVertical: 28
  },
  party: {
    width: "31%"
  },
  sectionLabel: {
    color: "#66736b",
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 8,
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
    paddingBottom: 10,
    paddingTop: 28,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ef",
    paddingVertical: 14
  },
  desc: {
    width: "30%",
    paddingRight: 8
  },
  qty: {
    width: "8%",
    textAlign: "right"
  },
  unit: {
    width: "14%",
    textAlign: "right"
  },
  discountHeader: {
    width: "14%",
    color: "#66736b",
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right"
  },
  discountColumn: {
    width: "14%",
    color: "#c2384c",
    fontWeight: 700,
    textAlign: "right"
  },
  zeroDiscount: {
    color: "#66736b"
  },
  gstColumn: {
    width: "12%",
    textAlign: "right"
  },
  amount: {
    width: "22%",
    textAlign: "right",
    fontWeight: 700
  },
  totals: {
    marginTop: 28,
    marginLeft: "auto",
    width: 300
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#17211b",
    color: "white",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    fontSize: 13,
    fontWeight: 700
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 700
  },
  footer: {
    flexDirection: "row",
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: "#dfe6df",
    paddingTop: 24,
    marginTop: 32
  },
  footerBlock: {
    flex: 1
  }
});

export function PaperMintPdf({
  document,
  language
}: {
  document: PaperDocument;
  language: Language;
}) {
  const totals = calculateTotals(
    document.lineItems,
    document.orderDiscount,
    document.gstEnabled,
    document.gstRate
  );
  const labels =
    language === "zh"
      ? {
          invoice: "TAX INVOICE",
          quote: "QUOTE",
          issue: "日期",
          due: "付款期限",
          valid: "有效期至",
          from: "From",
          bill: "Bill To",
          ship: "Ship To",
          desc: "描述",
          qty: "数量",
          price: "单价",
          itemDiscount: "折扣",
          gstColumn: "GST",
          amount: "金额",
          subtotal: "小计",
          discount: "整单折扣",
          gst: "GST",
          total: "总计",
          payment: "付款方式",
          notes: "备注"
        }
      : {
          invoice: "TAX INVOICE",
          quote: "QUOTE",
          issue: "Issue date",
          due: "Due date",
          valid: "Valid until",
          from: "From",
          bill: "Bill To",
          ship: "Ship To",
          desc: "Description",
          qty: "Qty",
          price: "Unit",
          itemDiscount: "Discount",
          gstColumn: "GST",
          amount: "Amount",
          subtotal: "Subtotal",
          discount: "Order discount",
          gst: "GST",
          total: "Total",
          payment: "Payment",
          notes: "Notes"
        };
  const orderDiscountLabel =
    document.orderDiscount.type === "percent" && document.orderDiscount.value > 0
      ? `${labels.discount} (${document.orderDiscount.value}%)`
      : labels.discount;

  return (
    <Document title={`${document.type}-${document.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.docTitle}>
              {document.type === "invoice" ? labels.invoice : labels.quote}
            </Text>
            <Text style={styles.docNumber}>{document.number || "DRAFT"}</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              {labels.issue}: {document.issueDate || "-"}
            </Text>
            <Text style={styles.muted}>
              {document.type === "invoice" ? labels.due : labels.valid}:{" "}
              {document.type === "invoice" ? document.dueDate || "-" : document.validUntil || "-"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {document.logoUrl ? (
              <Image src={document.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text>PaperMint</Text>
              </View>
            )}
          </View>
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
              <Text style={{ fontWeight: 700 }}>{item.description || "Item"}</Text>
              {item.details ? <Text style={[styles.muted, { marginTop: 4 }]}>{item.details}</Text> : null}
            </View>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Text style={styles.unit}>{formatAud(item.unitPrice)}</Text>
            <Text style={item.discount.value > 0 ? styles.discountColumn : [styles.discountColumn, styles.zeroDiscount]}>
              {formatLineItemDiscount(item)}
            </Text>
            <Text style={styles.gstColumn}>
              {formatAud(lineGstAmount(item, document.lineItems, document.orderDiscount, document.gstEnabled, document.gstRate))}
            </Text>
            <Text style={styles.amount}>{formatAud(lineTotal(item))}</Text>
          </View>
        ))}

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

        <View style={styles.footer}>
          {document.paymentMethods ? (
            <View style={styles.footerBlock}>
              <Text style={styles.sectionLabel}>{labels.payment}</Text>
              <Text style={styles.muted}>{document.paymentMethods}</Text>
            </View>
          ) : null}
          {document.notes ? (
            <View style={styles.footerBlock}>
              <Text style={styles.sectionLabel}>{labels.notes}</Text>
              <Text style={styles.muted}>{document.notes}</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

function formatLineItemDiscount(item: PaperDocument["lineItems"][number]) {
  if (item.discount.value <= 0) return "0";
  return item.discount.type === "percent" ? `${item.discount.value}%` : formatAud(item.discount.value);
}

function PdfParty({ label, party }: { label: string; party: Party }) {
  return (
    <View style={styles.party}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name || "-"}</Text>
      <Text style={styles.muted}>
        {[party.address, party.email, party.phone, party.abn ? `ABN ${party.abn}` : ""]
          .filter(Boolean)
          .join("\n")}
      </Text>
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
