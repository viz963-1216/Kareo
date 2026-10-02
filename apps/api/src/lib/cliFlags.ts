// 共用 CLI 旗標解析，獨立成可被測試匯入的模組（scripts/*.ts 依本檔案既有慣例在模組載入當下就
// 直接執行 main()，不應該被測試 import 觸發執行）。
// 同時支援 --flag=value 與 --flag value（空白分隔）兩種寫法；只有下一個 token 不存在或本身
// 也是 --flag 時才視為無值的布林旗標。
export function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = "true";
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}
