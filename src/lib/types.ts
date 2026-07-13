export type DocumentType = "invoice" | "quote";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export type DiscountType = "percent" | "fixed";

export type Discount = {
  type: DiscountType;
  value: number;
};

export type Party = {
  name: string;
  email: string;
  phone: string;
  abn: string;
  address: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  abn: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyRecord = {
  id: string;
  user_id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  abn: string | null;
  address: string | null;
  logo_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type LineItem = {
  id: string;
  description: string;
  details: string;
  quantity: number;
  unitPrice: number;
  gstEnabled?: boolean;
  discount: Discount;
};

export type CompanyProfile = {
  business_name: string;
  email: string;
  phone: string;
  abn: string;
  address: string;
  logo_url: string;
  default_payment_methods: string;
  default_notes: string;
};

export type PaperDocument = {
  id?: string;
  userId?: string;
  type: DocumentType;
  status: DocumentStatus;
  title: string;
  number: string;
  customerId?: string | null;
  currency: "AUD";
  issueDate: string;
  dueDate: string;
  validUntil: string;
  gstEnabled: boolean;
  gstRate: number;
  company: Party;
  billTo: Party;
  shipTo?: Party | null;
  lineItems: LineItem[];
  orderDiscount: Discount;
  notes: string;
  paymentMethods: string;
  logoUrl: string;
  convertedFromQuoteId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Totals = {
  subtotalBeforeDiscount: number;
  lineDiscountTotal: number;
  subtotal: number;
  orderDiscountTotal: number;
  taxableAmount: number;
  gst: number;
  total: number;
};

export type DocumentRow = {
  id: string;
  user_id: string;
  type: DocumentType;
  status: DocumentStatus;
  title: string;
  number: string;
  customer_id: string | null;
  currency: "AUD";
  issue_date: string;
  due_date: string | null;
  valid_until: string | null;
  gst_enabled: boolean;
  gst_rate: number;
  company: Party;
  bill_to: Party;
  ship_to: Party | null;
  line_items: LineItem[];
  order_discount: Discount;
  notes: string | null;
  payment_methods: string | null;
  logo_url: string | null;
  totals: Totals;
  converted_from_quote_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  address: string | null;
  logo_url: string | null;
  default_payment_methods: string | null;
  default_notes: string | null;
  created_at: string;
  updated_at: string;
};
