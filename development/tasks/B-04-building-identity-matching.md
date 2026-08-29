# B-04 건축물 식별자와 자료 간 결합 정책

상위 TODO: `development/TODO.md` B-04
상태: 완료
작성일: 2026-08-29

## 목적

VWorld footprint, 용도별건물정보, 건축HUB, 건물통합정보처럼 서로 다른 자료를 하나의 건축물로 결합하되, 불확실한 결합을 확정된 사실처럼 저장하지 않는다.

## 이번 작업에 포함하는 것

- 식별자 필드의 정규화 규칙 정의
- 식별자 우선순위 정의
- exact·strong·partial·candidate·unmatched·conflict 상태 정의
- 동일 식별자가 여러 건축물에 연결되는 충돌 처리
- 주소 기반 결합을 후보로만 처리
- 결합 근거 필드와 충돌 필드 저장
- 기존 `BuildingRecord.matchStatus`·`matchConfidence`와 연결
- 결합 정책 단위 테스트

## 이번 작업에서 제외하는 것

- 실제 VWorld·건축HUB API 호출
- 건축물 geometry 거리·중첩 계산
- 새로운 자료원 다운로드
- 건축물 속성값의 최종 우선순위 병합
- UI 표시
- AI 분석

## 식별자 우선순위

강한 식별자는 다음 순서로 사용한다.

```text
1. buildingManagementNo / bd_mgt_sn / bld_mng_no
2. bldrgst_pk / 건축물대장 PK
3. UFID
4. PNU
5. GID 또는 자료별 feature ID
```

주소는 식별자와 동등하게 취급하지 않는다.

```text
주소만 일치
→ candidate
주소와 geometry까지 검증
→ strong 또는 exact 승격 가능
```

## 정규화 규칙

식별자:

```text
앞뒤 공백 제거
대문자 통일
공백·하이픈·밑줄 제거
문자열로 저장
빈 문자열·null은 식별자로 사용하지 않음
```

PNU:

```text
숫자 문자열로 보존
앞자리 0을 임의로 제거하지 않음
19자리 등 길이 오류는 값은 보존하되 검증 실패로 표시
```

주소:

```text
앞뒤 공백 제거
연속 공백 통합
비교용 정규화 주소와 원본 주소를 분리
```

원본 값은 항상 `BuildingRawReference`를 통해 보존한다.

## 결합 판정

```text
exact
: 같은 강한 식별자가 정확히 하나의 master에 일치

strong
: 강한 식별자는 없지만 PNU·주소·geometry 등 복수 근거가 일치

partial
: 하나의 보조 식별자 또는 제한된 근거만 일치

candidate
: 주소 또는 공간 후보만 존재하여 확정할 수 없음

unmatched
: 일치하는 master가 없음

conflict
: 한 자료의 식별자가 복수 master에 연결되거나 식별자 간 대상이 다름
```

## 충돌 원칙

다음 경우 `conflict`로 처리한다.

```text
같은 buildingManagementNo가 두 master에 연결됨
PNU는 A에 일치하지만 UFID는 B에 일치함
동일 source feature에 서로 다른 강한 식별자가 존재함
```

충돌 시 어느 값을 임의로 선택하지 않는다.

```text
conflictRecordIds
conflictingFields
matchEvidence
```

을 보관하고 후속 검토 대상으로 둔다.

## 결합 결과 구조

```text
sourceRecordId
masterBuildingId
status
confidence
matchedFields
matchEvidence
conflictRecordIds
unmatchedFields
notes
```

## 세부 TODO

- [x] 식별자 필드 별칭과 우선순위를 타입으로 정의한다.
- [x] 식별자·주소 정규화 함수를 구현한다.
- [x] 기존 master 건축물로 식별자 인덱스를 생성한다.
- [x] 강한 식별자 exact match 판정 함수를 구현한다.
- [x] 주소 기반 candidate 판정 함수를 구현한다.
- [x] 하나의 source가 여러 master에 걸리는 conflict 판정 함수를 구현한다.
- [x] 결합 근거·충돌 필드·미결합 필드를 반환한다.
- [x] 결과를 `BuildingRecord.matchStatus`·`matchConfidence`로 변환할 수 있게 한다.
- [x] 정상 일치·주소 후보·미결합·충돌 테스트를 작성한다.
- [x] B-04 정책 문서를 `development/research/building-identity-matching.md`에 기록한다.

## 완료 조건

- 식별자 정규화 규칙과 우선순위가 코드·문서에 동일하게 정의되어 있다.
- 강한 식별자 exact match와 주소 candidate가 구분된다.
- 식별자 충돌을 자동 확정하지 않고 conflict로 보존한다.
- 결합 결과에 근거 필드와 원본 값이 연결된다.
- `BuildingRecord`의 match 상태와 연결할 수 있다.
- 정상·후보·미결합·충돌 테스트가 통과한다.
- 실제 API 연결 전에 사용할 수 있는 결합 정책이 문서화되어 있다.

## 완료 기록

- 구현: `client/src/static/buildingIdentity.ts`
- 테스트: `client/src/static/buildingIdentity.test.ts`
- 다음 작업: C-01 VWorld footprint 원자료 수집·품질검사

## 검증 방법

- 공백·하이픈·대소문자 차이 정규화 테스트
- 동일 관리번호 exact match 테스트
- 주소만 일치하는 candidate 테스트
- 서로 다른 master로 연결되는 conflict 테스트
- 일치 대상이 없는 unmatched 테스트
- `pnpm check`
- `pnpm test`
