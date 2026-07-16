import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./supabase";
import { localDeleteExpenseReceipt, localSaveExpenseReceipt } from "./local-store";
import type { ExpenseReceipt } from "./types";

export async function uploadLogo(file: File, userId: string): Promise<string> {
  if (userId === "demo-user" || !isSupabaseConfigured()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const supabase = getSupabaseClient();
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("papermint-logos").upload(path, file, {
    cacheControl: "31536000",
    upsert: true
  });

  if (error) throw error;

  const {
    data: { publicUrl }
  } = supabase.storage.from("papermint-logos").getPublicUrl(path);

  return publicUrl;
}

export async function uploadExpenseReceipt(file: File, userId: string, expenseId: string): Promise<ExpenseReceipt> {
  if (userId === "demo-user" || !isSupabaseConfigured()) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const receipt: ExpenseReceipt = {
      id: crypto.randomUUID(), user_id: userId, expense_id: expenseId,
      storage_path: dataUrl, signed_url: dataUrl, file_name: file.name,
      mime_type: file.type, file_size: file.size, created_at: new Date().toISOString()
    };
    localSaveExpenseReceipt(userId, receipt);
    return receipt;
  }

  const supabase = getSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${expenseId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("papermint-receipts").upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from("expense_receipts").insert({
    user_id: userId, expense_id: expenseId, storage_path: path, file_name: file.name,
    mime_type: file.type || null, file_size: file.size
  }).select("*").single();
  if (error) throw error;
  const { data: signed } = await supabase.storage.from("papermint-receipts").createSignedUrl(path, 3600);
  return { ...data, signed_url: signed?.signedUrl ?? null } as ExpenseReceipt;
}

export async function deleteExpenseReceipt(receipt: ExpenseReceipt, userId: string) {
  if (userId === "demo-user" || !isSupabaseConfigured()) {
    localDeleteExpenseReceipt(userId, receipt.id);
    return;
  }
  const supabase = getSupabaseClient();
  const { error: storageError } = await supabase.storage.from("papermint-receipts").remove([receipt.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("expense_receipts").delete().eq("id", receipt.id).eq("user_id", userId);
  if (error) throw error;
}
