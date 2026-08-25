# VWorld 인증키 도메인 등록 정보

개인용 대지해석 작업대는 다음 GitHub Pages 주소로 배포되었습니다.

> **서비스 주소:** `https://cjg10040.github.io/architecture-site-analysis-t/`

VWorld 개발자센터에서 인증키를 신규 신청하거나 수정할 때, 서비스 URL 입력란에는 위 Pages 주소를 우선 사용한다. 입력란이 도메인만 받는 경우에는 `https://cjg10040.github.io`를 사용한다. 발급 화면의 형식 안내가 다르면 그 안내를 우선한다.

## 적용 순서

1. VWorld 개발자센터의 인증키 관리에서 현재 사용 중인 브라우저용 키를 선택한다.
2. 서비스 주소 또는 허용 도메인에 위 Pages 주소 또는 도메인을 추가한다.
3. 변경사항이 반영된 뒤 Pages 사이트의 **개인 키 설정**에서 VWorld 키를 입력하고 저장한다.
4. `VWorld 허용 URL`은 우선 비워둔다. 앱이 현재 Pages 서비스 URL을 브라우저 요청의 `domain` 파라미터로 자동 전송한다.
5. 대지의 위도·경도를 입력한 뒤 **VWorld 필지 후보 조회**를 실행한다.

브라우저 요청에는 VWorld 공식 문서가 요구하는 `domain` 파라미터가 포함된다. 키를 `https://cjg10040.github.io`처럼 루트 도메인으로 등록했다면 설정 화면의 `VWorld 허용 URL`에 동일한 값을 입력한다. 키를 Pages 전체 주소로 등록했다면 비워두거나 해당 Pages 주소를 입력한다.

브라우저에서 `Failed to fetch` 오류가 보이면 CORS·도메인 등록·브라우저 직접 호출 허용 조건을 확인한다. `INCORRECT_KEY`, `INVALID_KEY`가 보이면 키와 domain이 일치하지 않는 것이다. 사용량이 증가해도 도메인 검증 후 응답이 거부될 수 있다. 키는 GitHub 코드·이슈·JSON 내보내기 파일에 기록하지 않는다.
