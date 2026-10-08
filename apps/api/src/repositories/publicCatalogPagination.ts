import { AppError } from "../errors/AppError.js";
// Stable id order and explicit ranges avoid PostgREST's default row limit.
// This reads only the public Provider catalogue, never case or contact tables.
export async function readPublicCatalogPages<T>(fetchPage: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>, message: string): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await fetchPage(start, start + pageSize - 1);
    if (error || !data) throw new AppError("INTERNAL_ERROR", message, { cause: error });
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
