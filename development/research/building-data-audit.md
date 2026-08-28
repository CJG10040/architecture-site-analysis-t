# 주변 건축물 자료원·QGIS 처리 감사

작성일: 2026-08-29
상위 작업: `development/tasks/B-01-building-data-audit.md`
상태: 감사 완료

## 1. 감사 결론

현재 앱의 주변 건축물 수집은 다음 수준이다.

```text
VWorld lt_c_spbd footprint 수집
→ 최대 1,000개 단위 BBOX 조회·중복 제거
→ 지도에는 최대 300개 공간객체 표시
→ dt_d198 용도별건물정보 식별자 후보 결합 시도
→ 결합 실패 시 footprint와 실패 원인 저장
```

현재 실제 조사근거에는 다음 상태가 기록되어 있다.

```text
건축물 footprint 730개
지도 표시 300개
lt_c_spbd 속성 필드 일부 확보
용도별건물정보 보강 실패
건축물 용도·층수의 완전한 결합 미완료
```

따라서 현재 건축물 자료는 `footprint 공간 표본`으로는 사용할 수 있지만, 건물별 용도·층수·높이·연면적을 활용한 건축물군 분석으로는 부족하다.

## 2. 자료원 비교

| 자료원 | 역할 | geometry | 주요 속성 후보 | 식별자 후보 | 현재 상태 |
|---|---|---|---|---|---|
| VWorld `lt_c_spbd` | 건물 footprint·GIS 기본정보 | 있음 | `bd_mgt_sn`, 주소, 지상·지하층수 후보, 건물명 후보 | `bd_mgt_sn`, feature id | 현재 연결 |
| VWorld `dt_d198` | 용도별건물정보 | 응답 형식 확인 필요 | 대표·주요·세부 용도, 층별 용도·면적 비율 | `bldrgst_pk`, `bld_mng_no`, PNU, GID 후보 | 결합 시도 중 |
| 건축HUB 건축물대장정보 | 건축물대장 상세 속성 | 주로 속성 | 총괄표제부, 표제부, 층별개요, 전유·공용면적, 구조, 지역지구구역 | 신규 건축HUB PK, 기존 PK 전환 필요 | 보완 후보 |
| 건축HUB 건축인허가정보 | 허가·착공·사용승인·변경 이력 | 주로 속성 | 허가일, 착공일, 사용승인일, 주용도, 면적, 철거·멸실 관련 | 건축HUB PK·주소·대지위치 | 보완 후보 |
| 건축HUB 폐쇄말소대장정보 | 철거·말소 생애 변화 | 주로 속성 | 폐쇄·말소 상태와 관련 대장 정보 | 건축HUB PK·기존 PK 전환 필요 | 보완 후보 |
| 국가공간정보 건물통합정보 | 공간·건축행정 속성 결합 보완 | 있음, 파일 중심 | PNU, UFID, 층수, 건축면적, 연면적, 높이, 구조, 용도 후보 | UFID, BLDRGST_PK, PNU | 파일 보완 후보 |
| 국토지리정보원 건물높이 자료 | 건물 높이 통계·공간자료 보완 | 자료별 확인 필요 | 높이 | 자료별 ID | 파일 보완 후보 |

## 3. 1차 자료원 사용 결정

### 3.1 1차 자동 수집

```text
VWorld lt_c_spbd
VWorld dt_d198
```

이 두 자료로 다음을 우선 확보한다.

```text
건물 geometry
footprint 면적
건물 ID 후보
주소
건축물관리번호 후보
대표·세부 용도 후보
지상·지하층수 후보
```

### 3.2 상세 속성 보완

```text
국토부 건축HUB 건축물대장정보
```

100m 대지 범위와 직접 인접 건축물에 우선 적용한다. 1km 전체 건축물에 개별 상세 API를 반복 호출하지 않는다.

### 3.3 시간 정보 보완

```text
건축HUB 건축인허가정보
건축HUB 폐쇄말소대장정보
```

건축연도·사용승인일·철거·말소 자료가 실제 건축물 ID와 연결되는 경우에만 사용한다. 주소만 일치하는 경우 `address_match`로 저장하고 확정 결합하지 않는다.

### 3.4 파일 보완

```text
국가공간정보 건물통합정보
국토지리정보원 건물높이 자료
```

이 자료들은 현재 브라우저 BBOX 자동 API로 확정하지 않고, 사용자가 원본 SHP·GeoPackage·GeoJSON을 가져오는 보완 경로로 둔다. 파일의 좌표계·기준일·지역 범위를 함께 저장한다.

## 4. 건축물 결합 정책

자료를 하나의 SHP로 합치지 않고, 다음 우선순위로 하나의 `building_master` 레코드를 만든다.

```text
1. 건축물관리번호·건물통합 PK exact match
2. PNU + 건물 geometry overlap 검증
3. PNU + 주소 + 건물명 후보
4. 주소 + geometry 근접 후보
5. 공간 후보만 존재
6. 결합 실패
```

각 결합에는 다음을 저장한다.

```text
canonical_building_id
source_ids
match_method
match_confidence
matched_fields
conflicting_fields
unmatched_fields
```

### 결합 신뢰도

```text
exact
: 관리번호·PK가 정확히 일치

strong
: PNU와 geometry 관계가 일치하고 보조 필드도 일치

partial
: 일부 식별자 또는 공간관계만 일치

candidate
: 결합 후보일 뿐 확정하지 않음

unmatched
: 결합 자료 없음

conflict
: 자료 간 속성 또는 geometry가 충돌
```

## 5. QGIS식 파일 구조

권장 구조는 다음과 같다.

```text
building-study.gpkg
├── raw_lt_c_spbd
├── raw_dt_d198
├── raw_building_hub
├── raw_building_permit
├── raw_building_demolition
├── raw_building_height
├── building_master
├── building_relation_to_site
├── building_macro_grid
├── building_meso_300m
├── building_site_100m
└── building_micro_30m
```

웹 앱에서도 같은 논리를 따른다.

```text
ResearchNote.detail/rawData
: 원본 응답·속성·geometry 보존

SpatialLayer
: 지도와 공간 관계에 사용할 정규화 geometry

BuildingRecord
: 건축물 한 개당 하나의 통합 레코드

BuildingAnalysis
: 분야별 계산 결과와 AI 분석 결과
```

지도 표시 제한 때문에 300개만 표시하더라도, 분석용 집계는 지도 표시 객체 수가 아니라 전체 수집 객체를 기준으로 해야 한다.

## 6. 범위별 데이터 정책

### 거시 500m~1km

개별 건축물의 상세 API를 모두 조회하지 않는다.

필수:

```text
geometry 또는 중심점
footprint 면적
건물 ID
가능한 경우 대표용도·층수·건축연도
```

AI 전달:

```text
100m·200m 격자별 건물 수
footprint 합계
건물 밀도
층수·용도·연도 분포
분위수·누락률·대표 패턴
```

### 중간 300m

모든 건물의 기본 레코드를 확보한다.

필수:

```text
건물 ID
geometry
footprint 면적
대지와의 거리
대표용도
층수
높이 후보
건축연도 후보
자료 기준일
결합 신뢰도
```

AI 전달:

```text
전체 기본 테이블
용도·층수·시기 분포
건물군 관계
건물 사이 빈 공간
높이 전이
```

### 대지 100m

대지에 직접 영향을 주는 건물에 상세 속성을 적용한다.

필수:

```text
건축물관리번호
PNU
주소
주용도·세부용도
층수·높이
건축면적·연면적
사용승인일
허가·말소 상태
대지 각 변과의 관계
```

### 미시 30m

공공자료와 현장관찰을 결합한다.

필수:

```text
인접 건축물 상세정보
1층 출입구
창호·벽면·간판·차양
공실·사용 흔적
현장사진·위치·시각·방향
공공자료와 현장 차이
```

## 7. QGIS 분석 모델

### 전처리

```text
1. 원본 레이어 불러오기
2. 원본 CRS와 기준일 기록
3. 분석 CRS를 미터 단위로 통일
4. geometry 유효성 검사
5. 공간 인덱스 생성
6. 중복 geometry와 중복 ID 확인
```

원본 좌표계는 보존하고, 거리·면적 계산용 좌표계만 별도로 사용한다.

### 통합

```text
1. 건축물관리번호·PK 필드 결합
2. PNU·주소 보조 결합
3. 공간 조인으로 overlap 확인
4. 결합 신뢰도 계산
5. building_master 생성
6. 결합 실패·충돌 테이블 생성
```

### 관계 계산

```text
대지와의 거리
대지 각 변과의 최근접 거리
인접 건축물
건물 사이 거리
footprint 합계
형태상 빈 공간
건물 방향
건물 높이 차이
건물군 밀도
```

### 범위별 파생 결과

```text
macro_grid
: 거시 격자 집계

meso_300m
: 300m 전체 기본정보

site_100m
: 100m 상세 속성

micro_30m
: 30m 현장관찰 결합
```

## 8. 건축물 분야 분석 항목

### 형태

```text
footprint 면적 분포
장단변 비율
compactness
방향성
건물 크기 편차
건물 사이 빈 공간
```

### 밀도

```text
건축물 수
footprint 합계
형태상 footprint 점유율
건물 수 밀도
격자별 밀도 차이
```

`형태상 footprint 점유율`은 법정 건폐율이 아니다.

### 높이

```text
평균·중앙·최고 층수
층수 분산
높이 전이
대지와 인접 건축물의 높이 차이
```

높이값이 없으면 층수만 사용하고, 층수를 실제 높이로 변환하지 않는다.

### 용도

```text
주용도 분포
세부용도 분포
저층부·상층부 용도
복합용도
용도 미확인률
용도 집중·혼합
```

### 시간

```text
건축연도 분포
오래된 건물군
신축 건물군
신축·노후 혼합
허가·사용승인 변화
폐쇄·말소 후보
```

### 대지와의 관계

```text
대지 각 변별 인접 건물
대지와의 거리
주변 건물의 방향
대지 주변의 압박·개방
건물과 대지 사이의 형태상 틈
```

## 9. 현재 구현에 반영해야 할 부족점

다음은 B-02 이후 구현으로 넘긴다.

```text
1. 지도 표시 300개와 전체 분석 객체를 분리
2. 건축물별 정규화 BuildingRecord 추가
3. 전체 건축물의 ID·필드 결합률 계산
4. 건축HUB 속성 보완을 100m 우선으로 제한
5. 1km는 상세 속성이 아닌 집계자료 생성
6. 건물 사이 빈 공간을 형태상 빈 공간으로 표시
7. 거리·면적·밀도 계산 결과의 근거 ID 생성
8. 건축물 자료 품질·누락률 표시
9. 원본·정규화·분석 결과 다운로드 구조 분리
10. 건축물 분야 AI 입력 패키지 별도 생성
```

## 10. 공식 자료원

- [VWorld WMS/WFS API](https://www.vworld.kr/dev/v4dv_wmsguide2_s001.do)
- [국토교통부 용도별건물정보](https://www.data.go.kr/data/15123458/openapi.do)
- [국토교통부 건축HUB 건축물대장정보](https://www.data.go.kr/data/15134735/openapi.do)
- [국토교통부 건축HUB 건축인허가정보](https://www.data.go.kr/data/15136267/openapi.do)
- [국토교통부 건축HUB 폐쇄말소대장정보](https://www.data.go.kr/data/15137093/openapi.do)
- [국토지리정보원 건물높이 자료](https://www.data.go.kr/data/15062306/fileData.do)
- [국가공간정보 건물통합정보](http://data.nsdi.go.kr/dataset/12623)
- [QGIS 레이어 조인·공간 조인](https://docs.qgis.org/3.44/en/docs/user_manual/working_with_vector/joins_relations.html)
- [QGIS Virtual Layer](https://documentation.qgis.org/3.40/en/docs/user_manual/managing_data_source/create_layers.html)
- [QGIS DB Manager](https://documentation.qgis.org/3.34/en/_sources/docs/training_manual/databases/db_manager.rst.txt)

## 11. 다음 작업으로 전달할 결정사항

B-02에서는 다음을 구체적으로 설계한다.

```text
canonical_building_id 결정 방식
lt_c_spbd·dt_d198 실제 필드 매핑
건축HUB PK 변환·주소 매칭 방식
결합 신뢰도 계산
충돌 속성 처리
```

B-03에서는 다음을 구체적으로 설계한다.

```text
거시·중간·대지·미시별 필드 목록
범위별 API 호출 정책
전체 분석 객체와 지도 표시 객체 분리
AI 전달 패키지 크기·내용
```
