# OpenStreetMap 백업 지도 운영 원칙

네이버 지도 API의 인증·도메인·표현 오류 또는 위치 확인 차이에 대비해, 이 도구는 **OpenStreetMap 표준 타일과 Leaflet**을 대체 지도 모드로 제공합니다. 지도 제공자를 바꾸어도 프로젝트의 중심 좌표, 직접 그린 경계, GeoJSON, 조사 반경, 수집 근거 및 확정 필지 데이터는 변경하지 않습니다.

| 항목 | 구현 원칙 | 제한 |
|---|---|---|
| 지도 타일 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`을 표시하고 지도 위에 OpenStreetMap 저작자 표기를 유지합니다. | 공용 타일은 최선 노력 기반이므로 가용성이 보장되지 않으며, 오프라인 다운로드·대량 사전 로드는 금지합니다. |
| 주소 검색 | Nominatim의 국내(`countrycodes=kr`) 검색을 사용자가 주소 검색을 누를 때만 실행합니다. | 자동완성을 제공하지 않으며, 전체 사용량 합산 기준 초당 1건을 넘지 않게 제한합니다. |
| 검색 캐시 | 같은 검색어의 결과는 현재 브라우저 세션에서 재사용합니다. | 세션을 지우면 검색 캐시도 삭제됩니다. |
| 대지 경계 | 지도 클릭으로 정점을 추가하고, 각 정점 마커를 드래그하여 편집합니다. | 위치 정밀도와 지적 경계 일치는 VWorld·토지이음·현장 확인으로 별도 검증해야 합니다. |

> **조사 기준:** OpenStreetMap은 지도 확인 및 경계 입력의 백업 수단입니다. 인허가·경계 확정은 공적 지적도, 토지이음 및 현장 확인을 우선하며, OpenStreetMap 표현만으로 판단하지 않습니다.

## 참고 자료

1. [OpenStreetMap Foundation — Standard tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
2. [OpenStreetMap Foundation — Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
3. [Leaflet — Quick start guide](https://leafletjs.com/examples/quick-start/)
