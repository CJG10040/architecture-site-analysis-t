# 주변 건축물 데이터 모델 설계

작성일: 2026-08-29
상위 작업: `development/tasks/B-03-building-data-model.md`

## 계층

```text
원본 참조
→ 건축물 정규화 레코드
→ 대지·건축물 공간관계
→ 현장관찰 연결
→ 건축물 분야 분석결과
```

원본 응답·파일은 `ResearchNote.detail/rawData` 또는 파일 참조로 보존하고, `BuildingRecord`에는 원본 자체를 중복 저장하지 않고 출처 참조 ID를 저장한다.

## 값 상태

```text
verified   출처 원자료에서 확인
calculated geometry·속성으로 프로그램이 계산
candidate  결합 후보
unknown    자료 없음·미확인
conflict   복수 출처 값 충돌
```

상태가 `unknown` 또는 `candidate`인 값을 FACT처럼 AI에 전달하지 않는다.

## 주요 타입

### BuildingRawReference

```text
id
source
dataset
sourceUrl
featureId
retrievedAt
dataDate
originalCrs
rawLocation
rawFieldNames
```

### BuildingRecord

```text
id
geometry
centroid
footprintAreaSqm: BuildingValue
scopeMembership
fields
sourceRefIds
matchStatus
matchConfidence
observationIds
```

`fields`에는 다음 항목을 넣을 수 있다.

```text
buildingManagementNo
pnu
address
buildingName
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
approvalDate
completionDate
demolitionDate
```

### BuildingRelation

```text
buildingId
siteDistanceMeters
boundaryDistanceMeters
nearestBoundarySide
overlapWithSite
nearestBuildingIds
scopeMembership
relationStatus
calculatedAt
```

이 구조는 공간 계산 결과만 보관한다. 법적 접도·인허가 판정은 보관하지 않는다.

### BuildingObservationLink

현장관찰은 기존 `Observation`과 연결한다.

```text
observationId
buildingId
relationType
photoId
 overlayId
```

관찰 유형:

```text
entrance, frontage, facade, window, canopy,
vacancy, material, activity, boundary, contradiction
```

### BuildingAnalysis

```text
catalogId: buildings
scopeSummary
verifiedFacts
relations
interpretations
unknowns
keywords
issues
fieldQuestions
designQuestions
hypotheses
sourceEvidenceIds
createdAt
updatedAt
```

분석 문장은 `BuildingAnalysisClaim`으로 저장하고 `evidenceIds`를 요구한다.

## 프로젝트 연결

`LocalProject`에 다음 선택적 필드를 추가했다.

```text
buildingStudy?: {
  scopeConfig
  rawReferences
  records
  relations
  observationLinks
  analyses
  updatedAt
}
```

새 프로젝트에는 빈 `buildingStudy`가 생성되고, 기존 프로젝트 파일에는 값이 없더라도 기본 빈 구조로 정규화된다.

## 범위 정책 연결

`buildingScope.ts`의 기본 범위와 연결한다.

```text
macro  1,000m 이하
meso   300m 이하
site   100m 이하
micro  30m 이하
```

한 건축물은 누적 멤버십을 가진다. 예를 들어 20m 건축물은 네 범위에 모두 포함되지만, 실제 레코드는 한 건만 보관한다.

## 다음 작업에서 사용할 것

```text
B-04 건축물 ID·속성 결합 정책
C-01 VWorld footprint 원자료 품질검사
C-02 용도별건물정보·건축HUB 속성 연결
```
