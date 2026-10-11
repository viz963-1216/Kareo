import manifest from '../../../../data/residence/manifest.json';
import { DISTRICTS, isServiceCity, type Coordinates } from './location';

const digits: Record<string, number> = { 零:0, 〇:0, 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
function chineseNumber(text: string): string {
  if (text.includes('十')) { const [tens, ones] = text.split('十'); return String((digits[tens] ?? 1) * 10 + (digits[ones] ?? 0)); }
  return [...text].map(c => digits[c]).join('');
}
/** Normalize only spelling/numbers/floor suffixes, never interpolate a nearby address. */
export function normalizeResidenceAddress(text: string): string {
  const normalized = text.normalize('NFKC').replaceAll('台','臺').replace(/[\s,，、]/g,'')
    .replace(/[零〇一二三四五六七八九十]+(?=[段巷弄號])/g, chineseNumber).replace(/號之([0-9]+)/g,'之$1號');
  return normalized.match(/^(.+?號)/)?.[1] ?? '';
}
export type AddressIndex = Record<string, readonly [number, number]>;
export function matchResidence(index: AddressIndex, city: string, district: string, input: string): Coordinates | null {
  if (!isServiceCity(city) || !DISTRICTS[city].includes(district)) return null;
  let key = normalizeResidenceAddress(input);
  key = key.replace(/^[0-9]{3,6}(?=[臺新])/,'');
  if (key.startsWith(city)) key = key.slice(city.length);
  if (key.startsWith(district)) key = key.slice(district.length);
  // A prefix from a different city/district won't match an exact house-number key.
  const pair = Object.hasOwn(index, key) ? index[key] : null;
  return pair && pair.length === 2 && pair.every(Number.isFinite) && pair[0] > 24 && pair[0] < 26 && pair[1] > 120 && pair[1] < 123
    ? { lat: pair[0], lng: pair[1] } : null;
}
const districtLoads = new Map<string, Promise<AddressIndex>>();
export async function resolveResidence(city: string, district: string, input: string): Promise<Coordinates | null> {
  const key = `${city}|${district}`;
  const item = (manifest.districts as Record<string,{ file: string; sha256: string }>)[key];
  if (!item || !input.trim()) return null;
  let loading = districtLoads.get(key);
  if (!loading) {
    // Only the public district dataset path is downloaded. No input address in URL/body/log.
    const url = `${import.meta.env.BASE_URL}residence/${item.file.replace('.json',`-${item.sha256.slice(0,12)}.js`)}`;
    loading = import(/* @vite-ignore */ url).then(module => module.default as AddressIndex);
    districtLoads.set(key, loading);
    loading.catch(() => districtLoads.delete(key));
  }
  return matchResidence(await loading, city, district, input);
}
