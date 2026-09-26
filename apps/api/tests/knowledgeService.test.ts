import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  approvePackRecords,
  approveRecords,
  getKnowledgeStatus,
  KNOWLEDGE_VERSION_ID,
  publishVersion,
  taipeiToday,
  withdrawVersion,
} from "../src/services/knowledgeService.js";
import { importContentPack, parseSourceRegistry } from "../src/services/knowledgeImportService.js";
import { InMemoryKnowledgeRepository } from "../src/repositories/inMemoryKnowledgeRepository.js";
import type { KnowledgeRecord, RawContentPack } from "../src/types/index.js";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "KREC-001",
    sourceId: "SRC-LAW-001",
    title: "長照服務對象",
    category: "ELIGIBILITY",
    jurisdiction: "TAIWAN",
    sourceUrl: "https://law.moj.gov.tw/x",
    publishedAt: "2026-06-19",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    fetchedAt: "2026-09-23T10:00:00+08:00",
    lastVerifiedAt: "2026-09-23T10:00:00+08:00",
    contentHash: "sha256:" + "a".repeat(64),
    status: "NEEDS_REVIEW",
    version: null,
    rawText: "text",
    summary: "summary",
    ruleData: {},
    createdAt: "2026-09-23T10:00:00+08:00",
    updatedAt: "2026-09-23T10:00:00+08:00",
    packId: "KP-2026-09-23-001",
    packRecordId: "KR-2026-001",
    ...overrides,
  };
}

function pack(overrides: Partial<{ status: unknown; intendedKnowledgeVersion: unknown }> = {}) {
  return { status: "APPROVED", intendedKnowledgeVersion: "KB-2026-09-24-001", ...overrides };
}

function candidate(id: string, effectiveTo: string | null = null) {
  return { id, effectiveTo };
}

describe("taipeiToday / KNOWLEDGE_VERSION_ID", () => {
  it("taipeiToday uses the Asia/Taipei date, not UTC", () => {
    // 2026-09-23 23:30 UTC = 2026-09-24 07:30 Taipei
    expect(taipeiToday(new Date("2026-09-23T23:30:00Z"))).toBe("2026-09-24");
    expect(taipeiToday(new Date("2026-09-23T02:00:00Z"))).toBe("2026-09-23");
  });

  it("KNOWLEDGE_VERSION_ID matches contracts/knowledge/content-pack.schema.json's intendedKnowledgeVersion pattern", () => {
    expect(KNOWLEDGE_VERSION_ID.test("KB-2026-09-24-001")).toBe(true);
    expect(KNOWLEDGE_VERSION_ID.test("KB-2026-9-24-001")).toBe(false);
    expect(KNOWLEDGE_VERSION_ID.test("2026-09-24-001")).toBe(false);
  });
});

describe("getKnowledgeStatus", () => {
  it("throws KNOWLEDGE_UNAVAILABLE when there is no PUBLISHED version (no fake version number)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(getKnowledgeStatus(repo)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
  });

  it("returns the published version status once one exists", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    const { versionId } = await publishVersion(repo, {
      packs: [pack()],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "B-008",
      approvedBy: "Jerry",
    });

    const status = await getKnowledgeStatus(repo);
    expect(status.version).toBe(versionId);
    expect(status.notice).toContain("1966");
  });
});

describe("approveRecords", () => {
  it("approves NEEDS_REVIEW records and reports which ids were not approved", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "NEEDS_REVIEW" }));
    repo.records.push(record({ id: "KREC-002", status: "REJECTED", packRecordId: "KR-2026-002" }));

    const result = await approveRecords(repo, ["KREC-001", "KREC-002", "KREC-DOES-NOT-EXIST"]);

    expect(result.approved).toEqual(["KREC-001"]);
    expect(result.notApproved.sort()).toEqual(["KREC-002", "KREC-DOES-NOT-EXIST"]);
  });

  it("rejects an empty or non-array recordIds", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(approveRecords(repo, [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(approveRecords(repo, "not-an-array")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("approvePackRecords (B-008-r3, J-003 H-2: approval must be bound to the reviewed content)", () => {
  it("approves only when the database's current content hash matches what the pack declares", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "NEEDS_REVIEW", contentHash: "sha256:" + "a".repeat(64) }));

    const result = await approvePackRecords(repo, [
      { dbId: "KREC-001", packRecordId: "KR-2026-001", dbContentHash: "sha256:" + "a".repeat(64), expectedContentHash: "sha256:" + "a".repeat(64) },
    ]);

    expect(result.approved).toEqual(["KREC-001"]);
    expect(result.contentMismatched).toEqual([]);
  });

  it("refuses to approve when the database content differs from what this pack approval declares (approval/import race)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    // 資料庫目前內容的雜湊是 'b'（例如核准前又被另一次匯入更正過），但這次核准請求宣稱的是 'a'。
    repo.records.push(record({ id: "KREC-001", status: "NEEDS_REVIEW", contentHash: "sha256:" + "b".repeat(64) }));

    const result = await approvePackRecords(repo, [
      { dbId: "KREC-001", packRecordId: "KR-2026-001", dbContentHash: "sha256:" + "b".repeat(64), expectedContentHash: "sha256:" + "a".repeat(64) },
    ]);

    expect(result.approved).toEqual([]);
    expect(result.contentMismatched).toEqual([{ packRecordId: "KR-2026-001", dbId: "KREC-001" }]);
    expect(repo.records[0].status).toBe("NEEDS_REVIEW"); // 完全未被核准
  });

  it("a batch with both matching and mismatched records approves only the matching ones", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "NEEDS_REVIEW", contentHash: "sha256:" + "a".repeat(64) }));
    repo.records.push(record({ id: "KREC-002", status: "NEEDS_REVIEW", contentHash: "sha256:" + "c".repeat(64), packRecordId: "KR-2026-002" }));

    const result = await approvePackRecords(repo, [
      { dbId: "KREC-001", packRecordId: "KR-2026-001", dbContentHash: "sha256:" + "a".repeat(64), expectedContentHash: "sha256:" + "a".repeat(64) },
      { dbId: "KREC-002", packRecordId: "KR-2026-002", dbContentHash: "sha256:" + "c".repeat(64), expectedContentHash: "sha256:" + "z".repeat(64) },
    ]);

    expect(result.approved).toEqual(["KREC-001"]);
    expect(result.contentMismatched).toEqual([{ packRecordId: "KR-2026-002", dbId: "KREC-002" }]);
  });

  it("rejects an empty candidate list", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(approvePackRecords(repo, [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("publishVersion — version id / pack validation (D-03)", () => {
  it("uses the pack's intendedKnowledgeVersion as the version id (not a generated one)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    const result = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
    });
    expect(result.versionId).toBe("KB-2026-09-24-001");
  });

  it("rejects when intendedKnowledgeVersion is missing or malformed", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await expect(
      publishVersion(repo, {
        packs: [pack({ intendedKnowledgeVersion: null })],
        candidateRecords: [candidate("KREC-001")],
        createdBy: "x",
        approvedBy: "y",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      publishVersion(repo, {
        packs: [pack({ intendedKnowledgeVersion: "not-a-version" })],
        candidateRecords: [candidate("KREC-001")],
        createdBy: "x",
        approvedBy: "y",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects when the pack is not APPROVED", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await expect(
      publishVersion(repo, {
        packs: [pack({ status: "NEEDS_REVIEW" })],
        candidateRecords: [candidate("KREC-001")],
        createdBy: "x",
        approvedBy: "y",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects when multiple packs have inconsistent intendedKnowledgeVersion", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await expect(
      publishVersion(repo, {
        packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" }), pack({ intendedKnowledgeVersion: "KB-2026-09-24-002" })],
        candidateRecords: [candidate("KREC-001")],
        createdBy: "x",
        approvedBy: "y",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects when the version id already exists (any status), and does not overwrite it", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
    });

    repo.records.push(record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002" }));
    await expect(
      publishVersion(repo, {
        packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
        candidateRecords: [candidate("KREC-002")],
        createdBy: "x",
        approvedBy: "y",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.records.find((r) => r.id === "KREC-002")?.status).toBe("APPROVED"); // 沒被改動
  });
});

describe("publishVersion — effectiveTo exclusion", () => {
  it("excludes candidate records whose effectiveTo is before the publish date, and lists them", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "APPROVED" }));
    repo.records.push(record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002", title: "已失效紀錄" }));

    const result = await publishVersion(repo, {
      packs: [pack()],
      candidateRecords: [candidate("KREC-001"), candidate("KREC-002", "2026-01-01")],
      createdBy: "x",
      approvedBy: "y",
      today: "2026-09-24",
    });

    expect(result.excludedRecordIds).toEqual(["KREC-002"]);
    expect(result.publishedRecordCount).toBe(1);
    expect(repo.records.find((r) => r.id === "KREC-002")?.status).toBe("APPROVED"); // 未被發布，也未被改狀態
  });

  it("a record whose effectiveFrom is in the future is still included", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED", effectiveFrom: "2027-01-01" }));
    const result = await publishVersion(repo, {
      packs: [pack()],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
      today: "2026-09-24",
    });
    expect(result.excludedRecordIds).toEqual([]);
    expect(result.publishedRecordCount).toBe(1);
  });

  it("rejects when every candidate record is excluded (nothing left to publish)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await expect(
      publishVersion(repo, {
        packs: [pack()],
        candidateRecords: [candidate("KREC-001", "2020-01-01")],
        createdBy: "x",
        approvedBy: "y",
        today: "2026-09-24",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects publishing when a recordId is not currently APPROVED (no auto-approve on publish)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "NEEDS_REVIEW" }));

    await expect(
      publishVersion(repo, { packs: [pack()], candidateRecords: [candidate("KREC-001")], createdBy: "x", approvedBy: "y" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});

describe("publishVersion — D-03-v2 replace / expire / carry forward", () => {
  it("a previous PUBLISHED record replaced by new content (same jurisdiction+type+title) becomes SUPERSEDED", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "APPROVED", ruleData: { type: "ELIGIBILITY_ANY_OF" } }));
    const first = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
    });

    repo.records.push(
      record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002", ruleData: { type: "ELIGIBILITY_ANY_OF" } })
    );
    const second = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-002" })],
      candidateRecords: [candidate("KREC-002")],
      createdBy: "x",
      approvedBy: "y",
    });

    expect(second.supersededRecordCount).toBe(1);
    expect(second.carriedForwardCount).toBe(0);
    expect(repo.versions.find((v) => v.id === first.versionId)?.status).toBe("ARCHIVED");
    expect(repo.records.find((r) => r.id === "KREC-001")?.status).toBe("SUPERSEDED");
    expect(repo.records.find((r) => r.id === "KREC-002")?.status).toBe("PUBLISHED");
    expect(repo.versions.filter((v) => v.status === "PUBLISHED")).toHaveLength(1);
  });

  it("a previous PUBLISHED record NOT replaced and still effective is carried forward into the new version", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(
      record({ id: "KREC-001", status: "APPROVED", title: "不會被取代的紀錄", ruleData: { type: "LEVEL_RANGE" } })
    );
    const first = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
    });

    repo.records.push(
      record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002", title: "新紀錄", ruleData: { type: "BENEFIT_ITEMS" } })
    );
    const second = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-002" })],
      candidateRecords: [candidate("KREC-002")],
      createdBy: "x",
      approvedBy: "y",
    });

    expect(second.supersededRecordCount).toBe(0);
    expect(second.carriedForwardCount).toBe(1);
    const carried = repo.records.find((r) => r.id === "KREC-001");
    expect(carried?.status).toBe("PUBLISHED");
    // B-008-r3（J-003 H-3）：version 是「第一次發布時的版本」，carry-forward 不可覆寫它，
    // 否則舊版本的紀錄集合就無法追溯（見下面 traceability／restore 兩個測試）。
    expect(carried?.version).toBe(first.versionId);
  });

  it("a previous PUBLISHED record NOT replaced but already expired is SUPERSEDED, not carried forward", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(
      record({ id: "KREC-001", status: "APPROVED", title: "已過期紀錄", ruleData: { type: "LEVEL_RANGE" }, effectiveTo: "2026-01-01" })
    );
    await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
      today: "2025-12-01", // 第一次發布時尚未過期
    });

    repo.records.push(
      record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002", title: "新紀錄", ruleData: { type: "BENEFIT_ITEMS" } })
    );
    const second = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-002" })],
      candidateRecords: [candidate("KREC-002")],
      createdBy: "x",
      approvedBy: "y",
      today: "2026-09-24", // 這次發布時 KREC-001 已過期
    });

    expect(second.supersededRecordCount).toBe(1);
    expect(second.carriedForwardCount).toBe(0);
    expect(repo.records.find((r) => r.id === "KREC-001")?.status).toBe("SUPERSEDED");
  });

  it("write failure leaves no partial state: neither the new version nor record status changes are kept", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    repo.failNextPublish = true;

    await expect(
      publishVersion(repo, { packs: [pack()], candidateRecords: [candidate("KREC-001")], createdBy: "x", approvedBy: "y" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(repo.versions).toHaveLength(0);
    expect(repo.records[0].status).toBe("APPROVED");
  });
});

describe("publishVersion — real content packs (KP-2026-09-23-001 + KP-2026-09-24-002)", () => {
  const CONTRACTS_DIR = fileURLToPath(new URL("../../../contracts/knowledge", import.meta.url));
  const loadPack = (file: string): RawContentPack => JSON.parse(readFileSync(`${CONTRACTS_DIR}/${file}`, "utf-8"));
  const REGISTRY_MD = readFileSync(fileURLToPath(new URL("../../../docs/knowledge/source-registry.md", import.meta.url)), "utf-8");

  async function importAndApprove(repo: InMemoryKnowledgeRepository, pack: RawContentPack) {
    const registry = parseSourceRegistry(REGISTRY_MD);
    await importContentPack(repo, pack, registry, { mode: "commit" });
    const ids = repo.records.filter((r) => r.packId === pack.packId).map((r) => r.id);
    await approveRecords(repo, ids);
    return ids;
  }

  it("publishing KP-2026-09-23-001 alone uses its intendedKnowledgeVersion as the published version id", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const pack001 = loadPack("packs/KP-2026-09-23-001.json");
    const ids = await importAndApprove(repo, pack001);

    const result = await publishVersion(repo, {
      packs: [{ status: pack001.status, intendedKnowledgeVersion: pack001.intendedKnowledgeVersion }],
      candidateRecords: ids.map((id) => ({ id, effectiveTo: repo.records.find((r) => r.id === id)!.effectiveTo })),
      createdBy: "B-008",
      approvedBy: "Jerry",
    });

    expect(result.versionId).toBe(pack001.intendedKnowledgeVersion);
  });

  it("publishing 001+002 together yields 15 PUBLISHED records; a follow-up 1-record update keeps the other 14", async () => {
    const repo = new InMemoryKnowledgeRepository();
    const pack001 = loadPack("packs/KP-2026-09-23-001.json");
    const pack002 = loadPack("packs/KP-2026-09-24-002.json");
    const ids001 = await importAndApprove(repo, pack001);
    const ids002 = await importAndApprove(repo, pack002);
    const allIds = [...ids001, ...ids002];
    expect(allIds).toHaveLength(15);

    const first = await publishVersion(repo, {
      packs: [
        { status: pack001.status, intendedKnowledgeVersion: pack001.intendedKnowledgeVersion },
        { status: pack002.status, intendedKnowledgeVersion: pack002.intendedKnowledgeVersion },
      ],
      candidateRecords: allIds.map((id) => ({ id, effectiveTo: repo.records.find((r) => r.id === id)!.effectiveTo })),
      createdBy: "B-008",
      approvedBy: "Jerry",
    });
    expect(repo.records.filter((r) => r.status === "PUBLISHED")).toHaveLength(15);
    expect(first.publishedRecordCount).toBe(15);

    // 只更新一筆：同 jurisdiction+type+title 的新版本會取代舊的那一筆，其餘 14 筆應維持 PUBLISHED（帶入新版本）。
    const targetOld = repo.records.find((r) => r.id === ids001[0]);
    expect(targetOld).toBeTruthy();
    const updatedRecordId = `${targetOld!.id}-V2`;
    repo.records.push({
      ...targetOld!,
      id: updatedRecordId,
      status: "APPROVED",
      version: null,
      packId: "KP-2026-09-25-999",
      packRecordId: "KR-2026-999",
    });

    const second = await publishVersion(repo, {
      packs: [{ status: "APPROVED", intendedKnowledgeVersion: "KB-2026-09-25-001" }],
      candidateRecords: [{ id: updatedRecordId, effectiveTo: targetOld!.effectiveTo }],
      createdBy: "B-008",
      approvedBy: "Jerry",
    });

    expect(second.publishedRecordCount).toBe(1);
    expect(second.carriedForwardCount).toBe(14);
    expect(repo.records.filter((r) => r.status === "PUBLISHED")).toHaveLength(15);
    expect(repo.records.find((r) => r.id === targetOld!.id)?.status).toBe("SUPERSEDED"); // 被取代的舊版本
  });
});

describe("publishVersion / withdrawVersion — version traceability and full restore (B-008-r3, J-003 H-3/H-4)", () => {
  it("an earlier version's record set is fully derivable after a second version carries most of it forward and replaces one record", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "A", status: "APPROVED", title: "A", ruleData: { type: "T_A" } }));
    repo.records.push(record({ id: "B", status: "APPROVED", packRecordId: "KR-2026-B", title: "B", ruleData: { type: "T_B" } }));
    repo.records.push(record({ id: "C", status: "APPROVED", packRecordId: "KR-2026-C", title: "C", ruleData: { type: "T_C" } }));
    const v1 = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-001" })],
      candidateRecords: [candidate("A"), candidate("B"), candidate("C")],
      createdBy: "x",
      approvedBy: "y",
    });
    const v1PublishedIds = repo.records.filter((r) => r.status === "PUBLISHED").map((r) => r.id).sort();
    expect(v1PublishedIds).toEqual(["A", "B", "C"]);

    // v2 replaces A only (same jurisdiction+type+title); B and C carry forward untouched.
    repo.records.push(record({ id: "A2", status: "APPROVED", packRecordId: "KR-2026-A2", title: "A", ruleData: { type: "T_A" } }));
    await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-002" })],
      candidateRecords: [candidate("A2")],
      createdBy: "x",
      approvedBy: "y",
    });

    // Traceability: v1's original record set must still be derivable via the immutable version field,
    // exactly as it was when v1 was published — unaffected by what v2 did.
    const v1Now = repo.records.filter((r) => r.version === v1.versionId).map((r) => r.id).sort();
    expect(v1Now).toEqual(v1PublishedIds);
  });

  it("withdrawing the newer version and restoring the older one brings back its exact original content, including carried-forward records", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "A", status: "APPROVED", title: "A", ruleData: { type: "T_A" } }));
    repo.records.push(record({ id: "B", status: "APPROVED", packRecordId: "KR-2026-B", title: "B", ruleData: { type: "T_B" } }));
    const v1 = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-101" })],
      candidateRecords: [candidate("A"), candidate("B")],
      createdBy: "x",
      approvedBy: "y",
    });
    const v1Set = repo.records.filter((r) => r.status === "PUBLISHED").map((r) => r.id).sort();

    repo.records.push(record({ id: "A2", status: "APPROVED", packRecordId: "KR-2026-A2", title: "A", ruleData: { type: "T_A" } }));
    await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-102" })],
      candidateRecords: [candidate("A2")],
      createdBy: "x",
      approvedBy: "y",
    });

    await withdrawVersion(repo, { reason: "j003 h4", withdrawnBy: "Jerry", republishVersionId: v1.versionId });

    const restored = repo.records.filter((r) => r.status === "PUBLISHED").map((r) => r.id).sort();
    expect(restored).toEqual(v1Set); // exactly [A, B] again — B (carried-forward) must come back too
    expect(repo.records.find((r) => r.id === "A2")?.status).toBe("SUPERSEDED"); // v2's replacement is undone
  });

  it("rejects withdrawing a version and republishing the exact same version id in the same call; nothing changes", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "A", status: "APPROVED" }));
    const v1 = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-201" })],
      candidateRecords: [candidate("A")],
      createdBy: "x",
      approvedBy: "y",
    });

    await expect(
      withdrawVersion(repo, { reason: "x", withdrawnBy: "y", republishVersionId: v1.versionId })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(repo.versions.find((v) => v.id === v1.versionId)?.status).toBe("PUBLISHED");
    expect(repo.records.find((r) => r.id === "A")?.status).toBe("PUBLISHED");
  });

  it("an invalid restore target (not an ARCHIVED version) rolls back the whole withdraw; the version being withdrawn stays PUBLISHED", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "A", status: "APPROVED" }));
    const v1 = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-26-301" })],
      candidateRecords: [candidate("A")],
      createdBy: "x",
      approvedBy: "y",
    });

    await expect(
      withdrawVersion(repo, { reason: "x", withdrawnBy: "y", republishVersionId: "KB-DOES-NOT-EXIST" })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    // InMemoryKnowledgeRepository throws before committing any state change (matches the SQL
    // function's transactional rollback semantics — see PGlite verification in the PR).
    expect(repo.versions.find((v) => v.id === v1.versionId)?.status).toBe("PUBLISHED");
    expect(repo.records.find((r) => r.id === "A")?.status).toBe("PUBLISHED");
  });
});

describe("withdrawVersion", () => {
  it("withdrawing without a republish target leaves no PUBLISHED version (-> KNOWLEDGE_UNAVAILABLE)", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ status: "APPROVED" }));
    await publishVersion(repo, { packs: [pack()], candidateRecords: [candidate("KREC-001")], createdBy: "x", approvedBy: "y" });

    const result = await withdrawVersion(repo, { reason: "官方勘誤", withdrawnBy: "Jerry" });

    expect(result.republishedVersionId).toBeNull();
    await expect(getKnowledgeStatus(repo)).rejects.toMatchObject({ code: "KNOWLEDGE_UNAVAILABLE" });
    expect(repo.versions[0].status).toBe("ARCHIVED");
  });

  it("records the withdrawal reason and operator, and republishes the given previous version", async () => {
    const repo = new InMemoryKnowledgeRepository();
    repo.records.push(record({ id: "KREC-001", status: "APPROVED" }));
    const first = await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-001" })],
      candidateRecords: [candidate("KREC-001")],
      createdBy: "x",
      approvedBy: "y",
    });

    repo.records.push(record({ id: "KREC-002", status: "APPROVED", packRecordId: "KR-2026-002" }));
    await publishVersion(repo, {
      packs: [pack({ intendedKnowledgeVersion: "KB-2026-09-24-002" })],
      candidateRecords: [candidate("KREC-002")],
      createdBy: "x",
      approvedBy: "y",
    });

    const result = await withdrawVersion(repo, {
      reason: "第二版有誤",
      withdrawnBy: "Jerry",
      republishVersionId: first.versionId,
    });

    expect(result.republishedVersionId).toBe(first.versionId);
    expect(repo.versions.find((v) => v.id === first.versionId)?.status).toBe("PUBLISHED");
    expect(repo.records.find((r) => r.id === "KREC-001")?.status).toBe("PUBLISHED");
    const status = await getKnowledgeStatus(repo);
    expect(status.version).toBe(first.versionId);
  });

  it("rejects when there is nothing PUBLISHED to withdraw", async () => {
    const repo = new InMemoryKnowledgeRepository();
    await expect(withdrawVersion(repo, { reason: "x", withdrawnBy: "y" })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
