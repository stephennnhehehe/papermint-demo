import { calculateTotals } from "./calculations";
import { documentFromRow } from "./documents";
import {
  localDeleteCompanyProfile,
  localDeleteCustomer,
  localDeleteDocument,
  localFetchCompanyProfiles,
  localFetchCustomers,
  localFetchDocument,
  localFetchDocuments,
  localFetchProfile,
  localSaveDocument,
  localSaveProfile,
  localUpsertCompanyProfile,
  localUpsertCustomer
} from "./local-store";
import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./supabase";
import type {
  CompanyRecord,
  CompanyProfile,
  Customer,
  DocumentRow,
  PaperDocument,
  ProfileRow
} from "./types";

function shouldUseLocalStore(userId: string) {
  return userId === "demo-user" || !isSupabaseConfigured();
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (shouldUseLocalStore(userId)) return localFetchProfile(userId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileRow | null;
}

export async function saveProfile(userId: string, profile: CompanyProfile) {
  if (shouldUseLocalStore(userId)) {
    localSaveProfile(userId, profile);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    business_name: profile.business_name,
    email: profile.email,
    phone: profile.phone,
    abn: profile.abn,
    address: profile.address,
    logo_url: profile.logo_url,
    default_payment_methods: profile.default_payment_methods,
    default_notes: profile.default_notes,
    updated_at: new Date().toISOString()
  });

  if (error) throw error;
}

export async function fetchCompanyProfiles(userId: string): Promise<CompanyRecord[]> {
  if (shouldUseLocalStore(userId)) return localFetchCompanyProfiles(userId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CompanyRecord[];
}

export async function upsertCompanyProfile(
  userId: string,
  company: Partial<CompanyRecord> & { business_name: string }
): Promise<CompanyRecord> {
  if (shouldUseLocalStore(userId)) return localUpsertCompanyProfile(userId, company);
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = {
    user_id: userId,
    business_name: company.business_name,
    email: company.email ?? null,
    phone: company.phone ?? null,
    abn: company.abn ?? null,
    address: company.address ?? null,
    logo_url: company.logo_url ?? null,
    is_default: Boolean(company.is_default),
    updated_at: new Date().toISOString()
  };
  if (company.id) payload.id = company.id;

  const { data, error } = await supabase.from("company_profiles").upsert(payload).select("*").single();
  if (error) throw error;
  if (company.is_default) {
    const { error: defaultError } = await supabase
      .from("company_profiles")
      .update({ is_default: false })
      .eq("user_id", userId)
      .neq("id", data.id);
    if (defaultError) throw defaultError;
  }
  return data as CompanyRecord;
}

export async function deleteCompanyProfile(userId: string, id: string) {
  if (shouldUseLocalStore(userId)) {
    localDeleteCompanyProfile(userId, id);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("company_profiles").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchCustomers(userId: string): Promise<Customer[]> {
  if (shouldUseLocalStore(userId)) return localFetchCustomers(userId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function upsertCustomer(
  userId: string,
  customer: Partial<Customer> & { name: string }
): Promise<Customer> {
  if (shouldUseLocalStore(userId)) return localUpsertCustomer(userId, customer);
  const supabase = getSupabaseClient();
  const payload: Record<string, unknown> = {
    user_id: userId,
    name: customer.name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    abn: customer.abn ?? null,
    billing_address: customer.billing_address ?? null,
    shipping_address: customer.shipping_address ?? null,
    notes: customer.notes ?? null,
    updated_at: new Date().toISOString()
  };
  if (customer.id) payload.id = customer.id;

  const { data, error } = await supabase.from("customers").upsert(payload).select("*").single();

  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(userId: string, id: string) {
  if (shouldUseLocalStore(userId)) {
    localDeleteCustomer(userId, id);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("customers").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchDocuments(userId: string): Promise<DocumentRow[]> {
  if (shouldUseLocalStore(userId)) return localFetchDocuments(userId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function fetchDocument(userId: string, id: string): Promise<PaperDocument | null> {
  if (shouldUseLocalStore(userId)) return localFetchDocument(userId, id);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? documentFromRow(data as DocumentRow) : null;
}

export async function saveDocument(userId: string, document: PaperDocument): Promise<PaperDocument> {
  if (shouldUseLocalStore(userId)) return localSaveDocument(userId, document);
  const supabase = getSupabaseClient();
  const totals = calculateTotals(
    document.lineItems,
    document.orderDiscount,
    document.gstEnabled,
    document.gstRate
  );
  const payload: Record<string, unknown> = {
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
    updated_at: new Date().toISOString()
  };
  if (document.id) payload.id = document.id;

  const { data, error } = await supabase.from("documents").upsert(payload).select("*").single();

  if (error) throw error;
  return documentFromRow(data as DocumentRow);
}

export async function deleteDocument(userId: string, id: string) {
  if (shouldUseLocalStore(userId)) {
    localDeleteDocument(userId, id);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("documents").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
