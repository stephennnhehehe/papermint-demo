import { calculateTotals } from "./calculations";
import { FREE_WEEKLY_DOCUMENT_LIMIT, freeBillingStatus, startOfLocalWeek } from "./billing";
import { documentFromRow } from "./documents";
import type {
  BillingStatus,
  CompanyRecord,
  CompanyProfile,
  Customer,
  DocumentRow,
  PaperDocument,
  ProfileRow
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
  const totals = calculateTotals(
    document.lineItems,
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
    currency: document.currency,
    issue_date: document.issueDate,
    due_date: document.dueDate || null,
    valid_until: document.validUntil || null,
    gst_enabled: document.gstEnabled,
    gst_rate: document.gstRate,
    company: document.company,
    bill_to: document.billTo,
    ship_to: document.shipTo ?? null,
    line_items: document.lineItems,
    order_discount: document.orderDiscount,
    notes: document.notes,
    payment_methods: document.paymentMethods,
    logo_url: document.logoUrl,
    totals,
    converted_from_quote_id: document.convertedFromQuoteId ?? null,
    created_at: existing?.created_at ?? now(),
    updated_at: now()
  };
  writeJson(`documents:${userId}`, [row, ...documents.filter((item) => item.id !== row.id)]);
  return documentFromRow(row);
}

export function localDeleteDocument(userId: string, id: string) {
  writeJson(
    `documents:${userId}`,
    localFetchDocuments(userId).filter((document) => document.id !== id)
  );
}
