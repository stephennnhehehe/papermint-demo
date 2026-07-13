import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatAud } from "@/lib/calculations";
import { registerPdfFonts } from "./fonts";

registerPdfFonts();

export type FiscalReportRow = {
  period: string;
  invoiceCount: number;
  revenue: number;
};

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 10,
    color: "#17211b",
    fontFamily: "PaperMintSans"
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 8
  },
  subtitle: {
    color: "#66736b",
    marginBottom: 24
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eae4",
    paddingVertical: 10
  },
  header: {
    color: "#66736b",
    fontWeight: 700,
    textTransform: "uppercase"
  },
  period: {
    width: "45%"
  },
  count: {
    width: "20%",
    textAlign: "right"
  },
  revenue: {
    width: "35%",
    textAlign: "right"
  },
  total: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "#17211b",
    color: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 700
  }
});

export function FiscalReportPdf({
  title,
  subtitle,
  rows
}: {
  title: string;
  subtitle: string;
  rows: FiscalReportRow[];
}) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalInvoices = rows.reduce((sum, row) => sum + row.invoiceCount, 0);

  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={[styles.row, styles.header]}>
          <Text style={styles.period}>Period</Text>
          <Text style={styles.count}>Paid invoices</Text>
          <Text style={styles.revenue}>Revenue</Text>
        </View>
        {rows.map((row) => (
          <View key={row.period} style={styles.row}>
            <Text style={styles.period}>{row.period}</Text>
            <Text style={styles.count}>{row.invoiceCount}</Text>
            <Text style={styles.revenue}>{formatAud(row.revenue)}</Text>
          </View>
        ))}
        <View style={styles.total}>
          <Text>Total · {totalInvoices} paid invoices</Text>
          <Text>{formatAud(totalRevenue)}</Text>
        </View>
      </Page>
    </Document>
  );
}
