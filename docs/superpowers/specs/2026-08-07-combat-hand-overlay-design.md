# 전투 카드 UI 오버레이·부채꼴 손패 설계

작성일: 2026-08-07

## 배경

현재 전투 카드 UI는 이미 드래그로 대상을 지정해 카드를 사용할 수 있다 (`fb03181`, `921dff1`). 다만 카드·에너지·뽑기/버림 더미가 캔버스 아래 별도의 테두리·배경을 가진 박스(`#actionDock`)에 들어 있어 캔버스(전투 장면)와 시각적으로 분리되어 보인다. 또한 손패는 일반 그리드로 나열되어 있어 Slay the Spire 같은 부채꼴 손패 느낌이 없고, 드래그 중인 카드가 손을 따라다닌다는 인지성이 약하다.

## 목표

- 카드/에너지/뽑기·버림 더미 UI를 캔버스 위에 겹치는 하나의 화면처럼 보이게 한다.
- 손패를 부채꼴로 겹쳐서 배치하고, 호버·선택 시 카드가 떠오르며 펴져 전체 내용이 보이게 한다.
- 드래그 중인 카드가 마우스를 따라가고 있다는 인지성을 강화한다.
- 기존 드래그 판정 로직(`beginCardDrag`/`updateCardDrag`/`finishCardDrag`/`combatDropTargets` 등)과 카드 상태 엔진(`card-engine.js`)은 변경하지 않는다.
- 기존 DOM 클래스/ID(`#actionDock`, `.combat-card`, `.pile-button`, `.captain-skill-button`, `.end-turn-button`, `.combat-target-button` 등)를 유지해 `tests/card-ui.test.js`가 그대로 통과하게 한다.

## 범위

### 포함

- `index.html`: `#actionDock`을 `.canvas-wrap` 내부로 이동해 캔버스와 같은 컨테이너에 절대위치로 배치.
- `styles.css`: `.action-dock`의 테두리/배경/그림자 제거, 하단 그라데이션으로 캔버스 장면과 자연스럽게 연결. 에너지·더미 카운터를 화면 모서리에 뜨는 HUD 형태로 재배치.
- `styles.css` + `game.js`: `.combat-hand`를 부채꼴 배치로 전환 (카드별 회전각·y오프셋을 `--fan-index`/`--fan-total` 커스텀 프로퍼티로 계산해 CSS transform 적용). 호버/선택 시 회전 해제 + 위로 띄우기 + z-index 상승.
- `styles.css`: `.is-dragging` 상태의 시각 강조 확대 (스케일 확대, 그림자·글로우 강화).
- 반응형(`@media`) 브레이크포인트에서도 오버레이가 화면 밖으로 벗어나지 않도록 조정.

### 제외

- 카드 판정/타겟팅 로직 변경 (`card-engine.js`, `beginCardDrag` 등 드래그 상태 머신).
- 새로운 카드 효과나 밸런스 변경.
- 키보드 전용 카드 선택 흐름(`selectCardByInstance`, `renderCombatTargetChoices`)의 동작 변경 — 위치만 오버레이 안으로 옮겨진다.
- 모바일 터치 전용 상호작용 재설계 (기존 반응형 규칙 유지, 위치 값만 조정).

## 레이아웃 변경

### 오버레이 구조

`#actionDock`은 `.canvas-wrap` 안에서 `position: absolute; bottom: 0; left: 0; right: 0;`으로 배치되어 캔버스 위에 겹친다. 배경색·테두리·`box-shadow`를 제거하고, 대신 `linear-gradient(to top, 배경색 0%, transparent 100%)` 형태의 하단 페이드를 깔아 전투 장면과 자연스럽게 이어지게 한다.

- 에너지 표시(`.combat-energy`): 좌하단 고정.
- 뽑기/버림/소멸 더미(`.pile-button` 3개): 우하단 고정.
- 전투 로그(`.combat-log`): 상단 중앙 또는 좌상단 소형 HUD로 축소 배치.
- 스킬 버튼(`.captain-skill-button`)·턴 종료 버튼(`.end-turn-button`): 손패 우측 하단에 고정.
- 대상 선택 버튼(`.combat-target-button`, 키보드 흐름용): 손패 위쪽에 오버레이로 표시.

### 부채꼴 손패

`renderCombatHand()`에서 카드 버튼 생성 시 각 카드에 `style.setProperty('--fan-index', index)` / `--fan-total`을 지정한다. CSS에서 이 값을 이용해 각 카드에 회전각(중앙 카드는 0도, 바깥쪽으로 갈수록 최대 ±약 12~15도)과 수직 오프셋(바깥쪽 카드가 살짝 아래로 처지는 부채꼴 곡선), 좌우 겹침(음수 margin 또는 절대위치)을 계산한다. 카드 수(최대 8장, `handLimit`)에 따라 회전 최대각과 겹침 정도를 비례 조정해 손패가 화면 폭을 벗어나지 않게 한다.

`:hover:not(:disabled)`, `:focus-visible`, `.is-selected` 상태에서는:

- `transform`의 회전 성분을 0으로 재정의하고 `translateY`로 위로 띄운다.
- `z-index`를 다른 카드보다 높여 겹침 없이 전체가 보이게 한다.

드래그 중(`.is-dragging`)에는 부채꼴 회전 대신 기존처럼 포인터 델타(`--drag-x`/`--drag-y`) 기준 이동이 우선 적용된다.

### 드래그 인지성 강화

`.combat-card.is-dragging`의 `transform` 스케일을 현재 `1.04`보다 크게(예: `1.12~1.18`) 올리고, `box-shadow`를 더 짙고 넓게, 테두리에 은은한 글로우를 추가한다. 유효 타겟 위에 있을 때(`.has-valid-target`)의 초록색 강조는 유지하되 글로우 반경을 키운다. 카드가 손패에서 들려 올라간 자리는 나머지 카드들의 `--fan-index` 재계산으로 자연스럽게 메워진다 (기존 배열 기반 재렌더링 방식 그대로 활용).

## 영향받지 않는 부분

- `src/card-engine.js`, `src/card-definitions.js`, `src/fleet-combat.js`: 변경 없음.
- `beginCardDrag`, `updateCardDrag`, `finishCardDrag`, `beginCardFlight`, `combatDropTargets`, `eligibleDropTargets`: 변경 없음 (좌표 계산은 DOM 요소의 실제 렌더링 위치를 기준으로 하므로 시각적 위치가 바뀌어도 그대로 동작).
- 카드 활성화/비활성화 판정(`cardDisabledReason`), 키보드 대상 선택 로직: 변경 없음.

## 테스트 및 검증

- 기존 `tests/card-ui.test.js`, `tests/combat-rendering.test.js`, `tests/responsive-accessibility.test.js`가 DOM 클래스/ID 기준으로 그대로 통과해야 한다 (레이아웃은 CSS/위치 값만 변경).
- 브라우저에서 실제 전투에 진입해 드래그로 카드를 적에게 사용하는 흐름을 시각적으로 확인한다.
- 반응형 브레이크포인트(모바일 폭)에서 오버레이와 부채꼴 손패가 화면 밖으로 잘리지 않는지 확인한다.
