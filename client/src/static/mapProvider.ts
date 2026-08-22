export type MapProvider = "naver" | "openstreetmap";
export const openStreetMapTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const nominatimSearchEndpoint = "https://nominatim.openstreetmap.org/search";

const storageKey = "site-study-static-map-provider-v1";

export function loadMapProvider(): MapProvider {
  if (new URLSearchParams(window.location.search).get("map") === "osm") return "openstreetmap";
  return sessionStorage.getItem(storageKey) === "openstreetmap" ? "openstreetmap" : "naver";
}

export function saveMapProvider(provider: MapProvider) {
  sessionStorage.setItem(storageKey, provider);
}

export function nominatimSearchUrl(query: string) {
  const url = new URL(nominatimSearchEndpoint);
  url.search = new URLSearchParams({ q: query.trim(), format: "jsonv2", limit: "3", countrycodes: "kr", addressdetails: "1" }).toString();
  return url.toString();
}
