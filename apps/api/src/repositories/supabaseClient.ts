import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors/AppError.js";

let cachedClient: SupabaseClient | null = null;

// Server-side only：使用 Service Role Key，絕不可暴露給前端。
// 依 tasks/TASK-B-002.md Supabase Rule，僅供 Repository 層存取資料庫使用。
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    // 設定缺漏只寫進 function log（不含值）；回應沿用一般 INTERNAL_ERROR 文案，不向使用者透露環境變數名稱（J-003）。
    console.error("Supabase 尚未設定，請確認 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 環境變數。");
    throw new AppError("INTERNAL_ERROR", "系統發生錯誤，請稍後再試。");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
