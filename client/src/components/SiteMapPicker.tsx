import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoundaryPoint, MapOverlay } from "@/static/model";
import { loadGoogleMaps } from "@/static/googleMaps";

type Props = {
  apiKey: string;
  latitude: number;
  longitude: number;
  address: string;
  boundary: BoundaryPoint[];
  radiusMeters: number;
  overlays: MapOverlay[];
  onSiteChange: (change: { latitude?: number; longitude?: number; address?: string }) => void;
  onBoundaryChange: (boundary: BoundaryPoint[]) => void;
  onOpenSettings: () => void;
};

const asPoint = (latLng: any): BoundaryPoint => ({ lat: latLng.lat(), lng: latLng.lng() });

export function SiteMapPicker({ apiKey, latitude, longitude, address, boundary, radiusMeters, overlays, onSiteChange, onBoundaryChange, onOpenSettings }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const overlayObjectsRef = useRef<any[]>([]);
  const boundaryRef = useRef(boundary);
  const [status, setStatus] = useState<"missing" | "loading" | "ready" | "error">(apiKey ? "loading" : "missing");
  const [error, setError] = useState("");
  const [drawing, setDrawing] = useState(false);

  useEffect(() => { boundaryRef.current = boundary; }, [boundary]);
  useEffect(() => {
    if (!apiKey.trim()) { setStatus("missing"); return; }
    let active = true;
    setStatus("loading");
    loadGoogleMaps(apiKey.trim()).then(() => {
      if (!active || !mapElement.current) return;
      const map = new (window as any).google.maps.Map(mapElement.current, { center: { lat: latitude, lng: longitude }, zoom: 18, mapTypeControl: true, streetViewControl: false, fullscreenControl: true, gestureHandling: "greedy" });
      mapRef.current = map;
      const autocomplete = new (window as any).google.maps.places.Autocomplete(searchInput.current!, { fields: ["geometry", "formatted_address", "name"], componentRestrictions: { country: "kr" } });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place.geometry?.location;
        if (!location) { setError("검색 결과에 지도 위치가 없습니다."); return; }
        map.panTo(location); map.setZoom(18);
        onSiteChange({ latitude: location.lat(), longitude: location.lng(), address: place.formatted_address ?? place.name ?? address });
      });
      map.addListener("click", (event: any) => {
        const location = event.latLng;
        if (!location) return;
        const point = asPoint(location);
        if (drawing) onBoundaryChange([...boundaryRef.current, point]);
        else onSiteChange({ latitude: point.lat, longitude: point.lng });
      });
      setStatus("ready");
    }).catch(cause => { if (active) { setStatus("error"); setError(cause instanceof Error ? cause.message : "지도 연결에 실패했습니다."); } });
    return () => { active = false; };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(window as any).google?.maps) return;
    map.panTo({ lat: latitude, lng: longitude });
    polygonRef.current?.setMap(null);
    if (boundary.length < 2) return;
    const polygon = new (window as any).google.maps.Polygon({ paths: boundary, map, editable: true, draggable: false, strokeColor: "#a9684f", strokeOpacity: 1, strokeWeight: 2, fillColor: "#d69b78", fillOpacity: 0.18 });
    polygonRef.current = polygon;
    const syncPath = () => onBoundaryChange(polygon.getPath().getArray().map(asPoint));
    polygon.getPath().addListener("set_at", syncPath);
    polygon.getPath().addListener("insert_at", syncPath);
    polygon.getPath().addListener("remove_at", syncPath);
    return () => polygon.setMap(null);
  }, [boundary, onBoundaryChange]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !(window as any).google?.maps) return;
    overlayObjectsRef.current.forEach(item => item.setMap?.(null));
    const circle = new (window as any).google.maps.Circle({ map, center: { lat: latitude, lng: longitude }, radius: radiusMeters, strokeColor: "#46603e", strokeOpacity: .8, strokeWeight: 1, fillColor: "#88a77c", fillOpacity: .08 });
    const markers = overlays.map(item => new (window as any).google.maps.Marker({ map, position: { lat: item.latitude, lng: item.longitude }, title: `${item.source}: ${item.title}`, icon: { path: (window as any).google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#a9684f", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1 } }));
    overlayObjectsRef.current = [circle, ...markers];
    return () => overlayObjectsRef.current.forEach(item => item.setMap?.(null));
  }, [latitude, longitude, radiusMeters, overlays]);

  const moveToCurrent = () => navigator.geolocation?.getCurrentPosition(position => {
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    onSiteChange(next); mapRef.current?.panTo({ lat: next.latitude, lng: next.longitude }); mapRef.current?.setZoom(18);
  }, () => setError("현재 위치를 가져오지 못했습니다. 브라우저 위치 권한을 확인하세요."));

  if (status === "missing") return <section className="mt-5 border border-dashed border-[#a9684f] bg-[#fbf3eb] p-5"><p className="font-serif text-xl text-stone-900">지도 기반 대지 선택을 준비하세요</p><p className="mt-2 text-sm leading-6 text-stone-600">Google Maps 브라우저 키를 설정하면 주소 검색, 지도 클릭, 폴리곤 경계 그리기와 편집을 사용할 수 있습니다.</p><Button onClick={onOpenSettings} className="mt-4 bg-[#283126] text-white hover:bg-[#42503d]"><MapPin className="mr-2 h-4 w-4" />지도 키 설정 열기</Button></section>;
  return <section className="mt-5 overflow-hidden border border-stone-300 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-[#fbfaf7] p-3"><div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" /><input ref={searchInput} defaultValue={address} placeholder="주소·지번·장소 검색" className="h-10 w-full border border-stone-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#a9684f]" /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={drawing ? "default" : "outline"} onClick={() => setDrawing(value => !value)} className={drawing ? "bg-[#a9684f] text-white" : "border-stone-300"}><PencilLine className="mr-1.5 h-4 w-4" />{drawing ? "그리기 종료" : "경계 그리기"}</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange(boundary.slice(0, -1))} disabled={!boundary.length} className="border-stone-300"><RotateCcw className="mr-1.5 h-4 w-4" />되돌리기</Button><Button size="sm" variant="outline" onClick={() => onBoundaryChange([])} disabled={!boundary.length} className="border-stone-300"><Trash2 className="mr-1.5 h-4 w-4" />경계 지우기</Button><Button size="sm" variant="outline" onClick={moveToCurrent} className="border-stone-300"><LocateFixed className="mr-1.5 h-4 w-4" />현재 위치</Button></div></div><div ref={mapElement} className="h-[420px] bg-stone-100" />{status === "loading" && <p className="p-3 text-sm text-stone-500">지도를 준비하고 있습니다…</p>}{error && <p className="border-t border-[#ebc8bc] bg-[#fff5f2] p-3 text-sm text-[#8b3a2d]">{error}</p>}<div className="border-t border-stone-200 bg-[#fbfaf7] px-4 py-3 text-xs leading-5 text-stone-600">초록 원은 조사 반경({radiusMeters}m), 테라코타 점은 위치가 있는 수집 근거입니다. 검색 결과를 선택해 대지 중심을 잡고, <strong>경계 그리기</strong>를 누른 뒤 지도에서 정점을 클릭하세요.</div></section>;
}
