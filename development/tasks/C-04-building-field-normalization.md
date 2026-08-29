# C-04 높이·층수·면적·구조·용도 필드 정규화

상위 TODO: `development/TODO.md` C-04
상태: 완료
작성일: 2026-08-29

## 목적

자료원마다 다른 단위·필드명·문자 표현을 공통 건축물 필드로 변환하되, 공식값·프로그램 계산값·추정값·미확인값을 구분한다.

## 이번 작업에 포함하는 것

- 높이·층수·면적·비율·용도·구조 필드의 공통 정의
- 숫자·단위·쉼표·공백 정규화
- 지상·지하층수의 정수 검증
- 높이와 층수의 의미 분리
- 건축면적·연면적·footprint 계산면적의 분리
- 용도 문자열의 표준화와 원본값 보존
- 공식값·계산값·추정값·미확인값 상태 정의
- 기존 속성 보강 흐름에 공통 정규화 함수 적용
- 비정상값·단위 오류·범위 이상값의 표시

## 이번 작업에서 제외하는 것

- 실제 건축HUB·VWorld API 호출
- 건축물 용도 분류의 AI 판단
- 건축연도·허가 이력 연결
- 법정 건폐율·용적률 판정
- 건축물 공간관계 계산
- 분석 지표·시각화·AI 분석

## 공통 필드 의미

```text
footprintAreaSqm
: geometry에서 계산한 지표면 형상 면적. 건축면적과 다름

buildingAreaSqm
: 공식 건축면적. 출처가 없으면 계산면적으로 대체하지 않음

grossFloorAreaSqm
: 공식 연면적. footprint 면적과 층수 곱으로 추정하지 않음

aboveGroundFloors / belowGroundFloors
: 공식 또는 원자료에 기록된 지상·지하층수

heightMeters
: 공식 높이. 층수로 환산하지 않음

coverageRatio / floorAreaRatio
: 공식 비율 또는 출처가 명확한 값. geometry 계산값과 구분
```

## 값 상태

```text
verified
: 원자료에 해당 필드가 있고 단위·의미를 확인할 수 있음

calculated
: geometry 또는 명시적 계산식으로 프로그램이 계산함

estimated
: 명시적으로 추정된 값. 법정·공식값으로 사용 금지

unknown
: 자료 없음·빈 값·의미 불명확·정규화 실패

conflict
: 자료 간 값이 충돌함
```

이번 작업에서는 자동 추정값을 새로 만들지 않는다. 기존 geometry 계산값은 `calculated`로만 표시한다.

## 단위 원칙

```text
㎡, m², sqm → 면적 숫자
m, meter, 미터 → 높이 숫자
%, percent → 비율 숫자
층, floor → 층수 숫자
```

단위 없는 값은 원자료의 필드 의미가 명확할 때만 사용한다. 불명확하면 원본을 보존하고 `unknown`으로 둔다.

## 세부 TODO

- [x] BuildingValue에 rawValue·unit·normalizationMethod를 추가한다.
- [x] 필드별 표준 단위와 값 상태 타입을 정의한다.
- [x] 면적·높이·비율 숫자 정규화 함수를 구현한다.
- [x] 지상·지하층수 정수 검증을 구현한다.
- [x] 비정상 음수·무한값·과도한 값의 처리 기준을 구현한다.
- [x] 용도·구조 문자열의 공백·원본값 보존 규칙을 구현한다.
- [x] 기존 `normalizeBuildingAttributes()`를 공통 정규화 함수에 연결한다.
- [x] footprint 계산면적과 공식 건축면적을 구분해 저장한다.
- [x] 공식값·계산값·추정값·미확인값을 테스트한다.
- [x] 단위·층수·비율·비정상값 테스트를 작성한다.
- [x] C-04 결과를 `development/research/building-field-normalization.md`에 기록한다.

## 완료 조건

- 공통 건축물 필드의 의미와 단위가 문서·코드에 동일하게 정의되어 있다.
- 높이·층수·footprint 면적·건축면적·연면적이 서로 대체되지 않는다.
- 공식·계산·추정·미확인·충돌 상태를 표현할 수 있다.
- 용도·구조 원본값과 정규화값을 함께 보존할 수 있다.
- 비정상 숫자를 사실값으로 저장하지 않는다.
- 기존 속성 보강 흐름에서 공통 정규화가 적용된다.
- 테스트와 타입 검사가 통과한다.

## 완료 기록

- 구현: `client/src/static/buildingFieldNormalization.ts`, `client/src/static/buildingAttributeEnrichment.ts`, `client/src/static/buildingDataModel.ts`
- 테스트: `client/src/static/buildingFieldNormalization.test.ts`
- 다음 작업: C-05 건축물별 통합 마스터와 결합 신뢰도 생성

## 검증 방법

- ㎡·m²·m·%·층 단위 테스트
- 지상·지하층수 정수·음수·소수 테스트
- 공식 건축면적과 계산 footprint 분리 테스트
- 빈 값·비정상값·단위 없는 값 테스트
- 용도·구조 공백 정규화 테스트
- `pnpm check`
- `pnpm test`
- GitHub 원격 문서·코드·TODO 확인
