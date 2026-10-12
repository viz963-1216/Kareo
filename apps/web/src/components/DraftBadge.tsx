import { localAnalysisMode } from "../demo";
// Formal DRAFT remains unchanged; browser-only public analysis displays its actual scope.
export function DraftBadge({ children = "草案版本・正式啟用驗證尚未完成" }: { children?: string }) {
  return <span className="draft-badge">{localAnalysisMode ? "初步資訊參考" : children}</span>;
}
