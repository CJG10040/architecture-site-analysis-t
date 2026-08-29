# 건축물 높이·층수·면적·구조·용도 필드 정규화

작성일: 2026-08-29
상위 작업: `development/tasks/C-04-building-field-normalization.md`

## 1. 목적

건축물 자료의 같은 숫자가 서로 다른 의미로 사용되지 않도록 필드별 단위·범위·상태를 통일한다.

```text
원본값
→ rawValue 보존
→ 공통 필드·단위 변환
→ 상태·정규화 방법 기록
```

## 2. 값 상태

```text
verified
: 원자료에 값이 있고 정규화 성공

calculated
: geometry·명시적 계산으로 산출

estimated
: 추정값. 공식값으로 사용하지 않음

unknown
: 빈 값·정규화 실패·의미 불명확

conflict
: 자료 간 값이 충돌
```

## 3. 필드와 단위

| 필드 | 표준 단위 | 원칙 |
|---|---|---|
| `footprintAreaSqm` | ㎡ | geometry 계산값이며 건축면적이 아님 |
| `buildingAreaSqm` | ㎡ | 공식 건축면적만 저장 |
| `grossFloorAreaSqm` | ㎡ | 공식 연면적만 저장 |
| `aboveGroundFloors` | count | 지상층수, 정수 |
| `belowGroundFloors` | count | 지하층수, 정수 |
| `heightMeters` | m | 공식 높이, 층수로 환산하지 않음 |
| `coverageRatio` | % | 공식 건폐율 또는 출처가 명확한 값 |
| `floorAreaRatio` | % | 공식 용적률 또는 출처가 명확한 값 |

## 4. 숫자 정규화

```text
1,250.50㎡ → 1250.5
18.2m → 18.2
55% → 55
4층 → 4
```

다음 값은 정규화 실패로 처리한다.

```text
확인 필요
미상
빈 문자열
소수 층수
음수 층수
과도한 비율·높이·면적
```

원본은 `rawValue`에 보존하고 `value`는 `null`, `status`는 `unknown`으로 저장한다.

## 5. 용도·구조 문자열

용도와 구조는 공백을 정리한 값을 사용하되, 원본 표현을 `rawValue`로 보존한다.

```text
"  근린생활시설  "
→ value: "근린생활시설"
→ rawValue: "  근린생활시설  "
```

자동으로 용도를 다른 분류로 번역하거나 AI식 의미를 부여하지 않는다.

## 6. 기존 보강 흐름

`normalizeBuildingAttributes()`는 `normalizeBuildingField()`를 사용한다.

```text
VWorld·건축HUB 원본 속성
→ 필드 별칭 확인
→ 공통 단위·범위 정규화
→ BuildingValue 생성
→ exact·strong 매칭 시 master 보강
```

candidate·partial·conflict 자료는 정규화 결과로는 보존하되 확정 master 값으로 자동 보강하지 않는다.

## 7. 구현 파일

```text
client/src/static/buildingFieldNormalization.ts
client/src/static/buildingFieldNormalization.test.ts
client/src/static/buildingAttributeEnrichment.ts
client/src/static/buildingDataModel.ts
```

`BuildingValue`에 다음 provenance 필드를 추가했다.

```text
rawValue
unit
normalizationMethod
```

## 8. 해석상 주의

```text
footprintAreaSqm ≠ buildingAreaSqm
footprintAreaSqm ≠ 법정 건폐율
aboveGroundFloors ≠ heightMeters
grossFloorAreaSqm ≠ footprintAreaSqm × 층수
건축연도 ≠ 노후도 확정
```

자료가 없는 값은 계산·추정하지 않고 `unknown`으로 둔다.
