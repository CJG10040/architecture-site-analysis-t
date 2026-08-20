# API 연결 및 사전 자동조사 점검 기록

2026-08-20 기준으로 저장된 암호화 자격증명을 사용해 실제 경량 요청을 재점검했다. 키 원문은 이 기록, 소스 코드, 일반 로그에 포함하지 않는다.

| 제공기관·데이터원 | 실제 상태 | 사전조사 처리 원칙 |
|---|---|---|
| VWorld 연속지적도 | 원천 API와 VWorld 웹사이트가 502 응답을 반환했다. | 원천 오류를 성공으로 표시하지 않는다. 광주 5개 구 활성 로컬 연속지적도에서 좌표 기반 필지 후보를 반환하고, 출처를 `로컬 연속지적도 대체`로 명시한다. |
| SGIS | 인증과 시·군·구 통계 경량 요청이 HTTP 200으로 성공했다. | 확정 PNU가 있으면 인구·가구·사업체를 사전 수집한다. PNU가 없을 때에는 주소·경계 기반 데이터는 계속 수집하고 SGIS만 보류 사유를 표시한다. |
| 에어코리아 | 공공데이터포털의 측정소별 실시간 측정정보 서비스가 공식 공개되어 있다. | 주소에서 인근 측정소를 찾고, 대지 직접값이 아닌 측정소 관측값임을 표시한 뒤 사전 수집한다. |
| Open-Meteo DEM | 중심점 150m × 150m 표본의 24개 고도값 응답을 실제로 확인했다. | 그린 경계 전에는 중심점 임시 범위로 고도·경사·단면을 조사하고, 경계 저장 후 정확 범위로 다시 실행한다. |

> 사전 자동조사는 설계 초기에 확인할 수 있는 공공·공개 데이터의 근거를 모으는 단계다. 현장에서는 건물 높이, 실제 보행 접근, 차폐, 옹벽·레벨차, 운영 상태처럼 원천 데이터가 확정하지 못하는 항목만 검증한다.

## 공식 참고

- [VWorld](https://www.vworld.kr/)는 국가공간정보 조회·활용 서비스이나, 이번 점검 시 502 응답이 확인됐다.
- [한국환경공단 에어코리아 측정소별 실시간 측정정보 서비스](https://www.data.go.kr/data/15156659/openapi.do?recommendDataYn=Y)는 공공데이터포털에서 제공되는 측정소 기반 대기질 서비스다.
- 사용자가 제공한 [SGIS 데이터 API 기본 안내](https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/basics.html)는 인증 요청을 `https://sgisapi.mods.go.kr/OpenAPI3/auth/authentication.json`으로 안내한다. [SGIS 센서스 통계 안내](https://sgis.mods.go.kr/developer/html/newOpenApi/api/dataApi/census.html)는 인구 통계 요청을 `https://sgisapi.mods.go.kr/OpenAPI3/stats/population.json`으로 안내하며, `accessToken`, `year`, 선택 `adm_cd`, 선택 `low_search`를 사용한다. 따라서 구현은 현재 공식 `sgisapi.mods.go.kr` 도메인과 5자리 시·군·구 센서스 코드를 기준으로 유지한다.
- 사용자가 제공한 **생활안전정보 OpenAPI 활용가이드 Ver1.7**은 주제도 호출 서버를 `http://www.safemap.go.kr/openApiService/wms/getLayerData.do?apikey=[APIKEY]`로, 방범등 레이어를 `A2SM_CMMNPOI_SECULIGHT`, 스타일을 `A2SM_CMMNPOI_07`로 안내한다. 구현을 이 계약으로 전환해 실제 키를 확인한 결과 HTTP 200이지만 이미지 대신 서비스 500 HTML을 반환했다. 따라서 현재 키는 safeData·방범등 레이어에 대한 서비스 권한 또는 서버 측 이용 상태를 추가 확인해야 하며, 작업대는 이를 수집 성공으로 표시하지 않는다.
