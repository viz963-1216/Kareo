import { freezeSnapshot, type KnowledgeSnapshot, type KnowledgeSnapshotRecord } from "../assessment/knowledgeSnapshot.js";
import type { KnowledgeStatusResponse } from "../types/index.js";

// 正式 Assessment 使用的 PUBLISHED Knowledge 來源（取代 B-003 的 NullKnowledgeVersionResolver）。
// 回傳 null 代表目前沒有 PUBLISHED 版本（Service 據此回 KNOWLEDGE_UNAVAILABLE）；
// 查詢失敗或逾時一律拋出例外，不得回傳空快照或假版本號。
export interface PublishedKnowledgeResolver {
  resolvePublishedKnowledge(): Promise<KnowledgeSnapshot | null>;
}

export interface PublishedKnowledgeSource {
  getCurrentPublishedStatus(): Promise<KnowledgeStatusResponse | null>;
  findPublishedSnapshotRecords(versionId: string): Promise<KnowledgeSnapshotRecord[]>;
}

export class KnowledgeVersionChangedError extends Error {}
export class KnowledgeTimeoutError extends Error {}

export interface DatabaseKnowledgeResolverOptions {
  timeoutMs?: number;
  maxAttempts?: number;
}

// 讀取順序：目前 PUBLISHED 版本 → 該版本的 PUBLISHED 紀錄 → 再確認版本沒有在途中切換。
// 若讀取期間剛好發布/撤回（版本不同），整份重讀；仍不一致則失敗，不拼湊兩個版本的內容。
export class DatabaseKnowledgeResolver implements PublishedKnowledgeResolver {
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly source: PublishedKnowledgeSource,
    options: DatabaseKnowledgeResolverOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxAttempts = options.maxAttempts ?? 2;
  }

  async resolvePublishedKnowledge(): Promise<KnowledgeSnapshot | null> {
    return withTimeout(this.load(), this.timeoutMs);
  }

  private async load(): Promise<KnowledgeSnapshot | null> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const status = await this.source.getCurrentPublishedStatus();
      if (!status) return null;
      const records = await this.source.findPublishedSnapshotRecords(status.version);
      const confirm = await this.source.getCurrentPublishedStatus();
      if (confirm?.version === status.version) {
        return freezeSnapshot({ version: status.version, records });
      }
    }
    throw new KnowledgeVersionChangedError("PUBLISHED knowledge version changed while loading");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new KnowledgeTimeoutError(`knowledge load exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 測試專用：回傳固定的合成知識快照，不代表正式 Knowledge，不得在 functions/ 組裝。
export class FakePublishedKnowledgeResolver implements PublishedKnowledgeResolver {
  constructor(private readonly snapshot: KnowledgeSnapshot | null) {}

  async resolvePublishedKnowledge(): Promise<KnowledgeSnapshot | null> {
    return this.snapshot ? freezeSnapshot(this.snapshot) : null;
  }
}
