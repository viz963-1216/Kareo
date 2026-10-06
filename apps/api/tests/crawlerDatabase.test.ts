import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseKnowledgeRepository } from "../src/repositories/supabaseKnowledgeRepository.js";
import { crawlAllActiveSources, crawlSource, type Fetcher } from "../src/services/crawlerService.js";
import { parseSourceRegistry } from "../src/services/knowledgeImportService.js";

// Actual repository payloads and actual SQL FKs; this bridge is NOT deployment/PostgREST acceptance.
const state = vi.hoisted(() => ({ db: null as PGlite | null, failSnapshot: false }));
vi.mock("../src/repositories/supabaseClient.js", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      async function write(input: Record<string, unknown> | Record<string, unknown>[], options?: {
        onConflict: string; ignoreDuplicates?: boolean;
      }) {
        try {
          if (table === "crawler_snapshots" && state.failSnapshot) throw new Error("snapshot unavailable");
          if (!["knowledge_sources", "crawler_runs", "crawler_snapshots"].includes(table)) throw new Error("unexpected table");
          const rows = Array.isArray(input) ? input : [input];
          for (const row of rows) {
            const columns = Object.keys(row);
            const quoted = columns.map(c => `"${c}"`);
            const conflict = !options ? "" : options.ignoreDuplicates ? "on conflict (id) do nothing" :
              `on conflict (id) do update set ${columns.filter(c => c !== "id").map(c => `"${c}"=excluded."${c}"`).join(",")}`;
            await state.db!.query(`insert into ${table} (${quoted.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")}) ${conflict}`,
              columns.map(c => c === "raw_bytes" ? Buffer.from(String(row[c]).slice(2), "hex") : row[c]));
          }
          return { error: null };
        } catch (error) { return { error }; }
      }
      return { insert: write, upsert: write };
    },
  }),
}));

// No baseline is the real first-crawl case for a registered source with no imported knowledge.
class FirstCrawlRepository extends SupabaseKnowledgeRepository {
  async findLatestRecordBySourceId() { return null; }
}
const markdown = `| sourceId | name | authority | jurisdiction | url | date | fetch | active |
| \`SRC-NEW-LAW\` | 新登錄法規 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/new | - | - | true |
| \`SRC-INACTIVE\` | 停用來源 | \`LAW\` | \`TAIWAN\` | https://law.moj.gov.tw/old | - | - | false |
| \`SRC-DRIVE\` | 內部檔案 | \`KAREO_DRIVE\` | \`TAIWAN\` | https://drive.google.com/file/d/x/view | - | - | true |`;
const fetcher: Fetcher = async () => ({ ok: true, text: "<p>官方條文</p>",
  rawBytes: Buffer.from("<p>官方條文</p>"), errorMessage: null });

describe("crawler actual SQL foreign keys and repository writes", () => {
  beforeEach(async () => {
    state.db = new PGlite();
    state.failSnapshot = false;
    await state.db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["0006_knowledge.sql", "0015_crawler_runs.sql", "0016_crawler_hash_traceability.sql", "0017_crawler_snapshots.sql"]) {
      await state.db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await state.db.query(`insert into knowledge_versions (id,status,created_by) values ('KB-BASE','PUBLISHED','synthetic')`);
  }, 15000);
  afterEach(async () => { await state.db?.close(); state.db = null; });

  it("registers missing official sources, preserving existing metadata on repeated runs", async () => {
    const repo = new FirstCrawlRepository();
    const registry = parseSourceRegistry(markdown);
    await repo.ensureCrawlerSources(registry);
    const rows = (await state.db!.query("select id,name from knowledge_sources")).rows;
    expect(rows).toEqual([{ id: "SRC-NEW-LAW", name: "新登錄法規" }]);
    registry.get("SRC-NEW-LAW")!.name = "must not overwrite";
    await repo.ensureCrawlerSources(registry);
    expect((await state.db!.query("select name from knowledge_sources")).rows).toEqual([{ name: "新登錄法規" }]);
  });

  it("first crawl with no knowledge record saves a linked run and exact bytes, without publishing", async () => {
    const repo = new FirstCrawlRepository();
    const registry = parseSourceRegistry(markdown);
    await repo.ensureCrawlerSources(registry);
    const { runs, overallStatus } = await crawlAllActiveSources(repo, registry, fetcher);
    expect(overallStatus).toBe("SUCCESS");
    expect(runs).toHaveLength(1);
    const rows = (await state.db!.query(`select r.id,r.status,r.finished_at,s.crawler_run_id,
      encode(s.raw_bytes,'hex') as bytes,s.raw_hash from crawler_runs r join crawler_snapshots s on r.snapshot_id=s.id`)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("SUCCESS");
    expect(rows[0].crawler_run_id).toBe(rows[0].id);
    expect(rows[0].finished_at).not.toBeNull();
    expect(rows[0].bytes).toBe(Buffer.from("<p>官方條文</p>").toString("hex"));
    expect(rows[0].raw_hash).toBe(`sha256:${createHash("sha256").update("<p>官方條文</p>").digest("hex")}`);
    expect((await state.db!.query("select id,status from knowledge_versions")).rows).toEqual([{ id: "KB-BASE", status: "PUBLISHED" }]);
    expect((await state.db!.query("select count(*)::int as n from knowledge_records")).rows[0].n).toBe(0);
  });

  it("snapshot failure finishes the same run as FAILED, leaving no stranded RUNNING or fake success", async () => {
    const repo = new FirstCrawlRepository();
    await repo.ensureCrawlerSources(parseSourceRegistry(markdown));
    state.failSnapshot = true;
    const { run } = await crawlSource(repo, "SRC-NEW-LAW", "https://law.moj.gov.tw/new", fetcher);
    expect(run.status).toBe("FAILED");
    expect((await state.db!.query("select id,status,snapshot_id from crawler_runs")).rows)
      .toEqual([{ id: run.id, status: "FAILED", snapshot_id: null }]);
    expect((await state.db!.query("select count(*)::int as n from crawler_snapshots")).rows[0].n).toBe(0);
    expect((await state.db!.query("select status from knowledge_versions")).rows[0].status).toBe("PUBLISHED");
  });

  it("negative control: snapshot-before-run fails the real FK used in staging", async () => {
    const repo = new FirstCrawlRepository();
    await repo.ensureCrawlerSources(parseSourceRegistry(markdown));
    await expect(state.db!.query(`insert into crawler_snapshots
      (id,source_id,crawler_run_id,fetched_at,raw_bytes,raw_hash,extraction_method_version,created_at)
      values ('SNAP-OLD','SRC-NEW-LAW','RUN-NOT-YET-INSERTED',now(),'x','hash','none',now())`))
      .rejects.toThrow(/crawler_snapshots_crawler_run_id_fkey/);
  });

  it("invalid official source aborts registration before any write", async () => {
    const registry = parseSourceRegistry(markdown);
    registry.get("SRC-NEW-LAW")!.url = "https://example.com/";
    await expect(new FirstCrawlRepository().ensureCrawlerSources(registry)).rejects.toThrow(/格式不合法/);
    expect((await state.db!.query("select count(*)::int as n from knowledge_sources")).rows[0].n).toBe(0);
  });
});
