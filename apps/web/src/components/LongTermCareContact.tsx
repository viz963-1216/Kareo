import { Link } from "react-router-dom";

/** A visible fallback; clicking invokes the device's phone handler, never an automatic call. */
export function LongTermCareContact({ resources = false }: { resources?: boolean }) {
  return <div className="button-row fallback-actions">
    <a className="button secondary" href="tel:1966" aria-label="撥打長照專線 1966">撥打長照專線 1966</a>
    {resources && <Link className="button secondary" to="/resources">查詢長照資源</Link>}
  </div>;
}
