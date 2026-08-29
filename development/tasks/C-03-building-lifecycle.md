# C-03 건축인허가·사용승인·폐쇄말소·건축연도 자료 연결

상위 TODO: `development/TODO.md` C-03
상태: 완료
작성일: 2026-08-29

## 목적

주변 건축물의 허가·착공·사용승인·변경·철거·말소·건축연도 정보를 하나의 현재값으로 뭉개지 않고, 건축물 생애 이벤트와 날짜별 출처로 보존한다.

## 이번 작업에 포함하는 것

- 생애 이벤트 타입 정의
- 허가·착공·사용승인·철거·말소·건축연도 필드 별칭 정의
- 날짜 정규화와 잘못된 날짜 처리
- 상태값과 이벤트 출처 저장
- B-04 식별자 결합 결과와 연결
- 동일 이벤트 유형의 날짜 충돌 보존
- 건축물 master에 생애 이벤트 연결
- 시간 자료 품질·누락·충돌 요약
- 건축연도와 사용승인일의 의미 구분

## 이번 작업에서 제외하는 것

- 건축HUB 실제 API 인증·네트워크 호출
- 인허가 적합성·법규 판단
- 철거 여부의 현장 확정
- 연도만으로 건축물 노후도 판정
- 건축물 시기별 도시 변화 분석
- AI 분석

## 이벤트 유형

```text
permit
: 건축허가·신고·허가일

start
: 착공일

completion
: 사용승인일·준공일

change
: 증축·개축·대수선·용도변경 등 변경

demolition
: 철거·멸실·말소 관련 날짜

constructionYear
: 건축연도만 제공되고 정확한 날짜가 없는 자료
```

이벤트가 없거나 의미가 불명확하면 생성하지 않는다.

## 날짜 원칙

```text
정확한 날짜
→ YYYY-MM-DD 형태로 정규화

연도만 있는 값
→ YYYY-01-01로 가장하지 않음
→ precision: year 저장

잘못된 날짜·미상
→ unknown

현재값과 이력
→ 현재값은 BuildingValue로, 이력은 event 배열로 별도 저장
```

## 자료 상태

```text
verified
: 해당 원본에 이벤트가 기록됨

candidate
: 식별자·주소 후보만 일치

unknown
: 자료 없음 또는 날짜 해석 불가

conflict
: 동일 이벤트 유형의 자료가 서로 다름
```

## 세부 TODO

- [x] BuildingLifecycleEvent와 날짜 precision 타입을 정의한다.
- [x] 허가·착공·사용승인·철거·말소·건축연도 별칭을 정의한다.
- [x] 정확한 날짜·연도만 있는 날짜·잘못된 날짜를 정규화한다.
- [x] sourceRefId·원본 필드·매칭 상태를 이벤트에 저장한다.
- [x] 생애자료 feature를 정규화 이벤트로 변환한다.
- [x] exact·strong 매칭 건축물에만 생애 이벤트를 자동 연결한다.
- [x] candidate·partial·conflict·unmatched 자료를 확정 이력에서 분리한다.
- [x] 동일 이벤트 유형 날짜 충돌을 보존한다.
- [x] BuildingRecord에 lifecycleEvents를 연결한다.
- [x] 생애자료 품질 요약을 반환한다.
- [x] 정상·연도만 있는 값·잘못된 날짜·충돌·후보 테스트를 작성한다.
- [x] C-03 결과를 `development/research/building-lifecycle.md`에 기록한다.

## 완료 조건

- 생애 이벤트와 현재 날짜값이 분리되어 있다.
- 날짜 precision이 day·year로 구분된다.
- 허가·착공·사용승인·변경·철거·말소 이벤트를 표현할 수 있다.
- 정확히 결합된 자료만 자동 연결된다.
- 후보·미확인·충돌 자료를 확정 이력으로 만들지 않는다.
- 출처·원본 필드·매칭 상태가 이벤트마다 연결된다.
- 날짜 누락·충돌·후보 건수를 요약할 수 있다.
- 테스트와 타입 검사가 통과한다.
- 실제 API 연결 전에 사용할 수 있는 생애자료 구조가 문서화되어 있다.

## 완료 기록

- 구현: `client/src/static/buildingLifecycle.ts`, `client/src/static/buildingDataModel.ts`
- 테스트: `client/src/static/buildingLifecycle.test.ts`
- 다음 작업: C-04 높이·층수·면적·용도 필드 정규화

## 검증 방법

- 날짜 정규화 및 precision 테스트
- 이벤트 별칭 테스트
- exact·strong·candidate·conflict 연결 테스트
- 동일 이벤트 충돌 보존 테스트
- 기존 BuildingRecord 역호환 테스트
- `pnpm check`
- `pnpm test`
- GitHub 원격 문서·코드·TODO 확인
