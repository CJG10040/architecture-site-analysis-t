# 건축물 허가·사용승인·폐쇄말소·건축연도 자료 정책

작성일: 2026-08-29
상위 작업: `development/tasks/C-03-building-lifecycle.md`

## 1. 목적

건축물의 시간을 하나의 `건축연도`로 단순화하지 않고, 허가·착공·사용승인·변경·철거·말소 이벤트로 보존한다.

```text
원본 날짜
→ 날짜 precision 확인
→ 생애 이벤트 정규화
→ B-04 식별자 결합
→ master lifecycleEvents에 연결
```

## 2. 이벤트 유형

```text
permit
: 건축허가·신고일

start
: 착공일

completion
: 준공일·사용승인일

change
: 증축·개축·대수선·용도변경일

demolition
: 철거·멸실·말소일

constructionYear
: 정확한 날짜가 없는 건축연도
```

## 3. 날짜 정밀도

정확한 날짜는 `YYYY-MM-DD`, 연도만 있는 자료는 `YYYY`로 보존한다.

```text
2010-02-03 → date: 2010-02-03, precision: day
2010년     → date: 2010, precision: year
2010.2.3   → date: 2010-02-03, precision: day
```

연도만 있는 값을 `2010-01-01`로 임의 변환하지 않는다.

존재하지 않는 날짜는 무효로 처리한다.

```text
2010-02-31
→ date: null
→ status: unknown
```

## 4. master 연결

B-04 정책에 따라 다음 결합만 자동 연결한다.

```text
exact
strong
```

다음 상태는 원본 정규화 결과와 결합 판정만 보존한다.

```text
partial
candidate
unmatched
conflict
```

주소만 일치하는 자료의 허가일·사용승인일을 기존 건축물에 자동 반영하지 않는다.

## 5. 날짜 충돌

완료일·철거일·건축연도처럼 하나의 대표값으로 오해하기 쉬운 이벤트는 출처별 날짜가 다르면 모두 보존한다.

```text
자료 A: 사용승인일 2012-04-05
자료 B: 사용승인일 2014-06-07
```

결과:

```text
두 이벤트 모두 보존
status: conflict
note: 동일 이벤트 유형의 날짜가 출처별로 충돌
```

허가·변경 이벤트처럼 여러 번 발생할 수 있는 이벤트는 이력으로 보존하며, 후속 분석에서 시간순으로 해석한다.

## 6. 구현 파일

```text
client/src/static/buildingLifecycle.ts
client/src/static/buildingLifecycle.test.ts
client/src/static/buildingDataModel.ts
```

주요 함수:

```text
normalizeBuildingDate()
normalizeBuildingLifecycle()
mergeBuildingLifecycleEvents()
attachBuildingLifecycle()
```

`BuildingRecord`에는 다음 배열이 추가된다.

```text
lifecycleEvents
```

## 7. 현재 한계

이번 단계에서는 생애자료의 정규화·결합 구조를 구현했지만 실제 건축HUB API 호출은 하지 않았다.

아직 확인할 내용:

```text
건축HUB 실제 날짜 필드명
허가·착공·사용승인 API별 PK
폐쇄·말소 자료의 상태 코드
용도변경·대수선 이벤트의 반복 구조
건물통합정보의 건축연도 의미
```

건축연도만으로 노후도나 철거 가능성을 판정하지 않는다.

## 8. 다음 단계에서 사용할 것

```text
C-04 높이·층수·면적·용도 정규화
C-05 건축물별 통합 마스터와 결합 신뢰도 생성
D-01 거시 범위 건축 시기 분포 분석
```
