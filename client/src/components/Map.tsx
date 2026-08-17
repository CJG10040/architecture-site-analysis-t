/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    __manusMapsReady?: () => void;
  }
}

const MAP_SCRIPT_ID = "manus-google-maps-sdk";
const MAPS_SDK_ENDPOINT = "/api/maps/sdk.js";

let mapScriptPromise: Promise<void> | null = null;

function loadMapScript() {
  if (window.google?.maps) return Promise.resolve();
  if (mapScriptPromise) return mapScriptPromise;
  mapScriptPromise = new Promise((resolve, reject) => {
    document.getElementById(MAP_SCRIPT_ID)?.remove();
    const script = document.createElement("script");
    let settled = false;
    let readyPoll: number | undefined;
    let readyTimeout: number | undefined;
    const clearPending = () => {
      if (readyPoll) window.clearInterval(readyPoll);
      if (readyTimeout) window.clearTimeout(readyTimeout);
      delete window.__manusMapsReady;
    };
    const finish = () => {
      if (settled || !window.google?.maps?.Map) return;
      settled = true;
      clearPending();
      resolve();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      mapScriptPromise = null;
      clearPending();
      script.remove();
      reject(new Error(message));
    };
    script.id = MAP_SCRIPT_ID;
    script.src = MAPS_SDK_ENDPOINT;
    script.async = true;
    window.__manusMapsReady = () => {
      finish();
    };
    script.onload = () => {
      finish();
    };
    script.onerror = () => {
      fail("Google Maps 스크립트를 불러오지 못했습니다.");
    };
    readyPoll = window.setInterval(finish, 100);
    readyTimeout = window.setTimeout(() => fail("Google Maps SDK 초기화 시간이 초과되었습니다."), 15_000);
    document.head.appendChild(script);
  });
  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");

  const init = usePersistFn(async () => {
    try {
      setMapState("loading");
      await loadMapScript();
      if (!mapContainer.current || !window.google?.maps) throw new Error("지도 컨테이너를 초기화하지 못했습니다.");
      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: initialZoom,
        center: initialCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
        mapId: "DEMO_MAP_ID",
      });
      setMapState("ready");
      onMapReady?.(map.current);
    } catch (error) {
      console.error("Google Maps unavailable", error);
      setMapState("error");
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return <div className={cn("relative w-full h-[500px] bg-[#ebe7de]", className)}>
    <div ref={mapContainer} className="h-full w-full" />
    {mapState !== "ready" && <div className="absolute inset-0 grid place-items-center bg-[#ebe7de]/90 p-6 text-center">
      <div>
        <p className="font-mono text-[10px] tracking-[0.18em] text-[#8b4a38]">GOOGLE MAPS</p>
        <p className="mt-2 font-serif text-xl text-stone-800">{mapState === "loading" ? "공간 정보를 준비하고 있습니다." : "지도를 불러오지 못했습니다."}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">{mapState === "loading" ? "대지 중심과 분석 반경은 지도 로드 후 즉시 표시됩니다." : "네트워크 연결을 확인한 뒤 새로고침해 주세요. 대지 좌표와 분석 기록은 유지됩니다."}</p>
      </div>
    </div>}
  </div>;
}
