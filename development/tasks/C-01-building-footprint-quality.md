# C-01 VWorld footprint 원자료 수집·보존·품질검사

상위 TODO: `development/TODO.md` C-01
상태: 완료
작성일: 2026-08-29

## 목적

VWorld `lt_c_spbd` footprint 자료를 건축물 분석에 사용하기 전에 geometry·식별자·중복·필드·공간범위를 진단한다. 지도에 표시된 개수와 실제 분석에 보존된 원자료 개수를 구분한다.

## 이번 작업에 포함하는 것

- VWorld WFS/Data 응답 feature 품질 진단
- Polygon·MultiPolygon geometry 여부와 유효성 진단
- 건축물 식별자 존재율 진단
- 동일 식별자 중복 그룹 진단
- 동일 geometry 중복 후보 진단
- 빈 geometry·비건축물 geometry 분리
- 원자료 개수와 지도 표시 개수 분리 문서화
- 품질 결과를 테스트 가능한 요약 타입으로 구현
- 정상·누락·중복·잘못된 geometry 테스트

## 이번 작업에서 제외하는 것

- 실제 사용자 VWorld 키를 이용한 네트워크 수집
- 건축물 용도·층수·높이 결합
- 건축HUB 연결
- footprint와 대지의 거리·교차 계산
- 건축물 분야 분석 UI
- AI 분석

## 품질 판정 항목

```text
totalFeatures
polygonFeatures
usablePolygonFeatures
invalidGeometryCount
missingIdentityCount
duplicateIdentityGroups
duplicateIdentityFeatureCount
duplicateGeometryCount
propertyFieldNames
geometryTypes
```

유효한 footprint는 Polygon 또는 MultiPolygon이며, 외곽 ring이 3개 이상의 유효 좌표를 가져야 한다. geometry가 없거나 Point·LineString인 feature는 footprint 분석 객체로 사용하지 않되 원자료에서는 삭제하지 않는다.

## 식별자 진단

기존 B-04 정책의 별칭을 사용한다.

```text
buildingManagementNo
bd_mgt_sn
bld_mng_no
bldg_mng_no
bldrgst_pk
UFID
PNU
GID
feature id
```

식별자가 없으면 `missingIdentityCount`에 포함한다. feature ID만 있는 경우 자료 내부 식별자로 보존하되 건축물관리번호와 동일하게 해석하지 않는다.

## 중복 처리 원칙

```text
동일 식별자 중복
→ 원자료는 모두 보존
→ 분석 후보는 중복 그룹으로 표시
→ 자동 삭제하지 않음

동일 geometry 중복
→ geometry 중복 후보로 표시
→ 속성·기준일·출처 비교 전 자동 삭제하지 않음
```

중복 제거가 필요한 후속 단계에서는 대표 feature 선정 규칙을 별도로 작성한다.

## 세부 TODO

- [x] footprint geometry 유효성 판정 함수를 구현한다.
- [x] footprint feature에서 식별자와 필드명을 추출한다.
- [x] 품질 요약 타입을 정의한다.
- [x] 식별자별 중복 그룹을 계산한다.
- [x] geometry 중복 후보를 계산한다.
- [x] 지도 표시 제한 300개와 원자료 보존 개수를 구분하는 문서를 작성한다.
- [x] 실제 API 오류·빈 응답은 footprint 부재로 집계하지 않는 원칙을 기록한다.
- [x] 정상·geometry 누락·식별자 누락·중복·비폴리곤 테스트를 작성한다.
- [x] 품질검사 문서를 `development/research/building-footprint-quality.md`에 기록한다.

## 완료 조건

- VWorld footprint feature의 geometry·식별자·중복 품질을 요약할 수 있다.
- 잘못된 geometry와 식별자 누락을 실제 부재와 구분한다.
- 원자료를 삭제하지 않고 분석용 유효 feature만 구분할 수 있다.
- 동일 식별자·동일 geometry를 자동으로 임의 삭제하지 않는다.
- 지도 표시 제한과 전체 원자료 보존을 구분한다.
- 품질검사 함수와 테스트가 통과한다.
- C-02 용도별건물정보·건축HUB 속성자료 연결에 품질 결과를 전달할 수 있다.

## 완료 기록

- 구현: `client/src/static/buildingFootprintQuality.ts`, `client/src/static/research.ts`
- 테스트: `client/src/static/buildingFootprintQuality.test.ts`
- 다음 작업: C-02 용도별건물정보·건축HUB 속성자료 연결

## 검증 방법

- Polygon·MultiPolygon·Point·빈 geometry 입력 테스트
- 식별자 누락·중복 테스트
- 동일 geometry 후보 테스트
- 빈 feature collection 테스트
- `pnpm check`
- `pnpm test`
- GitHub 원격 코드·문서·TODO 확인
