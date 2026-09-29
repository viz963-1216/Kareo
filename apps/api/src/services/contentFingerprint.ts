import { createHash } from "node:crypto";


// Jerry 委託修正第二輪（2026-09-27，回應 Codex／J-003 對 B-008 內容綁定的審查）：
// source.contentHash 是來源 PDF／網頁的原始雜湊，不是經人工整理後的 Knowledge 內容雜湊——
// 同一來源可以對應不同的 summary／ruleData（人工整理、更正錯字、調整規則數值都不會改變來源雜湊）。
// 這裡定義獨立的「審核內容指紋」，涵蓋所有會影響政策解讀／輸出的欄位，用來判斷「這是不是同一份
// 被審核過的內容」——匯入的冪等判斷與核准前的內容綁定檢查都必須用這個指紋，不能只看 contentHash。
//
// 涵蓋欄位（會影響政策解讀／輸出）：
//   sourceId／sourceUrl（來源身分與來源本身）、title、category、jurisdiction、
//   publishedAt／effectiveFrom／effectiveTo（適用與有效期間）、rawText（摘錄正文）、
//   summary（人工摘要）、ruleData（規則資料，補助金額／比例等實質內容）。
//
// 明確排除的純稽核欄位（不影響內容本身，只記錄「什麼時候做了什麼」）：
//   fetchedAt（抓取時間）、lastVerifiedAt（最後確認時間）——同一份內容重新確認一次日期會變，
//   但內容沒有變；id／createdAt／updatedAt／status／version（資料庫紀錄的生命週期欄位，不是
//   審核當下的內容本身）；packId／packRecordId（內容包的匯入識別，不是內容）。
export interface FingerprintableContent {
  sourceId: string;
  sourceUrl: string;
  title: string;
  category: string;
  jurisdiction: string;
  publishedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  rawText: string;
  summary: string;
  ruleData: Record<string, unknown>;
}

// 物件 key 次序正規化：遞迴排序物件的 key，讓「只調整 key 次序、值不變」的輸入得到相同指紋。
// 陣列次序刻意保留（不任意排序）——ruleData 裡的陣列次序是否有語義視內容而定，不能假設「排序後
// 比較」是安全的；本函式只處理物件 key 次序，不動陣列元素順序。
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function computeContentFingerprint(content: FingerprintableContent): string {
  const canonical = canonicalize({
    sourceId: content.sourceId,
    sourceUrl: content.sourceUrl,
    title: content.title,
    category: content.category,
    jurisdiction: content.jurisdiction,
    publishedAt: content.publishedAt,
    effectiveFrom: content.effectiveFrom,
    effectiveTo: content.effectiveTo,
    rawText: content.rawText,
    summary: content.summary,
    ruleData: content.ruleData,
  });
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}
