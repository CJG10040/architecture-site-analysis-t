import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoundaryPoint, MapOverlay, SpatialLayer } from "@/static/model";
import { parcelCandidateKey, type VworldParcelCandidate } from "@/static/vworld";
import { nominatimSearchUrl, openStreetMapTileUrl } from "@/static/mapProvider";

type SearchResult = { lat: number; lng: number; label: string };
type Props = {
  latitude: number;
  longitude: number;
  address: string;
  boundary: BoundaryPoint[];
  radiusMeters: number;
  overlays: MapOverlay[];
  spatialLayers: SpatialLayer[];
  parcelCandidates: VworldParcelCandidate[];
  selectedParcelKey: string;
  onParcelSelect: (candidate: VworldParcelCandidate) => void;
  onSiteChange: (change: { latitude?: number; longitude?: number; address?: string }) => void;
  onBoundaryChange: (boundary: BoundaryPoint[]) => void;
};

const geocodeCachePrefix = "site-study-osm-geocode-v1:";
let lastNominatimRequestAt = 0;

const vertexIcon = L.divIcon({ className: "site-boundary-vertex", iconSize: [18, 18], iconAnchor: [9, 9] });

export function OpenStreetMapPicker({ latitude, longitude, address, boundary, radiusMeters, overlays, spatialLayers, parcelCandidates, selectedParcelKey, onParcelSelect, onSiteChange, onBoundaryChange }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onParcelSelectRef = useRef(onParcelSelect);
  const boundaryRef = useRef(boundary);
  const drawingRef = useRef(false);
  const onSiteChangeRef = useRef(onSiteChange);
  const onBoundaryChangeRef = useRef(onBoundaryChange);
  const [drawing, setDrawing] = useState(false);
  const [query, setQuery] = useState(address);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => { boundaryRef.current = boundary; }, [boundary]);
  useEffect(() => { onParcelSelectRef.current = onParcelSelect; }, [onParcelSelect]);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => { onSiteChangeRef.current = onSiteChange; }, [onSiteChange]);
  useEffect(() => { onBoundaryChangeRef.current = onBoundaryChange; }, [onBoundaryChange]);
  useEffect(() => { setQuery(address); }, [address]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, { zoomControl: true, attributionControl: true }).setView([latitude, longitude], 18);
    L.tileLayer(openStreetMapTileUrl, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (drawingRef.current) onBoundaryChangeRef.current([...boundaryRef.current, point]);
      else onSiteChangeRef.current({ latitude: point.lat, longitude: point.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { mapRef.current?.setView([latitude, longitude], mapRef.current.getZoom(), { animate: false }); }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    if (boundary.length >= 2) {
      const latLngs = boundary.map(point => [point.lat, point.lng] as L.LatLngTuple);
      if (boundary.length >= 3) L.polygon(latLngs, { color: "#a9684f", weight: 2, fillColor: "#d69b78", fillOpacity: 0.18 }).addTo(layer);
      else L.polyline(latLngs, { color: "#a9684f", weight: 2 }).addTo(layer);
      boundary.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lng], { icon: vertexIcon, draggable: true, title: `${index + 1}번 경계 정점` }).addTo(layer);
        marker.on("dragend", () => {
          const moved = marker.getLatLng();
          onBoundaryChangeRef.current(boundaryRef.current.map((item, itemIndex) => itemIndex === index ? { lat: moved.lat, lng: moved.lng } : item));
        });
      });
    }
    return () => { layer.remove(); };
  }, [boundary]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    L.circle([latitude, longitude], { radius: radiusMeters, color: "#46603e", weight: 1, fillColor: "#88a77c", fillOpacity: 0.08 }).addTo(layer);
    overlays.forEach(item => L.circleMarker([item.latitude, item.longitude], { radius: 7, color: "#ffffff", weight: 1, fillColor: "#a9684f", fillOpacity: 1 }).addTo(layer));
    return () => { layer.remove(); };
  }, [latitude, longitude, radiusMeters, overlays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    spatialLayers.forEach(spatialLayer => {
      const color = spatialLayer.id === "vworldRoads" ? "#6b4f3b" : "#65745c";
      const data = { type: "FeatureCollection", features: spatialLayer.features.map(feature => ({ type: "Feature", id: feature.id, geometry: feature.geometry, properties: { ...feature.properties, __layerTitle: spatialLayer.title } })) } as GeoJSON.FeatureCollection;
      L.geoJSON(data, { style: { color, weight: spatialLayer.id === "vworldRoads" ? 2.5 : 1.2, opacity: 0.7, fillColor: color, fillOpacity: spatialLayer.id === "vworldRoads" ? 0 : 0.14 }, pointToLayer: (_feature, point) => L.circleMarker(point, { radius: 4, color, fillColor: color, fillOpacity: 0.7, weight: 1 }), onEachFeature: (feature, featureLayer) => featureLayer.bindTooltip(`${spatialLayer.title} · ${feature.id ?? "객체"}`) }).addTo(layer);
    });
    return () => { layer.remove(); };
  }, [spatialLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    parcelCandidates.forEach(candidate => {
      if (!candidate.geometry) return;
      const selected = parcelCandidateKey(candidate) === selectedParcelKey;
      const color = selected ? "#d87939" : "#2f7d73";
      const data = { type: "Feature", id: candidate.featureId, geometry: candidate.geometry, properties: candidate.properties ?? {} } as GeoJSON.Feature;
      L.geoJSON(data, { style: { color, weight: selected ? 3 : 1, opacity: .95, fillColor: color, fillOpacity: selected ? .3 : .06 }, onEachFeature: (_feature, featureLayer) => featureLayer.on("click", event => { L.DomEvent.stopPropagation(event); onParcelSelectRef.current(candidate); }).bindTooltip(`${candidate.parcelNumber ?? "지번 미확인"} · ${candidate.areaSqm ?? "면적 미확인"}㎡`) }).addTo(layer);
    });
    return () => { layer.remove(); };
  }, [parcelCandidates, selectedParcelKey]);

  const applySearchResult = (result: SearchResult) => {
    mapRef.current?.setView([result.lat, result.lng], 18);
    onSiteChangeRef.current({ latitude: result.lat, longitude: result.lng, address: result.label });
    setSearchResults([]);
  };

  const searchAddress = async () => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return setError("검색할 국내 주소 또는 지번을 입력하세요.");
    const cached = sessionStorage.getItem(`${geocodeCachePrefix}${normalizedQuery}`);
    if (cached) {
      try { setSearchResults(JSON.parse(cached) as SearchResult[]); setError(""); return; } catch { sessionStorage.removeItem(`${geocodeCachePrefix}${normalizedQuery}`); }
    }
    if (Date.now() - lastNominatimRequestAt < 1000) return setError("OpenStreetMap 주소 검색은 공용 서비스 정책에 따라 1초 간격으로 실행됩니다. 잠시 후 다시 검색하세요.");
    lastNominatimRequestAt = Date.now();
    setError(""); setSearchResults([]);
    try {
      const response = await fetch(nominatimSearchUrl(normalizedQuery), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`주소 검색 ${response.status} 응답`);
      const raw = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      const results = raw.map(item => ({ lat: Number(item.lat), lng: Number(item.lon), label: item.display_name })).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
      sessionStorage.setItem(`${geocodeCachePrefix}${normalizedQuery}`, JSON.stringify(results));
      if (!results.length) return setError("OpenStreetMap에서 일치하는 국내 주소·지번을 찾지 못했습니다. 지도 클릭 또는 네이버 지도로 다시 확인하세요.");
      setSearchResults(results);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "OpenStreetMap 주소 검색에 실패했습니다."); }
  };

  const moveToCurrent = () => navigator.geolocation?.getCurrentPosition(position => {
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    onSiteChangeRef.current(next); mapRef.current?.setView([next.latitude, next.longitude], 18);
  }, () => setError("현재 위치를 가져오지 못했습니다. 브라우저 위치 권한을 확인하세요."));

  return <section className="mt-3 overflow-hidden border border-stone-300 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-[#fbfaf7] p-3"><div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void searchAddress(); } }} placeholder="국내 도로명 주소·지번 검색" className="h-10 w-full border border-stone-300 bg-white pl-9 pr-24 text-sm outline-none focus:border-[#a9684f]" /><button type="button" onClick={() => void searchAddress()} className="absolute right-1 top-1 h-8 bg-[#283126] px-3 text-xs text-white">주소 검색</button></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={drawing ? "default" : "outline"} onClick={() => setDrawing(value => !value)} className={drawing ? "bg-[#a9684f] text-white" : "border-stone-300"}><PencilLine className="mr-1.5 h-4 w-4" />{drawing ? "그리기 종료" : "경계 그리기"}</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange(boundary.slice(0, -1))} disabled={!boundary.length} className="border-stone-300"><RotateCcw className="mr-1.5 h-4 w-4" />되돌리기</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange([])} disabled={!boundary.length} className="border-stone-300"><Trash2 className="mr-1.5 h-4 w-4" />경계 지우기</Button><Button size="sm" variant="outline" onClick={moveToCurrent} className="border-stone-300"><LocateFixed className="mr-1.5 h-4 w-4" />현재 위치</Button></div></div><div ref={mapElement} className="h-[420px] bg-stone-100" />{searchResults.length > 0 && <div className="border-t border-stone-200 bg-white p-3"><p className="text-xs font-medium text-stone-600">OpenStreetMap 검색 결과를 선택하세요.</p><div className="mt-2 space-y-1">{searchResults.map(result => <button key={`${result.lat},${result.lng}`} type="button" onClick={() => applySearchResult(result)} className="block w-full border border-stone-200 p-2 text-left text-xs leading-5 text-stone-700 hover:border-[#a9684f] hover:bg-[#fbf3eb]"><MapPin className="mr-1 inline h-3.5 w-3.5 text-[#a9684f]" />{result.label}</button>)}</div></div>}{error && <p className="border-t border-[#ebc8bc] bg-[#fff5f2] p-3 text-sm text-[#8b3a2d]">{error}</p>}<div className="border-t border-stone-200 bg-[#fbfaf7] px-4 py-3 text-xs leading-5 text-stone-600"><strong>OpenStreetMap 백업 지도</strong>입니다. 주소 검색은 자동완성이 아닌 사용자 클릭형 검색만 사용하며, 검색 결과는 현재 세션에 캐시됩니다. 초록 원은 조사 반경({radiusMeters}m), 테라코타 점은 위치가 있는 수집 근거입니다. 경계 정점은 드래그로 보정할 수 있습니다.</div></section>;
}
