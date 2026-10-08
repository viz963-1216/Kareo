import { demoMode } from "../demo";
// Formal DRAFT remains unchanged; the separate static demo explains its presentation scope.
export function DraftBadge({ children = "草案版本・正式啟用驗證尚未完成" }: { children?: string }) {
  return <span className="draft-badge">{demoMode ? "公開資料・非正式媒合" : children}</span>;
}
