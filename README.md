# 대지해석 개인 작업대

GitHub Pages에서 동작하는 개인 학습·과제용 정적 브라우저 도구입니다. 로그인·서버 데이터베이스 없이, 프로젝트와 조사 기록은 현재 브라우저의 로컬 저장소에 저장됩니다.

## 개인 API 키 원칙

VWorld·공공데이터포털·SGIS·OpenAI·Gemini·Anthropic 키는 코드·GitHub 저장소·JSON 내보내기 파일에 넣지 않습니다. 앱을 연 뒤 우측 **개인 키 설정**에서 직접 입력하면 해당 브라우저 세션에만 저장됩니다. 공용 기기에서는 사용을 마친 뒤 `세션 키 지우기`를 누르세요.

## 데이터 보관

조사 프로젝트는 `내보내기`로 JSON 백업 파일을 만들고, 다른 기기에서는 `불러오기`로 다시 열 수 있습니다. JSON 파일에는 API 키가 포함되지 않습니다.

## GitHub Pages

1. GitHub에서 이 저장소의 **Settings → Pages**를 열고 Source를 **GitHub Actions**로 선택합니다.
2. `main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 정적 앱을 배포합니다.
3. 현재 배포 주소는 `https://cjg10040.github.io/architecture-site-analysis-m/`입니다.
4. VWorld 개발자센터의 인증키 허용 도메인에는 `https://cjg10040.github.io`를 등록합니다. 입력란이 서비스 주소를 요구하면 전체 Pages 주소를 사용하며, 발급 화면의 안내를 우선합니다.

## 제한

GitHub Pages는 정적 호스팅입니다. 브라우저 직접 호출을 허용하지 않는 API는 CORS 정책에 따라 동작하지 않을 수 있으며, 이 경우 결과를 수동 기록하거나 제공자가 허용하는 도메인·브라우저 API 계약을 확인해야 합니다.
