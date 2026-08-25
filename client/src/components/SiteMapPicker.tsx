import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoundaryPoint, MapOverlay, SpatialLayer } from "@/static/model";
import { loadNaverMaps } from "@/static/naverMaps";

type Props = {
  clientId: string;
  latitude: number;
  longitude: number;
  address: string;
  boundary: BoundaryPoint[];
  radiusMeters: number;
  overlays: MapOverlay[];
  spatialLayers: SpatialLayer[];
  onSiteChange: (change: { latitude?: number; longitude?: number; address?: string }) => void;
  onBoundaryChange: (boundary: BoundaryPoint[]) => void;
  onOpenSettings: () => void;
  onSwitchToOpenStreetMap: () => void;
};

const asPoint = (latLng: any): BoundaryPoint => ({ lat: latLng.lat(), lng: latLng.lng() });

export function SiteMapPicker({ clientId, latitude, longitude, address, boundary, radiusMeters, overlays, spatialLayers, onSiteChange, onBoundaryChange, onOpenSettings, onSwitchToOpenStreetMap }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const boundaryObjectRef = useRef<any>(null);
  const boundaryMarkersRef = useRef<any[]>([]);
  const overlayObjectsRef = useRef<any[]>([]);
  const spatialObjectsRef = useRef<any[]>([]);
  const boundaryRef = useRef(boundary);
  const drawingRef = useRef(false);
  const onSiteChangeRef = useRef(onSiteChange);
  const onBoundaryChangeRef = useRef(onBoundaryChange);
  const [status, setStatus] = useState<"missing" | "loading" | "ready" | "error">(clientId ? "loading" : "missing");
  const [error, setError] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [query, setQuery] = useState(address);

  useEffect(() => { boundaryRef.current = boundary; }, [boundary]);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => { onSiteChangeRef.current = onSiteChange; }, [onSiteChange]);
  useEffect(() => { onBoundaryChangeRef.current = onBoundaryChange; }, [onBoundaryChange]);
  useEffect(() => { setQuery(address); }, [address]);

  useEffect(() => {
    if (!clientId.trim()) { setStatus("missing"); return; }
    let active = true;
    let clickListener: any;
    setStatus("loading");
    loadNaverMaps(clientId.trim()).then((naver) => {
      if (!active || !mapElement.current) return;
      const map = new naver.maps.Map(mapElement.current, { center: new naver.maps.LatLng(latitude, longitude), zoom: 18, mapTypeControl: true, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT } });
      mapRef.current = map;
      clickListener = naver.maps.Event.addListener(map, "click", (event: any) => {
        const point = asPoint(event.coord);
        if (drawingRef.current) onBoundaryChangeRef.current([...boundaryRef.current, point]);
        else onSiteChangeRef.current({ latitude: point.lat, longitude: point.lng });
      });
      setStatus("ready");
    }).catch(cause => { if (active) { setStatus("error"); setError(cause instanceof Error ? cause.message : "지도 연결에 실패했습니다."); } });
    return () => { active = false; if (clickListener && (window as any).naver?.maps) (window as any).naver.maps.Event.removeListener(clickListener); mapRef.current = null; };
  }, [clientId]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = (window as any).naver;
    if (!map || !naver?.maps) return;
    map.setCenter(new naver.maps.LatLng(latitude, longitude));
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = (window as any).naver;
    if (!map || !naver?.maps) return;
    boundaryObjectRef.current?.setMap?.(null);
    boundaryMarkersRef.current.forEach(marker => marker.setMap?.(null));
    boundaryMarkersRef.current = [];
    if (boundary.length < 2) return;
    const path = boundary.map(point => new naver.maps.LatLng(point.lat, point.lng));
    const shape = boundary.length >= 3
      ? new naver.maps.Polygon({ map, paths: path, strokeColor: "#a9684f", strokeOpacity: 1, strokeWeight: 2, fillColor: "#d69b78", fillOpacity: 0.18 })
      : new naver.maps.Polyline({ map, path, strokeColor: "#a9684f", strokeOpacity: 1, strokeWeight: 2 });
    boundaryObjectRef.current = shape;
    boundaryMarkersRef.current = boundary.map((point, index) => {
      const marker = new naver.maps.Marker({ map, position: new naver.maps.LatLng(point.lat, point.lng), draggable: true, title: `${index + 1}번 경계 정점` });
      naver.maps.Event.addListener(marker, "dragend", () => {
        const moved = asPoint(marker.getPosition());
        onBoundaryChangeRef.current(boundaryRef.current.map((item, itemIndex) => itemIndex === index ? moved : item));
      });
      return marker;
    });
    return () => { shape.setMap?.(null); boundaryMarkersRef.current.forEach(marker => marker.setMap?.(null)); };
  }, [boundary, status]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = (window as any).naver;
    if (!map || !naver?.maps) return;
    overlayObjectsRef.current.forEach(item => item.setMap?.(null));
    const center = new naver.maps.LatLng(latitude, longitude);
    const circle = new naver.maps.Circle({ map, center, radius: radiusMeters, strokeColor: "#46603e", strokeOpacity: .8, strokeWeight: 1, fillColor: "#88a77c", fillOpacity: .08 });
    const evidenceMarkers = overlays.map(item => new naver.maps.Marker({ map, position: new naver.maps.LatLng(item.latitude, item.longitude), title: `${item.source}: ${item.title}` }));
    overlayObjectsRef.current = [circle, ...evidenceMarkers];
    return () => overlayObjectsRef.current.forEach(item => item.setMap?.(null));
  }, [latitude, longitude, radiusMeters, overlays, status]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = (window as any).naver;
    if (!map || !naver?.maps) return;
    spatialObjectsRef.current.forEach(item => item.setMap?.(null));
    const objects: any[] = [];
    const toPath = (coordinates: unknown) => Array.isArray(coordinates) ? coordinates.filter(item => Array.isArray(item) && item.length >= 2 && Number.isFinite(Number(item[0])) && Number.isFinite(Number(item[1]))).map(item => new naver.maps.LatLng(Number(item[1]), Number(item[0]))) : [];
    spatialLayers.forEach(spatialLayer => spatialLayer.features.forEach(feature => {
      const geometry = feature.geometry;
      const color = spatialLayer.id === "vworldRoads" ? "#6b4f3b" : "#65745c";
      if (geometry.type === "LineString") objects.push(new naver.maps.Polyline({ map, path: toPath(geometry.coordinates), strokeColor: color, strokeOpacity: .72, strokeWeight: spatialLayer.id === "vworldRoads" ? 3 : 2 }));
      if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) geometry.coordinates.forEach(path => objects.push(new naver.maps.Polyline({ map, path: toPath(path), strokeColor: color, strokeOpacity: .72, strokeWeight: spatialLayer.id === "vworldRoads" ? 3 : 2 })));
      if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) objects.push(new naver.maps.Polygon({ map, paths: geometry.coordinates.map((ring: unknown) => toPath(ring)), strokeColor: color, strokeOpacity: .65, strokeWeight: 1, fillColor: color, fillOpacity: .12 }));
      if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) geometry.coordinates.forEach(polygon => objects.push(new naver.maps.Polygon({ map, paths: polygon.map((ring: unknown) => toPath(ring)), strokeColor: color, strokeOpacity: .65, strokeWeight: 1, fillColor: color, fillOpacity: .12 })));
    }));
    spatialObjectsRef.current = objects;
    return () => spatialObjectsRef.current.forEach(item => item.setMap?.(null));
  }, [spatialLayers, status]);

  const searchAddress = () => {
    const naver = (window as any).naver;
    if (!query.trim()) return setError("검색할 주소 또는 지번을 입력하세요.");
    if (!naver?.maps?.Service?.geocode) return setError("주소 검색 기능을 준비하지 못했습니다. 네이버 지도 Client ID와 geocoder 모듈을 확인하세요.");
    setError("");
    naver.maps.Service.geocode({ query: query.trim() }, (resultStatus: any, response: any) => {
      if (resultStatus !== naver.maps.Service.Status.OK || !response?.v2?.addresses?.length) return setError("주소 또는 지번을 찾지 못했습니다. 시·군·구부터 다시 입력해 보세요.");
      const place = response.v2.addresses[0];
      const lat = Number(place.y); const lng = Number(place.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError("검색 결과의 좌표가 올바르지 않습니다.");
      const position = new naver.maps.LatLng(lat, lng);
      mapRef.current?.setCenter(position); mapRef.current?.setZoom(18);
      onSiteChangeRef.current({ latitude: lat, longitude: lng, address: place.roadAddress || place.jibunAddress || query.trim() });
    });
  };

  const moveToCurrent = () => navigator.geolocation?.getCurrentPosition(position => {
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    onSiteChangeRef.current(next); mapRef.current?.setCenter(new (window as any).naver.maps.LatLng(next.latitude, next.longitude)); mapRef.current?.setZoom(18);
  }, () => setError("현재 위치를 가져오지 못했습니다. 브라우저 위치 권한을 확인하세요."));

  if (status === "missing") return <section className="mt-3 border border-dashed border-[#a9684f] bg-[#fbf3eb] p-5"><p className="font-serif text-xl text-stone-900">지도 기반 대지 선택을 준비하세요</p><p className="mt-2 text-sm leading-6 text-stone-600">네이버 지도 Web Dynamic Map Client ID를 설정하면 국내 주소·지번 검색, 지도 클릭, 폴리곤 경계 그리기와 정점 편집을 사용할 수 있습니다.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={onOpenSettings} className="bg-[#283126] text-white hover:bg-[#42503d]"><MapPin className="mr-2 h-4 w-4" />네이버 지도 설정 열기</Button><Button variant="outline" onClick={onSwitchToOpenStreetMap} className="border-stone-300">OpenStreetMap 백업으로 전환</Button></div></section>;
  return <section className="mt-3 overflow-hidden border border-stone-300 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-[#fbfaf7] p-3"><div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); searchAddress(); } }} placeholder="국내 도로명 주소·지번 검색" className="h-10 w-full border border-stone-300 bg-white pl-9 pr-24 text-sm outline-none focus:border-[#a9684f]" /><button type="button" onClick={searchAddress} className="absolute right-1 top-1 h-8 bg-[#283126] px-3 text-xs text-white">주소 검색</button></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={drawing ? "default" : "outline"} onClick={() => setDrawing(value => !value)} className={drawing ? "bg-[#a9684f] text-white" : "border-stone-300"}><PencilLine className="mr-1.5 h-4 w-4" />{drawing ? "그리기 종료" : "경계 그리기"}</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange(boundary.slice(0, -1))} disabled={!boundary.length} className="border-stone-300"><RotateCcw className="mr-1.5 h-4 w-4" />되돌리기</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange([])} disabled={!boundary.length} className="border-stone-300"><Trash2 className="mr-1.5 h-4 w-4" />경계 지우기</Button><Button size="sm" variant="outline" onClick={moveToCurrent} className="border-stone-300"><LocateFixed className="mr-1.5 h-4 w-4" />현재 위치</Button></div></div><div ref={mapElement} className="h-[420px] bg-stone-100" />{status === "loading" && <p className="p-3 text-sm text-stone-500">네이버 지도를 준비하고 있습니다…</p>}{error && <div className="border-t border-[#ebc8bc] bg-[#fff5f2] p-3 text-sm text-[#8b3a2d]"><p>{error}</p><Button size="sm" variant="outline" onClick={onSwitchToOpenStreetMap} className="mt-2 border-[#d7a79c]">OpenStreetMap 백업으로 전환</Button></div>}<div className="border-t border-stone-200 bg-[#fbfaf7] px-4 py-3 text-xs leading-5 text-stone-600">초록 원은 조사 반경({radiusMeters}m), 기본 마커는 위치가 있는 수집 근거입니다. <strong>경계 그리기</strong>를 누른 뒤 지도에서 정점을 클릭하고, 생성된 정점 마커를 끌어 미세하게 보정하세요.</div></section>;
}
