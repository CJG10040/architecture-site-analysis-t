declare global { interface Window { naver?: any; navermap_authFailure?: () => void } }

let pendingLoad: Promise<any> | null = null;

export function naverMapsScriptUrl(clientId: string) {
  const params = new URLSearchParams({ ncpKeyId: clientId, submodules: "geocoder" });
  return `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;
}

export function loadNaverMaps(clientId: string): Promise<any> {
  if ((window as any).naver?.maps) return Promise.resolve((window as any).naver);
  if (pendingLoad) return pendingLoad;
  pendingLoad = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "site-study-naver-maps";
    script.async = true;
    (window as any).navermap_authFailure = () => reject(new Error("네이버 지도 Client ID 또는 Web Dynamic Map 등록 도메인을 확인하세요."));
    script.src = naverMapsScriptUrl(clientId);
    script.onload = () => (window as any).naver?.maps ? resolve((window as any).naver) : reject(new Error("네이버 지도 SDK를 초기화하지 못했습니다."));
    script.onerror = () => reject(new Error("네이버 지도 SDK를 불러오지 못했습니다. Client ID와 Web Dynamic Map 등록 도메인을 확인하세요."));
    document.head.appendChild(script);
  }).catch(error => { pendingLoad = null; throw error; });
  return pendingLoad;
}
