// Marks copy that is still DRAFT (PRIVACY_AND_RETENTION §8, D-05/D-06). Never presented as approved.
export function DraftBadge({ children = "草案文案・尚未經法務與 Jerry 核准" }: { children?: string }) {
  return <span className="draft-badge">{children}</span>;
}
