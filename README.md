# 대지해석 개인 작업대

GitHub Pages에서 동작하는 개인 학습·과제용 정적 브라우저 도구입니다. 로그인·서버 데이터베이스 없이, 프로젝트와 조사 기록은 현재 브라우저의 로컬 저장소에 저장됩니다.

## 개인 API 키 원칙

네이버 지도 Client ID, VWorld·공공데이터포털·SGIS·OpenAI·Gemini·Anthropic 키는 코드·GitHub 저장소·JSON 내보내기 파일에 넣지 않습니다. 앱을 연 뒤 우측 **API 설정**에서 직접 입력하면 해당 브라우저 세션에만 저장됩니다. 공용 기기에서는 사용을 마친 뒤 `세션 키 지우기`를 누르세요.

## 데이터 보관

조사 프로젝트는 `내보내기`로 JSON 백업 파일을 만들고, 다른 기기에서는 `불러오기`로 다시 열 수 있습니다. JSON 파일에는 API 키가 포함되지 않습니다.

## GitHub Pages

1. GitHub에서 이 저장소의 **Settings → Pages**를 열고 Source를 **GitHub Actions**로 선택합니다.
2. `main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 정적 앱을 배포합니다.
3. 현재 배포 주소는 `https://cjg10040.github.io/architecture-site-analysis-t/`입니다.
4. VWorld 개발자센터의 인증키 허용 도메인에는 `https://cjg10040.github.io`를 등록합니다. 입력란이 서비스 주소를 요구하면 전체 Pages 주소를 사용하며, 발급 화면의 안내를 우선합니다.

## 네이버 지도 설정

1. NAVER CLOUD PLATFORM 콘솔에서 **Services → Application Services → Maps → Application**으로 이동해 Application을 등록합니다.
2. 서비스 선택에서 **Web Dynamic Map**을 활성화하고, Web 서비스 URL에 `https://cjg10040.github.io`를 등록합니다.
3. 발급된 **Client ID만** 앱의 **API 설정 → 네이버 지도**에 입력하거나 키 JSON 파일의 `naverMapsClientId` 필드에 넣습니다. 이 정적 도구는 지도 SDK에 Client Secret을 입력하지 않습니다.
4. 연결 확인 뒤에는 국내 도로명 주소·지번 검색, 지도 클릭, 경계 정점 추가·드래그 보정, 조사 반경과 수집 근거 오버레이를 사용할 수 있습니다.

네이버 지도 Web Dynamic Map은 JavaScript SDK로 제공되며, Client ID와 `Dynamic Map` 서비스 선택이 필요합니다. 서비스 선택이 누락되면 할당량 오류가 발생할 수 있습니다. [네이버 지도 API v3 시작 가이드](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)와 [Client ID 발급 안내](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html)를 함께 확인하세요.

## OpenStreetMap 백업 지도

지도 상단의 **OpenStreetMap 백업**을 선택하면 네이버 지도 Client ID 오류나 표현 차이를 확인할 때도 지도 클릭, 경계 정점 드래그 보정, 조사 반경, 수집 근거 마커를 계속 사용할 수 있습니다. 주소 검색은 공용 Nominatim 서비스의 정책에 맞춰 자동완성이 아닌 **사용자 클릭형 검색**으로만 실행하며, 1초 요청 간격과 현재 세션 캐시를 적용합니다. OpenStreetMap 표준 타일과 Nominatim은 개인용·적정량 사용을 전제로 하며 대량 다운로드, 오프라인 사전 저장, 반복 자동 조회에는 사용할 수 없습니다. [타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/)과 [Nominatim 사용 정책](https://operations.osmfoundation.org/policies/nominatim/)을 확인하세요.

## 제한

GitHub Pages는 정적 호스팅입니다. 브라우저 직접 호출을 허용하지 않는 API는 CORS 정책에 따라 동작하지 않을 수 있으며, 이 경우 결과를 수동 기록하거나 제공자가 허용하는 도메인·브라우저 API 계약을 확인해야 합니다.
