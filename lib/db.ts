import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns a server-side Supabase client, or null if Supabase isn't configured. */
export function getDb(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export async function logTurn(row: {
  session_id: string;
  direction: "sr-ru" | "ru-sr";
  source_text: string;
  translation: string;
  assist: unknown;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { error } = await db.from("turns").insert(row);
  if (error) console.error("supabase insert failed:", error.message);
}
