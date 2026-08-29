# VWorld 건축물 footprint 품질검사 정책

작성일: 2026-08-29
상위 작업: `development/tasks/C-01-building-footprint-quality.md`

## 1. 목적

VWorld `lt_c_spbd` 등 건축물 footprint 응답을 분석하기 전에 유효 geometry·식별자·중복·필드 목록을 진단한다.

```text
원자료 전체
→ 품질 요약
→ 유효 footprint 분석 후보
→ 지도 표시·공간분석
```

품질검사에서 제외된 feature도 원자료에서는 삭제하지 않는다.

## 2. 유효 footprint

분석 가능한 footprint는 다음 조건을 만족해야 한다.

```text
Polygon 또는 MultiPolygon
외곽 ring에 유효 좌표 3개 이상
서로 다른 좌표 3개 이상
```

다음 feature는 footprint 분석 후보에서 제외한다.

```text
geometry 없음
Point
LineString
좌표 부족
좌표가 모두 동일
```

단, 제외 feature의 원본 속성과 geometry는 보존한다.

## 3. 품질 요약

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

이 값은 실제 건축물 부재를 의미하지 않는다. API 오류·CORS 실패·빈 응답은 품질 요약에 넣지 않고 별도 수집 상태로 기록해야 한다.

## 4. 식별자 진단

B-04 결합 정책의 별칭을 사용한다.

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

feature ID만 있는 경우 내부 feature 식별자로 보관하며, 건축물관리번호로 해석하지 않는다.

## 5. 중복 진단

### 식별자 중복

동일 정규화 식별자가 여러 feature에 나타나는 경우 중복 그룹으로 기록한다.

```text
원본 feature 모두 보존
중복 그룹 ID 기록
속성·geometry·기준일 비교 대상으로 전달
자동 삭제하지 않음
```

### geometry 중복

좌표를 소수점 7자리로 정규화했을 때 동일한 geometry가 여러 feature에 나타나는 경우 geometry 중복 후보로 기록한다.

geometry가 같아도 다음이 다를 수 있으므로 자동 삭제하지 않는다.

```text
출처
기준일
식별자
속성
자료 갱신 상태
```

## 6. 지도 표시와 분석 보존 구분

```text
전체 원자료
: 품질검사 결과와 함께 프로젝트에 보존

유효 분석 후보
: Polygon·MultiPolygon 조건을 통과한 feature

지도 표시
: 성능을 위해 최대 300개까지 제한 가능

통계·공간분석
: 지도 표시 300개가 아니라 전체 유효 분석 후보 기준
```

따라서 지도에 300개만 표시되었다고 전체 건축물이 300개라는 의미가 아니다.

## 7. 구현 파일

```text
client/src/static/buildingFootprintQuality.ts
client/src/static/buildingFootprintQuality.test.ts
```

제공 함수:

```text
isUsableBuildingFootprint()
auditBuildingFootprints()
usableBuildingFootprintFeatures()
```

## 8. 다음 작업에서 사용할 것

```text
C-02 용도별건물정보·건축HUB 속성자료 연결
C-05 건축물별 통합 마스터와 결합 신뢰도 생성
D-01~D-05 범위별 건축물 분석
```

품질 요약의 중복·누락·geometry 상태는 이후 결합 신뢰도와 AI 입력의 데이터 한계에 전달한다.
