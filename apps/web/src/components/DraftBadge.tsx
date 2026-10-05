// Marks copy that is still DRAFT (PRIVACY_AND_RETENTION §8, D-05/D-06). Never presented as approved.
export function DraftBadge({ children = "草案版本・正式啟用驗證尚未完成" }: { children?: string }) {
  return <span className="draft-badge">{children}</span>;
}
