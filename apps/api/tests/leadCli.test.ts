// J-003-r8（Jerry 委託審查 #47，問題 4）：官方手動重現——編譯後直接執行
// `update TEST --to CONTACTED`、`list --status NEW` 皆因 parseFlags 把 --to/--status 誤判為
// 無值的布林旗標（exit 2）。這裡用單元測試固定 parseFlags 本身的解析行為，不只是改用法文字。
import { describe, it, expect } from "vitest";
import { parseFlags } from "../src/lib/cliFlags.js";

describe("parseFlags", () => {
  it("accepts LEAD_OPERATIONS.md 文件格式的空白分隔旗標（--flag value）", () => {
    expect(parseFlags(["list", "--status", "NEW"])).toMatchObject({ positional: ["list"], flags: { status: "NEW" } });
    expect(parseFlags(["update", "LEAD-001", "--to", "CONTACTED"])).toMatchObject({
      positional: ["update", "LEAD-001"],
      flags: { to: "CONTACTED" },
    });
    expect(
      parseFlags(["update", "LEAD-001", "--to", "CANCELLED", "--reason", "UNREACHABLE", "--note", "三次都沒接"])
    ).toMatchObject({
      positional: ["update", "LEAD-001"],
      flags: { to: "CANCELLED", reason: "UNREACHABLE", note: "三次都沒接" },
    });
    expect(parseFlags(["list", "--since", "2026-10-01"])).toMatchObject({ flags: { since: "2026-10-01" } });
  });

  it("still accepts --flag=value", () => {
    expect(parseFlags(["list", "--status=NEW"])).toMatchObject({ flags: { status: "NEW" } });
  });

  it("treats a trailing flag with nothing after it as a boolean true", () => {
    expect(parseFlags(["list", "--status"])).toMatchObject({ flags: { status: "true" } });
  });

  it("does not swallow the next flag as this flag's value", () => {
    expect(parseFlags(["list", "--status", "--since", "2026-10-01"])).toMatchObject({
      flags: { status: "true", since: "2026-10-01" },
    });
  });
});
