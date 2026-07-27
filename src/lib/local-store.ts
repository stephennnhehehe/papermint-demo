import { calculateTotals } from "./calculations";
import { normalizeLineItems } from "./line-items";
import { FREE_WEEKLY_DOCUMENT_LIMIT, freeBillingStatus, startOfLocalWeek } from "./billing";
import { documentFromRow } from "./documents";
import type {
  BillingStatus,
  CompanyRecord,
  CompanyProfile,
  Customer,
  DocumentRow,
  DocumentStatus,
  Expense,
  ExpenseReceipt,
  CreditNote,
  InventoryMovement,
  InventoryProduct,
  InvoicePayment,
  PaymentAccount,
  PaperDocument,
  ProfileRow,
  ReminderSettings,
  Vehicle,
  VehicleTrip
} from "./types";

const prefix = "papermint:local";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(`${prefix}:${key}`);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function localWeeklyUsage(userId: string) {
  const key = `document-usage:${userId}`;
  let usage = readJson<string[] | null>(key, null);
  const weekStart = startOfLocalWeek().getTime();

  if (!usage) {
    usage = localFetchDocuments(userId)
      .map((document) => document.created_at)
      .filter((createdAt) => new Date(createdAt).getTime() >= weekStart);
  }

  const currentWeek = usage.filter((createdAt) => new Date(createdAt).getTime() >= weekStart);
  writeJson(key, currentWeek);
  return currentWeek;
}

export function localFetchBillingStatus(userId: string): BillingStatus {
  return freeBillingStatus(localWeeklyUsage(userId).length);
}

export function localFetchProfile(userId: string): ProfileRow | null {
  return readJson<ProfileRow | null>(`profile:${userId}`, null);
}

export function localSaveProfile(userId: string, profile: CompanyProfile) {
  const existing = localFetchProfile(userId);
  writeJson<ProfileRow>(`profile:${userId}`, {
    id: userId,
    business_name: profile.business_name,
    email: profile.email,
    phone: profile.phone,
    abn: profile.abn,
    address: profile.address,
    logo_url: profile.logo_url,
    default_payment_methods: profile.default_payment_methods,
    default_notes: profile.default_notes,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  });
}

export function localFetchCustomers(userId: string): Customer[] {
  return readJson<Customer[]>(`customers:${userId}`, []).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

export function localFetchCompanyProfiles(userId: string): CompanyRecord[] {
  return readJson<CompanyRecord[]>(`company-profiles:${userId}`, []).sort((a, b) =>
    Number(b.is_default) - Number(a.is_default) || b.updated_at.localeCompare(a.updated_at)
  );
}

export function localUpsertCompanyProfile(
  userId: string,
  company: Partial<CompanyRecord> & { business_name: string }
): CompanyRecord {
  const companies = localFetchCompanyProfiles(userId);
  const existing = companies.find((item) => item.id === company.id);
  const saved: CompanyRecord = {
    id: company.id || crypto.randomUUID(),
    user_id: userId,
    business_name: company.business_name,
    email: company.email ?? null,
    phone: company.phone ?? null,
    abn: company.abn ?? null,
    address: company.address ?? null,
    logo_url: company.logo_url ?? null,
    is_default: Boolean(company.is_default),
    gst_registered: company.gst_registered ?? true,
    gst_accounting_basis: company.gst_accounting_basis ?? "cash",
    bas_frequency: company.bas_frequency ?? "quarterly",
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  const next = [saved, ...companies.filter((item) => item.id !== saved.id)].map((item) =>
    saved.is_default && item.id !== saved.id ? { ...item, is_default: false } : item
  );
  writeJson(`company-profiles:${userId}`, next);
  return saved;
}

export function localDeleteCompanyProfile(userId: string, id: string) {
  writeJson(
    `company-profiles:${userId}`,
    localFetchCompanyProfiles(userId).filter((company) => company.id !== id)
  );
}

export function localUpsertCustomer(
  userId: string,
  customer: Partial<Customer> & { name: string }
): Customer {
  const customers = localFetchCustomers(userId);
  const existing = customers.find((item) => item.id === customer.id);
  const saved: Customer = {
    id: customer.id || crypto.randomUUID(),
    user_id: userId,
    name: customer.name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    abn: customer.abn ?? null,
    billing_address: customer.billing_address ?? null,
    shipping_address: customer.shipping_address ?? null,
    notes: customer.notes ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(
    `customers:${userId}`,
    [saved, ...customers.filter((item) => item.id !== saved.id)]
  );
  return saved;
}

export function localDeleteCustomer(userId: string, id: string) {
  writeJson(
    `customers:${userId}`,
    localFetchCustomers(userId).filter((customer) => customer.id !== id)
  );
}

export function localFetchDocuments(userId: string): DocumentRow[] {
  return readJson<DocumentRow[]>(`documents:${userId}`, []).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

export function localFetchDocument(userId: string, id: string): PaperDocument | null {
  const row = localFetchDocuments(userId).find((document) => document.id === id);
  return row ? documentFromRow(row) : null;
}

export function localSaveDocument(userId: string, document: PaperDocument): PaperDocument {
  const documents = localFetchDocuments(userId);
  const existing = documents.find((item) => item.id === document.id);
  if (!existing) {
    const usage = localWeeklyUsage(userId);
    if (usage.length >= FREE_WEEKLY_DOCUMENT_LIMIT) {
      throw new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED");
    }
    writeJson(`document-usage:${userId}`, [...usage, now()]);
  }
  const lineItems = normalizeLineItems(document.lineItems);
  const totals = calculateTotals(
    lineItems,
    document.orderDiscount,
    document.gstEnabled,
    document.gstRate
  );
  const row: DocumentRow = {
    id: document.id || crypto.randomUUID(),
    user_id: userId,
    type: document.type,
    status: document.status,
    title: document.title,
    number: document.number,
    customer_id: document.customerId ?? null,
    company_profile_id: document.companyProfileId ?? null,
    currency: document.currency,
    issue_date: document.issueDate,
    due_date: document.dueDate || null,
    valid_until: document.validUntil || null,
    gst_enabled: document.gstEnabled,
    gst_rate: document.gstRate,
    company: document.company,
    bill_to: document.billTo,
    ship_to: document.shipTo ?? null,
    line_items: lineItems,
    order_discount: document.orderDiscount,
    notes: document.notes,
    payment_methods: document.paymentMethods,
    logo_url: document.logoUrl,
    totals,
    converted_from_quote_id: document.convertedFromQuoteId ?? null,
    sent_at: document.sentAt ?? (document.status === "sent" ? now() : existing?.sent_at ?? null),
    first_viewed_at: document.firstViewedAt ?? existing?.first_viewed_at ?? null,
    accepted_at: document.acceptedAt ?? existing?.accepted_at ?? null,
    accepted_by: document.acceptedBy ?? existing?.accepted_by ?? null,
    converted_at: document.convertedAt ?? existing?.converted_at ?? null,
    paid_at: document.status === "paid" ? document.paidAt ?? existing?.paid_at ?? now() : null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(`documents:${userId}`, [row, ...documents.filter((item) => item.id !== row.id)]);
  localSyncDocumentInventory(userId, row);
  return documentFromRow(row);
}

function localSyncDocumentInventory(userId: string, document: DocumentRow) {
  if (document.type !== "invoice") return;
  const movements = localFetchInventoryMovements(userId);
  const active = ["sent", "paid", "overdue"].includes(document.status);
  const productIds = [...new Set([
    ...document.line_items.map((item) => item.productId).filter(Boolean),
    ...movements.filter((movement) => movement.source_type === "document" && movement.source_id === document.id).map((movement) => movement.product_id)
  ])] as string[];
  for (const productId of productIds) {
    const existing = movements.filter((movement) => movement.source_type === "document" && movement.source_id === document.id && movement.product_id === productId).reduce((sum, movement) => sum + movement.quantity_delta, 0);
    const desiredQuantity = document.line_items
      .filter((item) =>
        item.productId === productId &&
        item.itemType !== "return" &&
        Number(item.unitPrice) >= 0
      )
      .reduce((sum, item) => sum + Math.max(0, Number(item.quantity)), 0);
    const desired = active ? -desiredQuantity : 0;
    const difference = desired - existing;
    if (Math.abs(difference) < 0.0005) continue;
    localRecordInventoryMovement(userId, { product_id: productId, movement_type: difference < 0 ? "sale" : "reversal", quantity_delta: difference, unit_cost: 0, movement_date: document.issue_date, reference: document.number, notes: "Automatically synced from invoice", source_type: "document", source_id: document.id });
  }
}

export function localDeleteDocument(userId: string, id: string) {
  writeJson(
    `documents:${userId}`,
    localFetchDocuments(userId).filter((document) => document.id !== id)
  );
}

export function localUpdateDocumentStatus(
  userId: string,
  id: string,
  status: DocumentStatus
): DocumentRow {
  const documents = localFetchDocuments(userId);
  const existing = documents.find((document) => document.id === id);
  if (!existing) throw new Error("Document not found.");
  const timestamp = now();
  const updated: DocumentRow = {
    ...existing,
    status,
    sent_at: status === "sent" ? existing.sent_at ?? timestamp : existing.sent_at,
    paid_at: status === "paid" ? timestamp : null,
    updated_at: timestamp
  };
  writeJson(`documents:${userId}`, [updated, ...documents.filter((document) => document.id !== id)]);
  localSyncDocumentInventory(userId, updated);
  return updated;
}

export function localFetchExpenses(userId: string): Expense[] {
  return readJson<Expense[]>(`expenses:${userId}`, []).map((expense) => ({
    ...expense,
    gst_treatment: expense.gst_treatment ?? (expense.gst_claimable ? "gst" : "gst_free"),
    business_use_percent: expense.business_use_percent ?? 100,
    payment_account_id: expense.payment_account_id ?? null,
    supplier_abn: expense.supplier_abn ?? null,
    reference: expense.reference ?? null,
    vehicle_id: expense.vehicle_id ?? null
  })).sort((a, b) =>
    b.expense_date.localeCompare(a.expense_date)
  );
}

export function localUpsertExpense(
  userId: string,
  expense: Partial<Expense> & Pick<Expense, "merchant" | "expense_date" | "category" | "total_amount" | "gst_amount">
): Expense {
  const expenses = localFetchExpenses(userId);
  const existing = expenses.find((item) => item.id === expense.id);
  const saved: Expense = {
    id: expense.id ?? crypto.randomUUID(),
    user_id: userId,
    company_profile_id: expense.company_profile_id ?? null,
    merchant: expense.merchant,
    expense_date: expense.expense_date,
    category: expense.category,
    purchase_type: expense.purchase_type ?? "non_capital",
    total_amount: Number(expense.total_amount) || 0,
    gst_amount: Number(expense.gst_amount) || 0,
    gst_claimable: expense.gst_claimable ?? true,
    gst_treatment: expense.gst_treatment ?? "gst",
    business_use_percent: Math.min(100, Math.max(0, Number(expense.business_use_percent ?? 100))),
    payment_account_id: expense.payment_account_id ?? null,
    payment_method: expense.payment_method ?? null,
    supplier_abn: expense.supplier_abn ?? null,
    reference: expense.reference ?? null,
    vehicle_id: expense.vehicle_id ?? null,
    notes: expense.notes ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(`expenses:${userId}`, [saved, ...expenses.filter((item) => item.id !== saved.id)]);
  return saved;
}

export function localDeleteExpense(userId: string, id: string) {
  writeJson(`expenses:${userId}`, localFetchExpenses(userId).filter((expense) => expense.id !== id));
  writeJson(`expense-receipts:${userId}`, localFetchExpenseReceipts(userId).filter((receipt) => receipt.expense_id !== id));
}

export function localFetchExpenseReceipts(userId: string): ExpenseReceipt[] {
  return readJson<ExpenseReceipt[]>(`expense-receipts:${userId}`, []);
}

export function localSaveExpenseReceipt(userId: string, receipt: ExpenseReceipt) {
  const receipts = localFetchExpenseReceipts(userId);
  writeJson(`expense-receipts:${userId}`, [receipt, ...receipts.filter((item) => item.id !== receipt.id)]);
}

export function localDeleteExpenseReceipt(userId: string, id: string) {
  writeJson(`expense-receipts:${userId}`, localFetchExpenseReceipts(userId).filter((receipt) => receipt.id !== id));
}

export function localFetchPaymentAccounts(userId: string): PaymentAccount[] {
  return readJson<PaymentAccount[]>(`payment-accounts:${userId}`, []).sort((a, b) =>
    Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name)
  );
}

export function localUpsertPaymentAccount(
  userId: string,
  account: Partial<PaymentAccount> & Pick<PaymentAccount, "name" | "account_type">
): PaymentAccount {
  const accounts = localFetchPaymentAccounts(userId);
  const existing = accounts.find((item) => item.id === account.id);
  const saved: PaymentAccount = {
    id: account.id ?? crypto.randomUUID(),
    user_id: userId,
    company_profile_id: account.company_profile_id ?? null,
    name: account.name,
    account_type: account.account_type,
    last_four: account.last_four ?? null,
    is_default: account.is_default ?? false,
    is_active: account.is_active ?? true,
    notes: account.notes ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  const next = [saved, ...accounts.filter((item) => item.id !== saved.id)].map((item) =>
    saved.is_default && item.company_profile_id === saved.company_profile_id && item.id !== saved.id
      ? { ...item, is_default: false }
      : item
  );
  writeJson(`payment-accounts:${userId}`, next);
  return saved;
}

export function localDeletePaymentAccount(userId: string, id: string) {
  writeJson(`payment-accounts:${userId}`, localFetchPaymentAccounts(userId).filter((item) => item.id !== id));
  writeJson(`expenses:${userId}`, localFetchExpenses(userId).map((expense) =>
    expense.payment_account_id === id ? { ...expense, payment_account_id: null } : expense
  ));
}

export function localFetchInvoicePayments(userId: string, documentId: string) {
  return readJson<InvoicePayment[]>(`invoice-payments:${userId}`, [])
    .filter((item) => item.document_id === documentId)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at));
}

export function localRecordInvoicePayment(userId: string, payment: Omit<InvoicePayment, "id" | "user_id" | "entry_type" | "reverses_payment_id" | "created_at">) {
  const rows = readJson<InvoicePayment[]>(`invoice-payments:${userId}`, []);
  const saved: InvoicePayment = { ...payment, id: crypto.randomUUID(), user_id: userId, entry_type: "payment", reverses_payment_id: null, amount: Math.abs(Number(payment.amount)), created_at: now() };
  writeJson(`invoice-payments:${userId}`, [saved, ...rows]);
  localRefreshPaymentStatus(userId, payment.document_id);
  return saved;
}

export function localReverseInvoicePayment(userId: string, paymentId: string, notes = "") {
  const rows = readJson<InvoicePayment[]>(`invoice-payments:${userId}`, []);
  const original = rows.find((item) => item.id === paymentId && item.entry_type === "payment");
  if (!original) throw new Error("Payment not found.");
  if (rows.some((item) => item.reverses_payment_id === paymentId)) throw new Error("Payment already reversed.");
  const reversal: InvoicePayment = { ...original, id: crypto.randomUUID(), entry_type: "reversal", amount: -original.amount, payment_date: new Date().toISOString().slice(0, 10), notes: notes || `Reversal of ${original.reference ?? paymentId}`, reverses_payment_id: paymentId, created_at: now() };
  writeJson(`invoice-payments:${userId}`, [reversal, ...rows]);
  localRefreshPaymentStatus(userId, original.document_id);
  return reversal;
}

export function localReplaceInvoicePayment(
  userId: string,
  paymentId: string,
  payment: Pick<InvoicePayment, "amount" | "payment_date" | "payment_account_id" | "reference" | "notes">
) {
  const original = readJson<InvoicePayment[]>(`invoice-payments:${userId}`, []).find(
    (item) => item.id === paymentId && item.entry_type === "payment"
  );
  if (!original) throw new Error("Payment not found.");
  localReverseInvoicePayment(userId, paymentId, "Reversed because the payment record was edited.");
  return localRecordInvoicePayment(userId, {
    ...payment,
    document_id: original.document_id
  });
}

export function localFetchCreditNotes(userId: string, documentId: string) {
  return readJson<CreditNote[]>(`credit-notes:${userId}`, []).filter((item) => item.document_id === documentId).sort((a, b) => b.issue_date.localeCompare(a.issue_date));
}

export function localIssueCreditNote(userId: string, note: Omit<CreditNote, "id" | "user_id" | "number" | "status" | "created_at">) {
  const rows = readJson<CreditNote[]>(`credit-notes:${userId}`, []);
  const saved: CreditNote = { ...note, id: crypto.randomUUID(), user_id: userId, number: `CN${new Date().getFullYear()}${String(rows.length + 1).padStart(5, "0")}`, status: "issued", total: Math.abs(Number(note.total)), gst_amount: Math.abs(Number(note.gst_amount)), created_at: now() };
  writeJson(`credit-notes:${userId}`, [saved, ...rows]);
  if (saved.inventory_product_id && Number(saved.inventory_quantity) > 0) {
    localRecordInventoryMovement(userId, { product_id: saved.inventory_product_id, movement_type: "customer_return", quantity_delta: Number(saved.inventory_quantity), unit_cost: 0, movement_date: saved.issue_date, reference: saved.number, notes: saved.reason, source_type: "credit_note", source_id: saved.id });
  }
  localRefreshPaymentStatus(userId, note.document_id);
  return saved;
}

export function localVoidCreditNote(userId: string, creditNoteId: string) {
  const rows = readJson<CreditNote[]>(`credit-notes:${userId}`, []);
  const existing = rows.find((item) => item.id === creditNoteId && item.status === "issued");
  if (!existing) throw new Error("Credit note not found or already voided.");
  const updated: CreditNote = { ...existing, status: "void" };
  writeJson(`credit-notes:${userId}`, [updated, ...rows.filter((item) => item.id !== creditNoteId)]);
  if (existing.inventory_product_id && Number(existing.inventory_quantity) > 0) {
    localRecordInventoryMovement(userId, {
      product_id: existing.inventory_product_id,
      movement_type: "reversal",
      quantity_delta: -Number(existing.inventory_quantity),
      unit_cost: 0,
      movement_date: new Date().toISOString().slice(0, 10),
      reference: existing.number,
      notes: "Credit note voided",
      source_type: "credit_note_void",
      source_id: existing.id
    });
  }
  localRefreshPaymentStatus(userId, existing.document_id);
  return updated;
}

export function localReplaceCreditNote(
  userId: string,
  creditNoteId: string,
  note: Omit<CreditNote, "id" | "user_id" | "number" | "status" | "created_at" | "document_id">
) {
  const original = readJson<CreditNote[]>(`credit-notes:${userId}`, []).find((item) => item.id === creditNoteId);
  if (!original) throw new Error("Credit note not found.");
  localVoidCreditNote(userId, creditNoteId);
  return localIssueCreditNote(userId, { ...note, document_id: original.document_id });
}

function localRefreshPaymentStatus(userId: string, documentId: string) {
  const documents = localFetchDocuments(userId);
  const document = documents.find((item) => item.id === documentId);
  if (!document) return;
  const paid = localFetchInvoicePayments(userId, documentId).reduce((sum, item) => sum + Number(item.amount), 0);
  const credited = localFetchCreditNotes(userId, documentId).filter((item) => item.status === "issued").reduce((sum, item) => sum + Number(item.total), 0);
  const settled = paid + credited >= Math.max(0, Number(document.totals.total)) - 0.005;
  const updated = { ...document, status: settled ? "paid" as const : (document.status === "paid" ? "sent" as const : document.status), paid_at: settled ? document.paid_at ?? now() : null, updated_at: now() };
  writeJson(`documents:${userId}`, [updated, ...documents.filter((item) => item.id !== documentId)]);
}

export function localFetchInventoryProducts(userId: string) {
  return readJson<InventoryProduct[]>(`inventory-products:${userId}`, []).sort((a, b) => a.name.localeCompare(b.name));
}

export function localUpsertInventoryProduct(userId: string, product: Partial<InventoryProduct> & Pick<InventoryProduct, "name" | "sku">) {
  const rows = localFetchInventoryProducts(userId);
  const existing = rows.find((item) => item.id === product.id);
  const saved: InventoryProduct = { id: product.id ?? crypto.randomUUID(), user_id: userId, company_profile_id: product.company_profile_id ?? null, sku: product.sku, name: product.name, description: product.description ?? null, unit: product.unit ?? "each", sale_price: Number(product.sale_price) || 0, average_cost: existing?.average_cost ?? (Number(product.average_cost) || 0), quantity_on_hand: existing?.quantity_on_hand ?? 0, reorder_level: Number(product.reorder_level) || 0, gst_enabled: product.gst_enabled ?? true, track_inventory: product.track_inventory ?? true, is_active: product.is_active ?? true, created_at: existing?.created_at ?? now(), updated_at: now() };
  writeJson(`inventory-products:${userId}`, [saved, ...rows.filter((item) => item.id !== saved.id)]);
  return saved;
}

export function localFetchInventoryMovements(userId: string) {
  return readJson<InventoryMovement[]>(`inventory-movements:${userId}`, []).sort((a, b) => b.movement_date.localeCompare(a.movement_date) || b.created_at.localeCompare(a.created_at));
}

export function localRecordInventoryMovement(userId: string, movement: Omit<InventoryMovement, "id" | "user_id" | "created_at">) {
  const products = localFetchInventoryProducts(userId);
  const product = products.find((item) => item.id === movement.product_id);
  if (!product) throw new Error("Product not found.");
  const delta = Number(movement.quantity_delta);
  const cost = Math.max(0, Number(movement.unit_cost));
  const nextQty = product.quantity_on_hand + delta;
  const nextAverage = delta > 0 && cost > 0 && nextQty > 0 ? ((product.quantity_on_hand * product.average_cost) + (delta * cost)) / nextQty : product.average_cost;
  const updated = { ...product, quantity_on_hand: nextQty, average_cost: nextAverage, updated_at: now() };
  writeJson(`inventory-products:${userId}`, [updated, ...products.filter((item) => item.id !== product.id)]);
  const saved: InventoryMovement = { ...movement, quantity_delta: delta, unit_cost: cost, id: crypto.randomUUID(), user_id: userId, created_at: now() };
  writeJson(`inventory-movements:${userId}`, [saved, ...localFetchInventoryMovements(userId)]);
  return saved;
}

export function localFetchVehicles(userId: string): Vehicle[] {
  return readJson<Vehicle[]>(`vehicles:${userId}`, []).sort((a, b) =>
    Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)
  );
}

export function localUpsertVehicle(
  userId: string,
  vehicle: Partial<Vehicle> & Pick<Vehicle, "name" | "registration">
): Vehicle {
  const vehicles = localFetchVehicles(userId);
  const existing = vehicles.find((item) => item.id === vehicle.id);
  const saved: Vehicle = {
    id: vehicle.id ?? crypto.randomUUID(),
    user_id: userId,
    company_profile_id: vehicle.company_profile_id ?? null,
    name: vehicle.name,
    registration: vehicle.registration,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    year: vehicle.year ?? null,
    ownership_type: vehicle.ownership_type ?? "business",
    logbook_start_date: vehicle.logbook_start_date ?? null,
    logbook_end_date: vehicle.logbook_end_date ?? null,
    opening_odometer: vehicle.opening_odometer ?? null,
    closing_odometer: vehicle.closing_odometer ?? null,
    is_active: vehicle.is_active ?? true,
    notes: vehicle.notes ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(`vehicles:${userId}`, [saved, ...vehicles.filter((item) => item.id !== saved.id)]);
  return saved;
}

export function localDeleteVehicle(userId: string, id: string) {
  writeJson(`vehicles:${userId}`, localFetchVehicles(userId).filter((item) => item.id !== id));
  writeJson(`vehicle-trips:${userId}`, localFetchVehicleTrips(userId).filter((item) => item.vehicle_id !== id));
  writeJson(`expenses:${userId}`, localFetchExpenses(userId).map((expense) =>
    expense.vehicle_id === id ? { ...expense, vehicle_id: null } : expense
  ));
}

export function localFetchVehicleTrips(userId: string): VehicleTrip[] {
  return readJson<VehicleTrip[]>(`vehicle-trips:${userId}`, []).map((trip) => ({
    ...trip,
    business_use_percent: trip.business_use_percent ?? (trip.is_business ? 100 : 0)
  })).sort((a, b) =>
    b.start_date.localeCompare(a.start_date) || b.created_at.localeCompare(a.created_at)
  );
}

export function localUpsertVehicleTrip(
  userId: string,
  trip: Partial<VehicleTrip> & Pick<VehicleTrip, "vehicle_id" | "start_date" | "end_date" | "origin" | "destination" | "purpose" | "start_odometer" | "end_odometer">
): VehicleTrip {
  const trips = localFetchVehicleTrips(userId);
  const existing = trips.find((item) => item.id === trip.id);
  const saved: VehicleTrip = {
    id: trip.id ?? crypto.randomUUID(),
    user_id: userId,
    company_profile_id: trip.company_profile_id ?? null,
    vehicle_id: trip.vehicle_id,
    start_date: trip.start_date,
    end_date: trip.end_date,
    origin: trip.origin,
    destination: trip.destination,
    purpose: trip.purpose,
    start_odometer: Number(trip.start_odometer),
    end_odometer: Number(trip.end_odometer),
    is_business: Number(trip.business_use_percent ?? 100) > 0,
    business_use_percent: Math.min(100, Math.max(0, Number(trip.business_use_percent ?? 100))),
    driver: trip.driver ?? null,
    notes: trip.notes ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(`vehicle-trips:${userId}`, [saved, ...trips.filter((item) => item.id !== saved.id)]);
  return saved;
}

export function localDeleteVehicleTrip(userId: string, id: string) {
  writeJson(`vehicle-trips:${userId}`, localFetchVehicleTrips(userId).filter((item) => item.id !== id));
}

export function localFetchReminderSettings(userId: string): ReminderSettings {
  return readJson<ReminderSettings>(`reminders:${userId}`, {
    user_id: userId,
    enabled: false,
    before_days: [3],
    overdue_days: [3, 7, 14],
    updated_at: now()
  });
}

export function localSaveReminderSettings(
  userId: string,
  settings: Pick<ReminderSettings, "enabled" | "before_days" | "overdue_days">
) {
  const saved: ReminderSettings = { user_id: userId, ...settings, updated_at: now() };
  writeJson(`reminders:${userId}`, saved);
  return saved;
}
