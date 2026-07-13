import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./supabase";

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
