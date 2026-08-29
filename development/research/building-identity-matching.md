# 건축물 식별자·자료 결합 정책

작성일: 2026-08-29
상위 작업: `development/tasks/B-04-building-identity-matching.md`

## 1. 원칙

서로 다른 자료의 feature를 하나의 건축물로 결합할 때, 주소·geometry·용도만으로 확정하지 않는다. 강한 식별자와 보조 식별자를 구분하고, 결합 근거와 충돌을 함께 저장한다.

```text
원본 feature
→ 식별자 정규화
→ master index 조회
→ 일치·후보·미결합·충돌 판정
→ matchEvidence 저장
```

## 2. 식별자 우선순위

```text
1. buildingManagementNo
   bd_mgt_sn, bld_mng_no, bldg_mng_no

2. bldrgstPk
   bldrgst_pk, 건축물대장 PK

3. ufid

4. pnu

5. gid 또는 featureId
```

주소는 별도 후보 검색에만 사용한다.

## 3. 정규화

### 식별자

```text
문자열 변환
앞뒤 공백 제거
대문자 통일
공백·하이픈·밑줄 제거
빈 값은 식별자로 사용하지 않음
```

PNU는 숫자로 변환하지 않는다. 앞자리 0이 사라지지 않도록 문자열로 보존한다.

### 주소

```text
앞뒤 공백 제거
연속 공백을 하나로 통합
원본 주소와 비교용 주소를 분리
```

현재 주소 비교는 기본적인 공백 정규화만 수행한다. 도로명·지번 주소 변환은 후속 데이터 연결 작업에서 별도 검토한다.

## 4. 판정 기준

| 상태 | 조건 | 해석 |
|---|---|---|
| `matched / exact` | 관리번호·건축물대장 PK·UFID 중 하나가 하나의 master에 일치 | 자동 결합 가능 |
| `matched / partial` | PNU·GID·feature ID 하나만 일치 | 보조 식별자 확인 필요 |
| `matched / strong` | 보조 식별자 2개 이상이 하나의 master에 일치 | 강한 후보지만 원자료 확인 필요 |
| `candidate / candidate` | 주소만 하나의 master에 일치 | geometry·주 식별자 검증 전 확정 금지 |
| `unmatched / unknown` | 일치하는 식별자·주소가 없음 | 새 master 또는 자료 공백 |
| `conflict` | 식별자가 서로 다른 master에 연결되거나 주소 후보가 여러 개 | 어느 값도 자동 확정 금지 |

## 5. 충돌 처리

다음 사례는 `conflict`로 저장한다.

```text
source 관리번호 → master A
source PNU → master B

같은 관리번호 → master A와 master B

동일 주소 → master A와 master B
```

충돌 시 보존하는 값:

```text
conflictRecordIds
conflictingFields
matchEvidence
unmatchedFields
notes
```

## 6. 구현 파일

```text
client/src/static/buildingIdentity.ts
client/src/static/buildingIdentity.test.ts
```

제공 함수:

```text
normalizeBuildingIdentity()
normalizeBuildingAddress()
buildingIdentityFromProperties()
buildBuildingIdentityIndex()
matchBuildingIdentity()
buildingRecordMatchState()
```

`buildingIdentityFromProperties()`는 VWorld에서 사용될 수 있는 필드 별칭을 공통 식별자 구조로 변환한다.

## 7. 현재 결합의 한계

이번 단계는 결합 정책과 판정 함수만 구현했다.

아직 다음은 하지 않았다.

```text
실제 API 응답별 필드 확정
geometry overlap 기반 재검증
건축HUB PK 변환
주소 표준화
용도·층수·면적 값 병합
실제 building_master 생성
```

따라서 현재 `exact`라도 실제 자료원에서 동일 식별자의 의미를 확인하는 C 단계가 필요하다.

## 8. 다음 단계 연결

```text
C-01 VWorld footprint 원자료 수집·품질검사
C-02 용도별건물정보·건축HUB 속성자료 연결
C-05 건축물별 통합 마스터와 결합 신뢰도 생성
```

이번 정책은 이후 실제 응답에서 확인한 필드명과 식별자 의미를 반영해 확장한다.
