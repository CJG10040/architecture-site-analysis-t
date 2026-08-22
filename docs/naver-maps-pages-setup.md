# 네이버 지도 Web Dynamic Map · GitHub Pages 설정

이 도구의 지도 기반 대지 선택은 **NAVER Maps JavaScript API v3의 Web Dynamic Map**을 사용합니다. 지도 SDK는 Client ID를 페이지에 전달해 로드하고, `geocoder` 서브모듈로 국내 도로명 주소·지번을 좌표로 변환합니다. REST Geocoding API의 Client Secret을 브라우저에 노출하지 않기 위해, 이 개인용 정적 도구는 Web Dynamic Map Client ID만 세션에 보관합니다.

| 단계 | Ncloud 콘솔에서 할 작업 | 이 도구에서 할 작업 |
|---|---|---|
| 1 | **Services → Application Services → Maps → Application**에서 애플리케이션을 등록합니다. | 아직 키를 입력하지 않습니다. |
| 2 | 서비스 선택에 **Web Dynamic Map**이 포함되었는지 확인합니다. 누락 시 `429 Quota Exceed`가 날 수 있습니다. | — |
| 3 | Web 서비스 URL에 `https://cjg10040.github.io`를 등록합니다. | — |
| 4 | Client ID를 복사합니다. Client Secret은 이 지도 SDK에 필요하지 않습니다. | **API 설정 → 네이버 지도 → Web Dynamic Map Client ID**에 입력하고 연결 확인을 누릅니다. |
| 5 | 주소·지번 검색과 지도 클릭으로 중심점을 정하고, 경계 그리기 후 정점 마커를 드래그해 경계를 보정합니다. | 조사 반경과 수집 근거 마커를 함께 확인합니다. |

> **보안 원칙:** Client ID는 현재 브라우저 세션에만 저장되며, 프로젝트 JSON 내보내기·Git 저장소·조사 결과에는 포함되지 않습니다. 개인 과제용 도구이므로 공용 기기에서는 작업 후 세션 키를 지우세요.

## 참고 자료

1. [NAVER Maps JavaScript API v3 — 시작하기](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)
2. [NAVER Maps JavaScript API v3 — Client ID 발급](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html)
3. [Naver Cloud Maps — Web Dynamic Map API](https://guide.ncloud-docs.com/docs/maps-web-sdk)
