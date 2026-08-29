# 건축물 통합 master 생성과 결합 품질요약

작성일: 2026-08-29
상위 작업: `development/tasks/C-05-building-master.md`

## 1. 목적

출처별 원본 feature를 삭제·병합하지 않고, 분석에 사용할 건축물별 `BuildingRecord`를 생성한다.

```text
footprint 원본
→ usable footprint 선별
→ BuildingRecord 기본 생성
→ 속성 정규화·결합
→ 생애 이벤트 결합
→ quality summary 생성
```

## 2. master 기본 레코드

usable Polygon·MultiPolygon footprint마다 기본 record를 만든다.

```text
id
geometry
centroid
footprintAreaSqm
scopeMembership
fields
sourceRefIds
lifecycleEvents
```

`footprintAreaSqm`는 geometry에서 계산한 값이며 `calculated` 상태로 구분한다.

실제 건축면적은 `fields.buildingAreaSqm`에 별도로 저장한다.

## 3. 전체 레코드와 지도 레코드

```text
records
: 전체 분석용 master

mapRecords
: 지도 표시용 목록. 기본 최대 300개
```

지도 표시 제한은 전체 분석 데이터 삭제를 의미하지 않는다.

## 4. 결합 순서

```text
1. footprint master 생성
2. 속성 source 순서대로 정규화·결합
3. 생애 source 순서대로 이벤트 결합
4. exact·strong만 master 자동 보강
5. candidate·partial·unmatched·conflict는 품질요약에 보존
```

## 5. 품질요약

### 출처별 결합률

```text
matchedRate
: exact·strong 결합 / 해당 source feature 수

candidateRate
: 주소 후보 또는 partial / 해당 source feature 수

unmatchedRate
: 결합 실패 / 해당 source feature 수

conflictRate
: 복수 master·식별자 충돌 / 해당 source feature 수
```

source feature가 0개면 비율을 사실상 성공으로 해석하지 않고 `sampleCount: 0`을 함께 보존한다.

### 필드별 coverage

필드마다 다음 수치를 계산한다.

```text
present
verified
calculated
estimated
unknown
conflict
coverageRate
sampleCount
```

### footprint 품질

C-01의 footprint 품질검사와 연결해 다음을 반영한다.

```text
usableFootprints
invalidFootprints
duplicateIdentityGroups
```

## 6. 구현 파일

```text
client/src/static/buildingMaster.ts
client/src/static/buildingMaster.test.ts
```

주요 함수:

```text
buildBuildingMaster()
```

입력에는 footprint source, 선택적 속성 source 배열, 선택적 생애 source 배열, 범위 설정, 지도 표시 제한을 전달한다.

## 7. 현재 한계

이번 단계는 통합 master 조립 구조와 품질요약을 구현한 단계다.

아직 다음은 하지 않았다.

```text
실제 건축HUB API 호출
geometry 중첩 기반 매칭 승격
주소 후보 사용자 승인 UI
공간관계 계산
건축물 분석 UI
```

실제 API 입력 시에는 각 source의 기준일·원본 URL·원본 필드 목록을 `BuildingRawReference`로 함께 전달해야 한다.

## 8. 해석상 주의

```text
master 개수 ≠ 실제 건축물 확정 개수
중복 identity group은 별도 검토 필요
mapRecords 개수 ≠ 전체 분석 개수
unmatched는 건축물 부재가 아니라 결합 실패일 수 있음
```

출처가 연결되지 않은 필드는 `unknown`으로 남겨야 하며, 자료가 없다는 이유로 용도·층수·높이를 생성하지 않는다.
