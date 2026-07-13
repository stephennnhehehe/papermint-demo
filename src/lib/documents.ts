import type {
  CompanyRecord,
  CompanyProfile,
  Customer,
  Discount,
  DocumentRow,
  DocumentType,
  LineItem,
  PaperDocument,
  Party
} from "./types";

const today = () => new Date().toISOString().slice(0, 10);

export const emptyParty: Party = {
  name: "",
  email: "",
  phone: "",
  abn: "",
  address: ""
};

export const defaultCompanyProfile: CompanyProfile = {
  business_name: "",
  email: "",
  phone: "",
  abn: "",
  address: "",
  logo_url: "",
  default_payment_methods:
    "Bank transfer\nAccount name: Your business\nBSB: 000-000\nAccount: 00000000",
  default_notes: "Thank you for your business."
};

export function createLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    details: "",
    quantity: 1,
    unitPrice: 0,
    gstEnabled: true,
    discount: {
      type: "percent",
      value: 0
    }
  };
}

export function companyToParty(profile?: Partial<CompanyProfile> | null): Party {
  return {
    name: profile?.business_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    abn: profile?.abn ?? "",
    address: profile?.address ?? ""
  };
}

export function customerToParty(customer: Customer): Party {
  return {
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    abn: customer.abn ?? "",
    address: customer.billing_address ?? ""
  };
}

export function customerToShipParty(customer: Customer): Party {
  return {
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    abn: customer.abn ?? "",
    address: customer.shipping_address ?? customer.billing_address ?? ""
  };
}

export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function sanitizeDocumentNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 24);
}

export function generateDocumentNumber(
  _customerName: string,
  type: DocumentType,
  existingDocuments: Array<Pick<DocumentRow, "number" | "type" | "issue_date">> = [],
  issueDate = today()
): string {
  const prefix = type === "invoice" ? "INV" : "QT";
  const yyyymmdd = issueDate.replace(/-/g, "");
  const matcher = new RegExp(`^${prefix}${yyyymmdd}(\\d{3})$`);
  const maxSequence = existingDocuments
    .filter((document) => document.type === type)
    .reduce((max, document) => {
      const match = document.number.match(matcher);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
  return `${prefix}${yyyymmdd}${String(maxSequence + 1).padStart(3, "0")}`;
}

export function createEmptyDocument(
  type: DocumentType,
  profile: Partial<CompanyProfile> | null = null
): PaperDocument {
  const issueDate = today();
  return {
    type,
    status: "draft",
    title: type === "invoice" ? "TAX INVOICE" : "QUOTE",
    number: generateDocumentNumber("", type),
    currency: "AUD",
    issueDate,
    dueDate: addDays(issueDate, 14),
    validUntil: addDays(issueDate, 30),
    gstEnabled: true,
    gstRate: 10,
    company: companyToParty(profile),
    billTo: { ...emptyParty },
    shipTo: null,
    lineItems: [createLineItem()],
    orderDiscount: {
      type: "percent",
      value: 0
    },
    notes: profile?.default_notes ?? defaultCompanyProfile.default_notes,
    paymentMethods:
      profile?.default_payment_methods ?? defaultCompanyProfile.default_payment_methods,
    logoUrl: profile?.logo_url ?? "",
    convertedFromQuoteId: null
  };
}

export function documentFromRow(row: DocumentRow): PaperDocument {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    title: row.title,
    number: row.number,
    customerId: row.customer_id,
    currency: row.currency,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? "",
    validUntil: row.valid_until ?? "",
    gstEnabled: row.gst_enabled,
    gstRate: row.gst_rate,
    company: row.company,
    billTo: row.bill_to,
    shipTo: row.ship_to,
    lineItems: row.line_items?.length
      ? row.line_items.map((item) => ({ ...item, gstEnabled: item.gstEnabled ?? true }))
      : [createLineItem()],
    orderDiscount: row.order_discount,
    notes: row.notes ?? "",
    paymentMethods: row.payment_methods ?? "",
    logoUrl: row.logo_url ?? "",
    convertedFromQuoteId: row.converted_from_quote_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function companyRecordToParty(company: CompanyRecord): Party {
  return {
    name: company.business_name,
    email: company.email ?? "",
    phone: company.phone ?? "",
    abn: company.abn ?? "",
    address: company.address ?? ""
  };
}

export function statusForDueDate(
  status: PaperDocument["status"],
  dueDate: string
): PaperDocument["status"] {
  if (status === "paid" || status === "cancelled") return status;
  if (!dueDate) return status;
  return new Date(`${dueDate}T23:59:59`) < new Date() ? "overdue" : status;
}

export function cloneDiscount(discount: Discount): Discount {
  return {
    type: discount.type,
    value: Number(discount.value) || 0
  };
}
