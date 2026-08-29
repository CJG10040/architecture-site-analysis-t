# 건축물 용도·층수·면적·구조 속성 보강 정책

작성일: 2026-08-29
상위 작업: `development/tasks/C-02-building-attribute-enrichment.md`

## 1. 목적

VWorld footprint와 용도별건물정보·건축HUB 속성을 같은 건축물 master에 연결할 수 있도록 원본 필드 별칭과 정규화 규칙을 정한다.

이번 단계의 정규화 결과는 원본 응답을 대체하지 않는다.

```text
원본 properties
→ 정규화 BuildingValue
→ B-04 식별자 매칭
→ exact·strong만 master 보강
```

## 2. 정규화 필드

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

실제 응답에 없는 필드는 저장하지 않고 `unknown`으로 해석한다. 자동 추정값을 만들지 않는다.

## 3. 필드 별칭

현재 구현에서 우선 지원하는 예시:

```text
주용도:
main_use, main_use_nm, mainpurpscdnm, mainPurpsCdNm,
bldg_use, 주용도, 용도

층수:
gro_flo_co, grnd_flr, ground_floor, 지상층수
ugrnd_flr, ugrnd_flr_co, underground_floor, 지하층수

높이:
height, buld_height, bldg_height, hght, 높이

면적:
arch_area, archarea, building_area, 건축면적
totarea, total_area, total_floor_area, gross_floor_area, 연면적

구조:
strct_cd_nm, strct_nm, structure, struct, 구조

날짜:
use_apr_date, useaprdate, 사용승인일
permit_date, 허가일
demolition_date, 말소일, 철거일
```

실제 API 필드명은 C-02 이후 실제 응답 검증에서 추가·수정한다.

## 4. 숫자 처리

다음 표현을 숫자로 정규화한다.

```text
1,000.25㎡ → 1000.25
12.5m → 12.5
45% → 45
```

다음 값은 숫자로 만들지 않는다.

```text
확인 필요
미상
빈 문자열
법적 의미가 불명확한 텍스트
```

footprint geometry 면적을 건축면적이나 법정 건폐율로 자동 대체하지 않는다.

## 5. 결합 정책

```text
exact
: 관리번호·건축물대장 PK·UFID가 하나의 master에 일치

strong
: 보조 식별자가 복수로 하나의 master에 일치

partial
: 보조 식별자 하나만 일치

candidate
: 주소만 일치

unmatched
: 일치 자료 없음

conflict
: 복수 master 또는 서로 다른 식별자에 연결
```

자동 속성 보강은 `exact`와 `strong`만 허용한다.

```text
partial·candidate·unmatched·conflict
→ 원본 정규화 결과와 결합 결과만 보존
→ master 확정값에는 자동 반영하지 않음
```

## 6. 속성 충돌

예를 들어 두 자료가 다음과 같이 다르면:

```text
자료 A: primaryUse = 주거
자료 B: primaryUse = 판매시설
```

기존 값을 임의로 교체하지 않는다.

```text
status: conflict
value: 기존 값 보존
sourceRefIds: 두 자료
note: 충돌한 두 값 기록
```

## 7. 구현 파일

```text
client/src/static/buildingAttributeEnrichment.ts
client/src/static/buildingAttributeEnrichment.test.ts
```

주요 함수:

```text
normalizeBuildingAttributes()
mergeBuildingAttributeFields()
enrichBuildingRecords()
```

현재 `enrichBuildingRecords()`는 정규화된 source feature와 기존 `BuildingRecord`를 B-04 정책으로 연결한다.

## 8. 현재 범위와 한계

이번 단계에서 실제로 연결한 것은 범용 속성 정규화·결합 기반이다.

아직 하지 않은 것:

```text
실제 VWorld 응답 필드 전체 확정
건축HUB API 인증·호출
건축HUB PK 변환
geometry 중첩 재검증
층별 용도 집계
시간순 허가·말소 이력 통합
```

따라서 실제 속성 필드와 식별자 의미는 C-02 이후 실제 자료 연결 단계에서 검증해야 한다.
