/**
 * Geocoding：地址 → 座標 → HOME 直線距離
 *
 * - 用 Google Maps Geocoding API（參數參考 n8n 的 Geocoding 節點）
 * - HOME 座標固定：22.65990, 120.30336
 * - 距離加分公式：Math.floor(km / 10) * 10（<10km +0；10–20 +10；20–30 +20；≥50 +50；上不封頂）
 *
 * Env:
 *   GMAPS_API_KEY
 */

const HOME_LAT = 22.65990
const HOME_LNG = 120.30336

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

/**
 * 打 Google Maps Geocoding API 取座標。
 * 失敗回 null（`neverError: true` 的語意，不 throw）。
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GMAPS_API_KEY
  if (!key) {
    console.warn('[geocoding] GMAPS_API_KEY missing')
    return null
  }
  if (!address || !address.trim()) return null

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('language', 'zh-TW')
  url.searchParams.set('region', 'tw')
  url.searchParams.set('key', key)

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null
    const first = data.results[0]
    const loc = first.geometry?.location
    if (!loc) return null
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: first.formatted_address ?? address,
    }
  } catch (err) {
    console.warn('[geocoding] fetch failed', err)
    return null
  }
}

/**
 * Haversine 公式算兩點直線距離（公里）。
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.asin(Math.sqrt(a))
  return R * c
}

/**
 * 算離 HOME 的直線距離（km）。
 */
export function distanceFromHome(lat: number, lng: number): number {
  return haversineKm(HOME_LAT, HOME_LNG, lat, lng)
}

/**
 * 距離 → 加分（公式：Math.floor(km / 10) * 10，下無封頂、上無封頂）。
 * - km < 10  →  0
 * - 10 ≤ km < 20 → 10
 * - 20 ≤ km < 30 → 20
 * - ...
 */
export function distanceBonus(km: number): number {
  if (!Number.isFinite(km) || km < 0) return 0
  return Math.floor(km / 10) * 10
}
