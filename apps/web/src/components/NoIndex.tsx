import { useEffect } from "react";

export function NoIndex() {
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content;
    const meta = existing ?? document.createElement("meta");
    if (!existing) {
      meta.name = "robots";
      document.head.append(meta);
    }
    meta.content = "noindex, nofollow";
    return () => {
      if (existing && previous !== undefined) existing.content = previous;
      else meta.remove();
    };
  }, []);

  return null;
}
