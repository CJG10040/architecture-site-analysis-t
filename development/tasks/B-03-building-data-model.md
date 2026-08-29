# B-03 원본·정규화·현장관찰·분석결과 데이터 구조

상위 TODO: `development/TODO.md` B-03
상태: 완료
작성일: 2026-08-29

## 목적

주변 건축물 조사에서 원본 API·파일, 정규화된 건축물 마스터, 계산된 공간관계, 현장관찰, 건축물 분야 AI 분석결과를 서로 섞지 않고 프로젝트 안에 연결한다.

## 이번 작업에 포함하는 것

- 건축물 원본자료 참조 구조 정의
- 건축물 통합 마스터 레코드 정의
- 값별 출처·상태·계산 여부 정의
- 건축물과 조사범위의 관계 정의
- 건축물과 현장관찰 연결 구조 정의
- 건축물 분야 분석결과 저장 구조 정의
- 기존 `LocalProject`에 선택적 건축물 분석 구조 연결
- JSON 직렬화·역호환 테스트

## 이번 작업에서 제외하는 것

- 실제 VWorld·건축HUB API 연결
- 건축물 ID 자동 결합 알고리즘
- 용도·층수·높이 필드 추출
- 건축물 공간관계 계산
- 건축물 지도·표 UI
- 건축물 분야 AI 프롬프트
- 다른 조사 분야와의 종합

## 데이터 계층

```text
BuildingRawReference
: 원본 API·파일·레이어를 가리키는 출처 기록

BuildingRecord
: 건축물 하나를 대표하는 정규화 레코드

BuildingRelation
: 대지·다른 건축물·분석범위와의 계산 관계

BuildingObservationLink
: 현장관찰·사진과 건축물 연결

BuildingAnalysis
: 건축물 분야의 사실·관계·이슈·키워드·질문·가설
```

## 값 상태

모든 정규화 값은 다음 상태 중 하나를 가져야 한다.

```text
verified
: 출처 원자료에서 확인

calculated
: geometry·속성으로 프로그램이 계산

candidate
: 결합 후보이며 확정하지 않음

unknown
: 자료 없음·미확인

conflict
: 복수 출처의 값이 충돌
```

## BuildingRecord 필수 구조

```text
id
geometry
centroid
footprintAreaSqm
scopeMembership
sourceRefs
matchStatus
matchConfidence
fields
observationIds
```

`fields`에는 다음 후보를 둔다.

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

각 필드는 단순 값이 아니라 값·상태·출처·원본 필드를 함께 보관할 수 있어야 한다.

## BuildingRelation 필수 구조

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

법적 접도, 법정 건폐율, 인허가 가능성처럼 계산 범위를 넘어서는 결론을 이 구조에 저장하지 않는다.

## 현장관찰 연결

기존 `Observation`을 재사용하고 건축물 ID를 별도로 연결한다.

```text
observationId
buildingId
relationType
photoId 또는 overlayId
```

관찰 연결 유형 예시:

```text
entrance
frontage
facade
window
canopy
vacancy
material
activity
boundary
contradiction
```

## BuildingAnalysis 구조

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

분석결과의 각 항목은 출처 또는 계산 근거 ID를 참조할 수 있어야 한다.

## 프로젝트 연결

기존 `LocalProject`에 선택적 필드로 추가한다.

```text
buildingStudy?: {
  records: BuildingRecord[]
  relations: BuildingRelation[]
  analyses: BuildingAnalysis[]
}
```

기존 프로젝트 파일이 `buildingStudy`를 갖지 않아도 정상적으로 열려야 한다.

## 세부 TODO

- [x] 값 상태·출처·원본 필드를 표현하는 공통 타입을 정의한다.
- [x] BuildingRawReference 타입을 정의한다.
- [x] BuildingRecord 타입을 정의한다.
- [x] BuildingRelation 타입을 정의한다.
- [x] BuildingAnalysis 타입을 정의한다.
- [x] 현장관찰과 건축물의 연결 타입을 정의한다.
- [x] `LocalProject.buildingStudy` 선택적 필드를 추가한다.
- [x] 기본값·역호환 정규화 처리를 추가한다.
- [x] 범위 정책과 BuildingRecord의 `scopeMembership`을 연결한다.
- [x] 원본·계산값·관찰·분석결과가 서로 섞이지 않는지 테스트한다.
- [x] JSON 직렬화·역직렬화 테스트를 작성한다.
- [x] 데이터 구조 문서를 `development/research/building-data-model.md`에 기록한다.

## 완료 조건

- 원본·정규화·관계·관찰·분석결과가 별도 타입으로 구분된다.
- 건축물 값마다 verified·calculated·candidate·unknown·conflict 상태를 표현할 수 있다.
- 건축물별 출처와 원본 필드를 참조할 수 있다.
- 건축물의 조사범위 멤버십을 저장할 수 있다.
- 현장관찰을 특정 건축물에 연결할 수 있다.
- 건축물 분야 AI 분석결과를 별도로 저장할 수 있다.
- 기존 프로젝트 파일과 역호환된다.
- 타입 검사와 테스트가 통과한다.

## 완료 기록

- 구현: `client/src/static/buildingDataModel.ts`, `client/src/static/model.ts`
- 테스트: `client/src/static/buildingDataModel.test.ts`
- 다음 작업: B-04 건축물 식별자와 자료 간 결합 정책

## 검증 방법

- 기존 프로젝트 생성·저장·불러오기 테스트
- `buildingStudy`가 없는 기존 JSON 정규화 테스트
- 값 상태와 출처 참조 테스트
- 건축물·관찰 연결 테스트
- 범위 멤버십 연결 테스트
- `pnpm check`
- `pnpm test`
