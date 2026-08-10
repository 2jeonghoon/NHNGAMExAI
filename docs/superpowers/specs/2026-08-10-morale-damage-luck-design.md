# 사기 기반 공격 카드 피해 보정 설계

작성일: 2026-08-10

## 배경

현재 사기(`run.morale`, 0~100)는 전투 승리 보상·항해 이동 페널티·선상 반란 트리거 등에만 관여하고, 전투 중 실제 피해량 계산에는 아무 영향을 주지 않는다. 플레이어가 사기 관리에 신경 쓸수록 전투에서도 체감되는 보상이 있으면 좋겠다는 요청에 따라, 사기가 높을수록 공격 카드의 랜덤 피해가 더 높은 값 쪽으로 보정되는 효과를 추가한다.

## 목표

- 사기가 높을수록 플레이어의 공격 카드가 굴리는 랜덤 피해 범위에서 높은 값이 나올 확률이 커진다.
- 이 보정의 존재를 플레이어가 사기 스탯의 설명(툴팁)에서 바로 확인할 수 있다.
- 기존 코스트/명중률/기타 전투 로직은 변경하지 않는다.

## 범위

### 포함

- 플레이어의 "공격 카드"가 굴리는 랜덤 피해에만 적용:
  - 포격 계열 공용 함수 `cannonDamage()` (`src/game.js:1609`) — fire, aimed_fire, rapid_fire, barrage_fire, 포수(gunner) 전용 카드들이 공유.
  - 사슬탄 계열 인라인 굴림 3곳 (`src/game.js:1822`, `:1824`, `:1826`) — chain, heavy_chain, entangling_chain.
- 사기 HUD 요소(`index.html`의 `data-tooltip`/`aria-description`, "사기" 항목)에 보정 효과 설명 한 문장 추가.
- 신규 헬퍼 함수 `luckyRandomInt(min, max)`를 추가해 위 4개 호출부에서만 기존 `randomInt(min, max)` 대신 사용한다.

### 제외

- 적의 공격, 이벤트, 접안 공격 실패 시 플레이어가 받는 피해 등 "플레이어가 맞는" 랜덤 수치 — 사기가 좋다고 상대 공격까지 영향을 주는 것은 이번 스코프가 아니다.
- 카드 설명(`combatCardDescription`) 문구 변경 — 보정은 카드별 속성이 아니라 사기라는 전역 상태의 효과이므로, 설명은 사기 툴팁 한 곳에만 추가한다.
- `randomInt` 자체의 시그니처 변경 — 다른 호출부(이벤트, 적 공격 등)에 영향이 없도록 별도 함수로 분리한다.

## 알고리즘 개요

```js
function luckyRandomInt(min, max) {
  const first = randomInt(min, max);
  const moraleChance = clamp((run?.morale || 0) / 100, 0, 1);
  if (Math.random() < moraleChance) {
    return Math.max(first, randomInt(min, max));
  }
  return first;
}
```

- "이점(Advantage)" 방식: 사기/100 확률로 한 번 더 굴려 더 높은 값을 채택한다. 사기 100이면 항상 재굴림, 사기 0이면 항상 한 번만 굴린다(기존과 동일한 균등분포).
- `cannonDamage()`의 `randomInt(2, 6)`과 사슬탄 계열 3곳의 `randomInt(6, 10)`/`randomInt(3, 6)`을 각각 `luckyRandomInt`로 교체한다.

## UI 문구

사기 HUD 요소의 `data-tooltip`/`aria-description`에 아래 문장을 덧붙인다:

> "사기가 높을수록 포격·사슬탄 공격의 피해가 두 번 굴려 더 높은 값을 채택하는 방식으로 유리하게 보정됩니다."

## 테스트 및 검증

- `luckyRandomInt` 단위 테스트: `Math.random`을 시퀀스로 모킹해 (1) 사기 0일 때 항상 첫 굴림만 사용, (2) 사기 100일 때 항상 재굴림 후 더 큰 값 채택, (3) 사기 50일 때 재굴림 확률 체크가 `Math.random() < 0.5`로 이루어짐을 확인한다.
- `cannonDamage()`와 chain/heavy_chain/entangling_chain 카드 실행 경로에서 사기 100 + 조작된 `Math.random` 시퀀스(첫 굴림 낮게, 재굴림 높게)로 실제 적용 피해가 더 높은 쪽 값을 반영하는지 확인하는 통합 테스트를 추가한다.
- 기존 카드 전투 회귀 테스트(`tests/captain-card-combat.test.js`, `tests/card-ui.test.js`)가 그대로 통과하는지 확인한다 — 이 테스트들은 `Math.random`을 상수 함수(예: `() => 0`, `() => 0.9`)로 모킹하므로, 사기 값과 무관하게 재굴림 여부와 상관없이 `randomInt`가 매번 동일한 값을 반환해 최종 피해량 결과는 바뀌지 않는다.
