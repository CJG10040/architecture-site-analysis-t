# C-05 건축물별 통합 master와 결합 신뢰도 생성

상위 TODO: `development/TODO.md` C-05
상태: 완료
작성일: 2026-08-29

## 목적

출처별 footprint·용도·속성·생애자료를 원본 그대로 보존하면서, 분석에 사용할 건축물별 `BuildingRecord`와 결합 품질요약을 생성한다.

## 입력 자료

```text
footprint features
용도별건물정보 features
속성·건축HUB features
생애 이벤트 features
```

각 입력에는 sourceRefId와 원본 properties가 있어야 한다. 없는 자료는 연결하지 않고 품질요약에 미연결로 표시한다.

## 이번 작업에 포함하는 것

- footprint를 master의 기본 레코드로 생성
- footprint geometry·centroid·geometry 면적·범위 멤버십 보존
- 출처별 속성 정규화와 생애 이벤트 연결
- master별 matchStatus·matchConfidence 생성
- 필드별 제공·누락·충돌 집계
- 출처별 매칭률·미매칭률·후보율·충돌률 집계
- 지도용 최대 300개와 전체 분석 레코드 분리 가능한 결과 구조
- 원본 feature 참조와 정규화 레코드 분리
- 부분 자료 입력과 빈 자료 입력의 역호환

## 이번 작업에서 제외하는 것

- 실제 건축HUB 네트워크 호출
- geometry 중첩 기반 자동 매칭 승격
- 건축물 관계·밀도·높이전이 분석
- 지도·표·차트 UI
- AI 분석
- 매칭 후보의 사용자 승인 UI

## master 생성 원칙

```text
footprint 1개
→ BuildingRecord 1개

동일 건축물 속성 자료
→ 식별자 정책으로 기존 record 보강

주소만 일치
→ candidate로 보존하고 자동 보강하지 않음

식별자 충돌
→ conflict로 보존하고 임의 master 선택 금지
```

footprint geometry 면적은 `footprintAreaSqm.status = calculated`로 저장한다. 공식 건축면적은 `fields.buildingAreaSqm`에 별도로 저장한다.

## 품질지표 정의

```text
matchedRate
: 전체 source feature 중 exact·strong 매칭 비율

candidateRate
: 주소 후보 또는 부분 결합 비율

unmatchedRate
: master와 연결되지 않은 비율

conflictRate
: 복수 master 또는 식별자 충돌 비율

fieldCoverage
: 필드별 verified·calculated·estimated·unknown·conflict 수
```

분모가 0이면 비율을 0으로 단정하지 않고 `sampleCount = 0`을 함께 반환한다.

## 세부 TODO

- [x] 통합 입력 타입과 `BuildingMasterBuildResult`를 정의한다.
- [x] footprint feature에서 기본 `BuildingRecord`를 생성한다.
- [x] geometry 면적과 centroid를 calculated 값으로 보존한다.
- [x] 범위 멤버십과 전체 분석 레코드 목록을 생성한다.
- [x] 속성 보강·생애 이벤트 결합 결과를 master에 적용한다.
- [x] master별 출처·필드·매칭 근거를 보존한다.
- [x] exact·strong·partial·candidate·unmatched·conflict 집계를 만든다.
- [x] 필드별 누락·충돌·상태 집계를 만든다.
- [x] 전체 분석 레코드와 지도 표시용 최대 300개 목록을 분리한다.
- [x] 빈 속성자료·중복 footprint·기존 프로젝트 자료의 역호환을 테스트한다.
- [x] C-05 결과를 `development/research/building-master.md`에 기록한다.

## 완료 조건

- footprint 기반 `BuildingRecord` master를 생성할 수 있다.
- 속성·생애자료가 식별자 정책에 따라 기존 master에 연결된다.
- 원본 참조와 정규화 값이 분리되어 있다.
- 결합 신뢰도·매칭 상태·필드 누락·충돌을 확인할 수 있다.
- 전체 분석 레코드와 최대 300개 지도 목록이 분리된다.
- 빈 입력과 기존 자료가 오류 없이 처리된다.
- 테스트·타입 검사·빌드가 통과한다.

## 완료 기록

- 구현: `client/src/static/buildingMaster.ts`, `client/src/static/vworld.ts`
- 테스트: `client/src/static/buildingMaster.test.ts`
- 다음 작업: 건축물 분야 공간분석·품질 패널·지도/목록 UI

## 검증 방법

- footprint master 생성 테스트
- exact·candidate·unmatched·conflict 집계 테스트
- 필드 coverage 및 0분모 테스트
- 전체·지도 표시 목록 분리 테스트
- 속성·생애자료 동시 결합 테스트
- `pnpm check`
- `pnpm test`
- GitHub 원격 문서·코드·TODO 확인
