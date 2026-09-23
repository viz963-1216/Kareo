// 依 tasks/TASK-B-003.md「Knowledge Version Rule」：
// 每筆 Assessment 必須記錄 knowledgeVersion，但本 Task 不實作完整 Knowledge DB（見 TASK-B-008）。
// 正式行為：有 Current Published Knowledge Version → 回傳版本；
//          沒有 Published Version → null（Service 層據此回 KNOWLEDGE_UNAVAILABLE）。
// 不得在 Production 實作中假造 KB-xxxx 版本號。
export interface PublishedKnowledgeVersionResolver {
  resolvePublishedVersion(): Promise<string | null>;
}

// TASK-B-008 提供的真實實作：查詢 Knowledge DB 目前的 PUBLISHED 版本。
// 是否要在 B-003 的 assessment.ts 正式接上這個 Resolver（取代 NullKnowledgeVersionResolver），
// 屬於跨 Task 的接線決策，本 Task 先只提供這個實作，接線留待另行確認（見 TASK-B-008 PR 說明）。
export class DatabaseKnowledgeVersionResolver implements PublishedKnowledgeVersionResolver {
  constructor(private readonly repo: { getCurrentPublishedStatus(): Promise<{ version: string } | null> }) {}

  async resolvePublishedVersion(): Promise<string | null> {
    const status = await this.repo.getCurrentPublishedStatus();
    return status?.version ?? null;
  }
}

// 目前 Knowledge DB（TASK-B-008）尚未實作，Production 環境沒有任何管道可以
// 產生「真正已審核發布」的 Knowledge Version，因此本 Resolver 一律回傳 null，
// 讓 Assessment 依規則回 KNOWLEDGE_UNAVAILABLE，而不是假造一個版本號。
// TASK-B-008 完成後，應改接真實的 Knowledge DB Resolver。
export class NullKnowledgeVersionResolver implements PublishedKnowledgeVersionResolver {
  async resolvePublishedVersion(): Promise<string | null> {
    return null;
  }
}

// 測試專用：回傳固定的測試版本號，不代表正式 Knowledge。
export class FakePublishedKnowledgeVersionResolver implements PublishedKnowledgeVersionResolver {
  constructor(private readonly version: string | null = "KB-TEST-001") {}

  async resolvePublishedVersion(): Promise<string | null> {
    return this.version;
  }
}
