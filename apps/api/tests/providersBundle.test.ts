// Jerry 2026-10-03 審查（#57）：providers 打包後在 Netlify 的 ESM／CommonJS 都載入失敗
// （service-districts.json 沒被打包、CommonJS 沒有 import.meta.url）。Vitest／tsc 不會發現這種問題，
// 所以這裡比照 scripts/check-functions-runtime.mjs 的 esbuild 設定實際打包，放到不含 contracts/ 的
// 空目錄（只有打包結果，等同 Netlify 部署包），再載入並呼叫 handler。不連資料庫、不需要路由。
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild") as typeof import("esbuild");
const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/functions/providers.ts");

async function bundleAndLoad(format: "esm" | "cjs") {
  const out = mkdtempSync(path.join(tmpdir(), "kareo-providers-"));
  const outfile = path.join(out, `providers.${format === "esm" ? "mjs" : "cjs"}`);
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node22",
    format,
    logLevel: "silent",
    banner: format === "esm" ? { js: "import { createRequire as __kareoCreateRequire } from 'node:module'; const require = __kareoCreateRequire(import.meta.url);" } : undefined,
  });
  const mod = (await import(pathToFileURL(outfile).href)) as { handler: (e: unknown) => Promise<{ statusCode: number; body: string }> };
  return { mod, cleanup: () => rmSync(out, { recursive: true, force: true }) };
}

describe("providers function bundle (Netlify ESM and CommonJS)", () => {
  for (const format of ["esm", "cjs"] as const) {
    it(`${format}: loads without contracts/ next to it and validates against service-districts.json`, async () => {
      const { mod, cleanup } = await bundleAndLoad(format);
      try {
        expect(typeof mod.handler).toBe("function");
        // 高雄市不在 service-districts.json：能回 VALIDATION_ERROR 代表 JSON 已被打包進來並讀到。
        const res = await mod.handler({ httpMethod: "GET", queryStringParameters: { city: "高雄市" } });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
        const wrongMethod = await mod.handler({ httpMethod: "PATCH", queryStringParameters: {} });
        expect(wrongMethod.statusCode).toBe(400);
      } finally {
        cleanup();
      }
    }, 20000);
  }
});
