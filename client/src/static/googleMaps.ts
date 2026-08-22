declare global { interface Window { google?: any } }

let pendingLoad: Promise<any> | null = null;

export function googleMapsScriptUrl(key: string) {
  const params = new URLSearchParams({ key, libraries: "places,geometry", v: "weekly", language: "ko", region: "KR" });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

export function loadGoogleMaps(key: string): Promise<any> {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (pendingLoad) return pendingLoad;
  pendingLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "site-study-google-maps";
    script.async = true;
    script.src = googleMapsScriptUrl(key);
    script.onload = () => (window as any).google?.maps ? resolve((window as any).google) : reject(new Error("Google Maps SDK를 초기화하지 못했습니다."));
    script.onerror = () => reject(new Error("Google Maps를 불러오지 못했습니다. 키·Maps JavaScript API·Pages 도메인 등록을 확인하세요."));
    document.head.appendChild(script);
  }).catch(error => { pendingLoad = null; throw error; });
  return pendingLoad;
}
