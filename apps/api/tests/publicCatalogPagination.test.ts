import { describe, it, expect } from 'vitest';
import { readPublicCatalogPages } from '../src/repositories/publicCatalogPagination.js';
describe('public catalogue pagination', () => {
  it('retains rows beyond the default 1000-row PostgREST cap', async () => {
    const source = Array.from({length:1123},(_,id)=>({id})); const ranges:number[][]=[];
    const rows = await readPublicCatalogPages(async (a,b) => {ranges.push([a,b]);return {data:source.slice(a,b+1),error:null};},'safe');
    expect(rows).toEqual(source);expect(ranges).toEqual([[0,499],[500,999],[1000,1499]]);
  });
  it('a later page failure must not become partial success', async () => {
    await expect(readPublicCatalogPages(async (a) => a===0 ? {data:Array(500).fill({id:1}),error:null} : {data:null,error:new Error('private-db-detail')},'安全查詢錯誤')).rejects.toThrow('安全查詢錯誤');
  });
});
