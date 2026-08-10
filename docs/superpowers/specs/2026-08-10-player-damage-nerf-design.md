# 플레이어 공격 카드 피해 약화 설계

작성일: 2026-08-10

## 배경

플레이테스트 결과 플레이어의 기본 공격 카드(포격·사슬탄 계열) 피해량이 원래부터 과했다는 피드백을 받았습니다. 예: 포수장 기준 fire 카드 한 장이 화력 8 + 랜덤(2~6) = 평균 12의 적 선체 피해를 주는데, 일반 적 체력이 약 31 수준이라 카드 2~3장이면 일반 전투가 끝나버립니다.

코드를 조사한 결과, 카드 툴팁에 표시되는 피해 범위(`combatCannonDamageRange()`, `combatCardDescription()`의 사슬탄 범위 계산)가 실제 피해 계산(`cannonDamage()`, 사슬탄 인라인 굴림)과 완전히 별도로 중복 계산되고 있습니다. 계산 로직만 고치면 툴팁에 표시되는 숫자가 실제보다 높게 표시되는 불일치가 생기므로, 두 곳을 함께 수정해야 합니다.

## 목표

- 플레이어가 반복적으로 사용하는 기본 공격 카드(포격·사슬탄 계열)의 피해량을 약 20% 낮춘다.
- 카드 툴팁에 표시되는 피해 범위 숫자가 실제 계산된 피해량과 항상 일치하도록 유지한다.
- 선장 전용 필살기 카드, 희귀/에픽 고정수치 카드, 플레이어가 받는 피해(적 공격·접안 실패 등)는 이번 스코프에서 건드리지 않는다.

## 범위

### 포함

- 새 상수 `PLAYER_DAMAGE_SCALE = 0.8`을 도입한다 (다른 전투 관련 상수와 같은 위치, `src/game.js` 상단).
- 아래 계산·표시 지점 모두에 `Math.round(값 * PLAYER_DAMAGE_SCALE)`을 적용한다:
  - `cannonDamage()` (`src/game.js:1618-1620`) — 반환값 전체에 스케일 적용. fire, aimed_fire, rapid_fire, barrage_fire, gunner_shrapnel, gunner_double_broadside, gunner_overcharge가 모두 이 함수를 공유하므로 한 곳만 고치면 자동 적용된다.
  - `combatCannonDamageRange()` (`src/game.js:2620-2625`) — 위 카드들의 툴팁 피해 범위 표시. 최소값·최대값 각각에 스케일 적용.
  - 사슬탄 계열 실제 피해 계산 3곳(`src/game.js:1830-1835`, chain/heavy_chain/entangling_chain — 이미 `luckyRandomInt` 사용 중)과 광역 사슬 폭우(`chain_rain`, `src/game.js:1893-1896`, 고정값 `5 + getGunnerBonus()`).
  - 레거시 `combatAction()`의 `"chain"` 분기(`src/game.js:2260` 부근, 게임 플레이에서 도달하지 않는 죽은 코드지만 일관성을 위해 같이 수정 — 이전 사기 밸런스 작업에서도 같은 이유로 이 분기를 함께 고친 전례가 있다).
  - `combatCardDescription()`의 사슬탄 툴팁 범위 계산(`src/game.js:2650-2651`, `chainMinimum`/`chainMaximum`).

### 제외

- `gunner_magazine_open`, `gunner_fleet_broadside` — `cannonDamage()`를 쓰지 않고 `getCannonPower()`를 직접 사용하는 선장(포수) 전용 필살기 카드. "기본 카드"가 아니라 특수 카드로 분류해 제외한다.
- 갈고리 투척(`grappling_hook`), 충각 돌진(`ram`), 화공선 방출(`fireship`), 결사 돌입(`desperate_board`) 등 고정 수치 희귀·에픽 카드, 주술(mystic)·망령(revenant) 계열 카드 — 이미 개별적으로 튜닝된 고유 수치라 이번 조정 대상이 아니다.
- 접안 실패 시 플레이어가 받는 피해, 적의 공격, 이벤트 피해 등 "플레이어가 맞는" 수치 — 이번 스코프는 플레이어가 주는 피해로 한정한다.
- 사기 기반 행운 보정(`luckyRandomInt`)의 확률·배수 자체 — 이번 조정은 기본 피해량에 곱해지는 새 스케일 상수만 추가하며, 행운 보정 로직은 그대로 둔다.

## 적용 후 예상 수치 (참고)

- fire (화력 6, 예시 — 캡틴별 화력 보너스는 없으며 `getCannonPower()`는 선원 구성에만 의존한다): 기존 8~12(평균 10) → 6~10(평균 약 8)
- chain: 기존 6~10(+보너스) → 5~8(+보너스, 각각 반올림)
- chain_rain: 기존 고정 5(+보너스) → 고정 4(+보너스, 반올림)

정확한 반올림 결과는 구현 시 각 지점에서 `Math.round`로 계산한다.

## 테스트 및 검증

- `cannonDamage()`가 `PLAYER_DAMAGE_SCALE`을 적용한 값을 반환하는지 확인하는 단위 테스트를 추가한다 (예: `luckyRandomInt`를 모킹해 스케일 전 값과 스케일 후 값을 비교).
- `combatCannonDamageRange()`가 스케일 적용 후에도 `cannonDamage()`의 실제 반환값과 일치하는 범위를 표시하는지 확인하는 테스트를 추가한다 (표시값과 계산값의 불일치를 방지하기 위한 핵심 테스트).
- 사슬탄 계열 카드(chain, heavy_chain, entangling_chain, chain_rain) 실행 시 스케일이 적용된 피해가 적용되는지 확인하는 통합 테스트를 추가한다.
- `combatCardDescription()`의 사슬탄 툴팁 범위가 실제 사슬탄 카드 실행 피해와 일치하는지 확인하는 테스트를 추가한다.
- 기존 카드 전투 회귀 테스트(`tests/captain-card-combat.test.js`, `tests/card-combat.test.js`, `tests/card-ui.test.js`)가 스케일 상수 도입으로 깨지지 않는지 확인한다 — 하드코딩된 피해량을 기대하는 기존 테스트가 있다면 새 스케일 적용 후 값으로 갱신한다.
