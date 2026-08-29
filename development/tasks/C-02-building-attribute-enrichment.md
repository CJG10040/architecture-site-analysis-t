# C-02 용도별건물정보·건축HUB 속성자료 연결

상위 TODO: `development/TODO.md` C-02
상태: 완료
작성일: 2026-08-29

## 목적

VWorld `lt_c_spbd` footprint에 용도별건물정보와 향후 건축HUB 속성자료를 연결하되, 원본 속성·정규화 값·결합 상태·충돌을 분리한다.

## 이번 작업에 포함하는 것

- 용도·층수·높이·면적·구조·주소·승인일 필드 별칭 정의
- 원본 속성값을 정규화된 `BuildingValue`로 변환
- B-04 식별자 결합 함수를 이용한 master 연결
- 속성값 출처·원본 필드·자료 상태 저장
- 두 출처의 동일 필드 값 충돌 보존
- 매칭 결과와 속성 보강 결과 요약
- VWorld 용도별건물정보에 우선 적용 가능한 범용 보강 함수 구현
- 건축HUB는 동일 함수에 연결할 수 있는 입력 구조로 문서화

## 이번 작업에서 제외하는 것

- 건축HUB API 인증·실제 네트워크 호출
- 건축HUB PK의 실제 필드 확정
- geometry 중첩 기반 최종 매칭
- 허가·폐쇄말소 이력의 시간순 병합
- 건축물 분석 지표 계산
- 지도·표 UI
- AI 분석

## 정규화 대상 필드

```text
primaryUse
secondaryUses
aboveGroundFloors
belowGroundFloors
heightMeters
buildingAreaSqm
grossFloorAreaSqm
coverageRatio
floorAreaRatio
structure
address
approvalDate
completionDate
demolitionDate
```

실제 응답에 필드가 없으면 `unknown`으로 둔다. 층수를 높이로 변환하지 않고, footprint 면적을 건축면적·건폐율로 대체하지 않는다.

## 자료 상태

```text
verified
: 해당 원본 자료에 실제 값이 있음

unknown
: 필드 없음·빈 값·자료 미연결

conflict
: 복수 자료의 정규화 값이 다름
```

이번 단계의 source 속성은 공식 원자료에서 온 값이므로 `verified`로 저장하되, 동일 필드가 충돌하면 `conflict`로 변경한다.

## 속성 결합 원칙

```text
1. source feature에서 식별자 추출
2. B-04 matchBuildingIdentity 실행
3. exact·strong만 master 속성 보강
4. candidate·unmatched·conflict는 자동 속성 보강 금지
5. 같은 필드 값이 다르면 conflict로 보존
6. 원본 필드는 raw reference로 유지
```

`partial`은 기본 자동 보강 대상에서 제외한다. 실제 자료 검증 후 정책을 별도로 승격한다.

## 세부 TODO

- [x] 용도·층수·높이·면적·구조·주소·날짜의 필드 별칭을 정의한다.
- [x] 숫자 문자열의 쉼표·단위·빈 값 정규화 함수를 구현한다.
- [x] 속성 feature를 정규화 BuildingValue 묶음으로 변환한다.
- [x] B-04 식별자 매칭 결과를 이용하는 보강 함수를 구현한다.
- [x] exact·strong만 자동 병합하고 candidate·partial·conflict를 분리한다.
- [x] 같은 필드 값의 일치·충돌을 sourceRefIds와 note에 보존한다.
- [x] 출처별 매칭·보강·미확인·충돌 개수를 반환한다.
- [x] `lt_c_spbd`·`dt_d198` 별칭을 현재 코드와 연결한다.
- [x] 건축HUB 입력을 같은 정규화 함수로 받을 수 있도록 문서화한다.
- [x] 정상·빈 값·숫자 단위·충돌·후보 매칭 테스트를 작성한다.
- [x] C-02 결과를 `development/research/building-attribute-enrichment.md`에 기록한다.

## 완료 조건

- 용도별건물정보 속성의 주요 필드 별칭이 정의되어 있다.
- 정규화 값과 원본 값의 출처가 분리되어 있다.
- B-04 매칭 상태에 따라 속성 보강 여부가 달라진다.
- 후보·부분일치·충돌 자료를 확정값으로 저장하지 않는다.
- 복수 출처 속성 충돌이 보존된다.
- 매칭·보강·미확인·충돌 요약을 만들 수 있다.
- 테스트와 타입 검사가 통과한다.
- 건축HUB 연결 시 사용할 입력 구조가 문서화되어 있다.

## 완료 기록

- 구현: `client/src/static/buildingAttributeEnrichment.ts`, `client/src/static/vworld.ts`
- 테스트: `client/src/static/buildingAttributeEnrichment.test.ts`, `client/src/static/vworld.test.ts`
- 다음 작업: C-03 건축인허가·사용승인·폐쇄말소·건축연도 자료 연결

## 검증 방법

- 용도·층수·면적·날짜 별칭 테스트
- 숫자 문자열과 단위 제거 테스트
- exact·strong·partial·candidate·conflict별 보강 테스트
- 충돌 필드 보존 테스트
- 매칭 요약 수치 테스트
- `pnpm check`
- `pnpm test`
- GitHub 원격 문서·코드·TODO 확인
