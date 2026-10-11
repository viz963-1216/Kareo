import type { Coordinates } from '../location/location';
export function straightLineKm(from: Coordinates, to: Coordinates): number {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(rad(to.lat-from.lat)/2)**2 + Math.cos(rad(from.lat))*Math.cos(rad(to.lat))*Math.sin(rad(to.lng-from.lng)/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
export function rankLocatedProviders<T extends { id: string; lat: number | null; lng: number | null }>(origin: Coordinates, candidates: T[]) {
  return candidates.filter(p => typeof p.lat === 'number' && Number.isFinite(p.lat) && typeof p.lng === 'number' && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .map(provider => ({ provider, distance: straightLineKm(origin, {lat:provider.lat!,lng:provider.lng!}) }))
    .sort((a,b) => a.distance-b.distance || a.provider.id.localeCompare(b.provider.id));
}
