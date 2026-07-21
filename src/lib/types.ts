export type DocumentType = "invoice" | "quote";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export type DiscountType = "percent" | "fixed";

export type BillingPlan = "free" | "weekly" | "monthly" | "lifetime";

export type BillingStatus = {
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
  documentsUsed: number;
  documentsLimit: number | null;
  weekStartsAt: string;
  isPaid: boolean;
  showBranding: boolean;
};

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
  gst_registered: boolean;
  gst_accounting_basis: "cash" | "accrual";
  bas_frequency: "monthly" | "quarterly" | "annual";
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
  companyProfileId?: string | null;
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
  sentAt?: string | null;
  firstViewedAt?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  convertedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Totals = {
  subtotalBeforeDiscount: number;
  lineDiscountTotal: number;
  returnsTotal: number;
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
  company_profile_id: string | null;
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
  sent_at: string | null;
  first_viewed_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  converted_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseCategory =
  | "inventory"
  | "materials"
  | "fuel"
  | "software"
  | "phone"
  | "marketing"
  | "professional_services"
  | "travel"
  | "office"
  | "other";

export type Expense = {
  id: string;
  user_id: string;
  company_profile_id: string | null;
  merchant: string;
  expense_date: string;
  category: ExpenseCategory;
  purchase_type: "capital" | "non_capital";
  total_amount: number;
  gst_amount: number;
  gst_claimable: boolean;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseReceipt = {
  id: string;
  user_id: string;
  expense_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  signed_url?: string | null;
};

export type ReminderSettings = {
  user_id: string;
  enabled: boolean;
  before_days: number[];
  overdue_days: number[];
  updated_at: string;
};

export type BasSummary = {
  periodStart: string;
  periodEnd: string;
  accountingBasis: "cash" | "accrual";
  g1TotalSales: number;
  g10CapitalPurchases: number;
  g11NonCapitalPurchases: number;
  g11TradingStockPurchases: number;
  gstOnSales1A: number;
  gstOnPurchases1B: number;
  netGst: number;
  returnsLosses: number;
  returnGstAdjustments: number;
};

export type ReturnLossRecord = {
  documentId: string;
  documentNumber: string;
  date: string;
  customer: string;
  companyProfileId: string | null;
  description: string;
  details: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstAdjustment: number;
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
