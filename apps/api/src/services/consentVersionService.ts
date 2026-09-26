// TASK-B-011a：依 contracts/legal/consent-versions.json（Jerry 維護的 Contract，本檔只讀取，
// 不修改）判斷一組 disclaimer/privacy/terms 版本組合目前是否為 ACTIVE。
//
// 依賴注入邊界：Service 層只依賴 ConsentVersionChecker 介面（同 aiAdapter / knowledgeVersionResolver
// 的設計），測試可以用 FakeConsentVersionChecker 指定任意組合，不受真實檔案目前內容影響
// （目前真實檔案沒有任何 ACTIVE 組合，見下方 RealConsentVersionChecker 說明）。
//
// 用 createRequire 讀 JSON，不用 ESM 的 `import ... with { type: "json" }`：純 Node 執行編譯後的
// dist 需要那個語法才能載入 JSON，但 esbuild bundler（Netlify）跟 Vitest 的轉譯都會悄悄放行，
// 造成「測試全過、CI 也過，正式部署才炸」的落差（跟 B-004 的 event.pathParameters 是同一類問題）。
// require() 讀 JSON 是 Node 原生就支援的行為，esbuild 也能正確打包，兩邊都不會出錯。
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const consentVersionsData = require("../../../../contracts/legal/consent-versions.json") as ConsentVersionsFile;

export interface ConsentVersionEntry {
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  status: string;
}

interface ConsentVersionsFile {
  versions: ConsentVersionEntry[];
}

const DRAFT_SUFFIX = "-draft";

// -draft 結尾的版本一律視為未核准，即使 status 誤標成 ACTIVE 也要擋下（雙重保險，不信任單一欄位）。
function isDraftVersion(v: string): boolean {
  return v.endsWith(DRAFT_SUFFIX);
}

export function isActiveComboAmong(
  entries: readonly ConsentVersionEntry[],
  disclaimerVersion: string,
  privacyVersion: string,
  termsVersion: string
): boolean {
  if (isDraftVersion(disclaimerVersion) || isDraftVersion(privacyVersion) || isDraftVersion(termsVersion)) {
    return false;
  }

  return entries.some(
    (entry) =>
      entry.status === "ACTIVE" &&
      entry.disclaimerVersion === disclaimerVersion &&
      entry.privacyVersion === privacyVersion &&
      entry.termsVersion === termsVersion
  );
}

export interface ConsentVersionChecker {
  isActive(disclaimerVersion: string, privacyVersion: string, termsVersion: string): boolean;
  hasAnyActive(): boolean;
}

// 正式環境使用。已知現況：目前 contracts/legal/consent-versions.json 只有一筆 DRAFT
// （版本號帶 -draft 後綴），沒有任何 ACTIVE 組合，代表法務文案核准前，正式環境本來就不會有任何
// Consent 通過驗證。這是刻意設計，不是本 Task 的 Bug，見 PR Known Issues。
export class RealConsentVersionChecker implements ConsentVersionChecker {
  private readonly entries: ConsentVersionEntry[] = consentVersionsData.versions;

  isActive(disclaimerVersion: string, privacyVersion: string, termsVersion: string): boolean {
    return isActiveComboAmong(this.entries, disclaimerVersion, privacyVersion, termsVersion);
  }

  hasAnyActive(): boolean {
    return this.entries.some((e) => e.status === "ACTIVE");
  }
}

// 測試專用：指定任意組合為 ACTIVE，不代表正式核准內容。
type ActiveEntryInput = Omit<ConsentVersionEntry, "status">;

export class FakeConsentVersionChecker implements ConsentVersionChecker {
  // status 一律視為 ACTIVE（這個類別本來的用途就是「指定哪些組合是 ACTIVE」），
  // 呼叫端不需要多餘地重複寫 status: "ACTIVE"。
  constructor(private readonly activeEntries: ActiveEntryInput[] = []) {}

  isActive(disclaimerVersion: string, privacyVersion: string, termsVersion: string): boolean {
    return isActiveComboAmong(
      this.activeEntries.map((e) => ({ ...e, status: "ACTIVE" })),
      disclaimerVersion,
      privacyVersion,
      termsVersion
    );
  }

  hasAnyActive(): boolean {
    return this.activeEntries.length > 0;
  }
}
