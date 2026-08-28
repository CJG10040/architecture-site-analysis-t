# 자료 연결 방법

이 문서는 설정 화면의 `자료별 발급·연결 사이트`와 함께 사용하는 사용자용 절차다. API 키·Client Secret은 채팅, GitHub, 프로젝트 JSON에 올리지 않는다.

## 1. VWorld

1. VWorld에서 회원가입·로그인한다.
2. Open API/개발자센터에서 2D Data API와 WMS/WFS 사용 키를 발급한다.
3. 키 설정의 허용 URL에는 현재 Pages 주소 또는 등록한 루트 domain을 넣는다.
4. 설정 화면의 VWorld 인증키와 허용 URL에 입력한다.
5. `연결 확인` 후 대지 화면에서 필지·건축물·도로·용도지역·생활권 자료를 수집한다.
6. `INVALID_KEY`, `INCORRECT_KEY`, `UNAVAILABLE_KEY`가 나오면 키 값은 공유하지 말고 오류 코드와 등록 domain 형식만 확인한다.

공식 사이트: https://www.vworld.kr/

## 2. 공공데이터포털

1. 공공데이터포털 회원가입·로그인한다.
2. 사용할 데이터셋에서 `활용신청`을 한다.
3. 서비스별 일반 인증키/ServiceKey와 활용 승인 상태를 확인한다.
4. 설정 화면에 ServiceKey를 입력한다.
5. `연결 확인` 후 공원·시설 등 승인된 서비스를 선택한다.
6. 브라우저 CORS 또는 서비스 미승인으로 실패하면 해당 데이터셋의 JSON·CSV·XML 원본을 내려받아 `원본 파일 가져오기`로 추가한다.

현재 직접 연결 대상 예시:

- 토지임야정보: https://www.data.go.kr/data/15123884/openapi.do
- 건축물·용도별건물정보: https://www.data.go.kr/data/15123458/openapi.do
- 용도지역지구도: https://www.data.go.kr/data/15058773/openapi.do
- 토지이용규제정보: https://www.data.go.kr/data/15058410/openapi.do
- 하천망: https://www.data.go.kr/data/15058825/openapi.do

## 3. SGIS

1. SGIS 개발자센터에서 이용신청·개발자 등록을 한다.
2. Client ID와 Client Secret을 발급한다.
3. 설정 화면 SGIS 카드에 두 값을 모두 입력한다.
4. `연결 확인`으로 인증 응답을 확인한다.
5. 대지 화면에서 SGIS 인구·가구·주택 또는 사업체 통계를 선택해 수집한다.
6. SGIS 통계는 필지 직접값이 아니라 역지오코딩된 행정구역·집계구 통계다.

공식 사이트: https://sgis.mods.go.kr/developer/html/newOpenApi/api/intro.html

## 4. NAVER 지도

1. NAVER Cloud Console에서 Maps Application을 만든다.
2. Web Dynamic Map을 활성화한다.
3. Web 서비스 URL에 Pages 주소를 등록한다.
4. Client ID를 설정 화면에 입력한다.
5. Client Secret은 정적 지도 화면에 입력하지 않는다.

공식 사이트: https://console.ncloud.com/maps

## 5. 키가 필요 없는 자료

다음 자료는 별도 API 키 없이 자동 연결을 시도한다.

- 고도·대기질: Open-Meteo
- 하천·수로·수면 표본: OpenStreetMap Overpass

OSM 수계자료는 매핑된 수로·수면 표본이다. 침수위험·배수능력·법정 하천경계를 의미하지 않는다.

## 6. ITS 교통자료

1. ITS 표준노드링크에서 표준노드·링크 원자료를 확인한다.
2. 필요한 지역의 링크 데이터와 `LINK_ID`를 확보한다.
3. 현재 VWorld 도로 링크의 `LINK_ID`와 공간 범위·갱신일을 비교한다.
4. 매칭되는 교통량 자료가 있으면 CSV/JSON으로 가져온다.
5. 매칭되지 않으면 교통량은 미확인으로 둔다.

공식 사이트: https://www.its.go.kr/nodelink/

## 7. 소음

대지 단위의 신뢰할 수 있는 소음값을 임의로 생성하지 않는다.

1. 국가소음정보시스템 또는 지자체 측정자료의 원본을 확보한다.
2. 측정일·시각·위치·기기·단위·값·날씨·활동을 확인한다.
3. 원본 CSV/JSON/TXT를 가져오거나 상세 조사에 직접 기록한다.
4. 스마트폰 측정은 공식값이 아닌 현장 참고 측정으로 표시한다.

공식 사이트: https://www.noiseinfo.or.kr/

## 8. 침수·배수

1. 국토교통부 하천망 또는 WAMIS 자료를 확인한다.
2. 지자체 침수흔적도·재해위험지도·배수구역 자료를 확인한다.
3. GeoJSON·CSV·SHP를 GeoJSON으로 변환하거나 원본을 가져온다.
4. 파일의 좌표계·기준일·위험등급·공간범위를 함께 기록한다.
5. 하천 존재만으로 침수위험을 판단하지 않는다.

공식 사이트:

- https://www.data.go.kr/data/15058825/openapi.do
- https://www.wamis.go.kr/
- https://safemap.go.kr/

## 9. 항공영상·시계열 변화

1. VWorld·지자체·공공기관에서 촬영일이 확인되는 영상을 확보한다.
2. 비교 시점과 출처를 기록한다.
3. 이미지·GeoTIFF·원본 설명 파일을 `원본 파일 가져오기`로 저장한다.
4. 신축·철거·녹지·유휴 변화는 영상 판독과 현장 확인을 구분한다.

현재 날짜가 없는 배경 항공사진만으로 과거·현재 변화를 자동 확정하지 않는다.
