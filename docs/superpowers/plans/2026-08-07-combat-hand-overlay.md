# 전투 카드 손패 오버레이·부채꼴 배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전투 카드 UI(`#actionDock`)를 캔버스 위에 겹치는 오버레이로 전환하고, 손패를 부채꼴로 배치하며, 드래그 중인 카드의 시각 피드백을 강화한다.

**Architecture:** DOM 구조는 `#actionDock`을 `.canvas-wrap` 내부로 옮기고 CSS `:has(.combat-hand)` 선택자로 전투 중일 때만 절대위치 오버레이 스타일을 적용한다. 부채꼴 배치는 `game.js`의 순수 함수 `fanCardTransform(index, total)`이 계산한 회전각/오프셋을 카드 버튼의 CSS 커스텀 프로퍼티(`--fan-rotate`, `--fan-lift`)로 주입하고, CSS가 이를 `transform`으로 소비한다. 드래그/타겟팅 로직(`beginCardDrag` 등)과 카드 상태 엔진은 전혀 건드리지 않는다.

**Tech Stack:** 순수 HTML/CSS/바닐라 JS (빌드 도구 없음), Node 내장 테스트 러너(`node --test`)로 `game.js`를 `vm` 모듈에 로드해 테스트.

## Global Constraints

- 기존 DOM 클래스/ID(`#actionDock`, `.combat-card`, `.pile-button`, `.captain-skill-button`, `.end-turn-button`, `.combat-target-button`, `.combat-energy`, `.combat-log` 등)는 이름과 존재 여부를 그대로 유지한다. `tests/card-ui.test.js`가 이 셀렉터들로 요소를 찾는다.
- `src/card-engine.js`, `src/card-definitions.js`, `src/fleet-combat.js`, 그리고 `beginCardDrag`/`updateCardDrag`/`finishCardDrag`/`beginCardFlight`/`combatDropTargets`/`eligibleDropTargets`/`cardDisabledReason` 등 드래그·타겟팅·카드 판정 로직은 **수정하지 않는다**. 이번 작업은 시각적 배치(CSS)와 손패 렌더링의 위치 계산(JS)만 다룬다.
- `#actionDock`은 전투 화면 외에 이벤트 선택지·항구 메뉴 등에서도 재사용된다 (`src/game.js`의 `clearElement(ui.actionDock)` 호출부: 1092, 1360, 1387, 3086, 3651행 부근). 오버레이 스타일은 반드시 `.action-dock:has(.combat-hand)` 처럼 **전투 손패가 실제로 렌더링된 경우로 범위를 한정**해서, 이벤트/항구 화면의 기존 박스형 레이아웃을 건드리지 않는다.
- 반응형 브레이크포인트 `@media (max-width: 620px)`에서는 오버레이와 부채꼴을 끄고 기존의 박스형·2열 그리드 레이아웃을 유지한다 (모바일 상호작용 재설계는 이번 범위 밖).
- **알려진 기존 문제:** 작업 시작 전 `node --test tests/card-ui.test.js`를 실행하면 `main` 기준 24개 중 **21개가 이미 실패**한다 (드래그 상태가 `"idle"`에 멈추는 회귀, 이번 작업과 무관). 이 실패들은 이번 계획의 책임이 아니다. 각 태스크의 "테스트 실행" 단계는 실패 개수가 **이 21개보다 늘지 않는지**만 확인한다. 정확히는 아래 3개 테스트가 현재 유일하게 통과하며, 이 셋은 계속 통과해야 한다:
  - `카드 설명은 현재 전투 수치로 계산되고 내부 함수명이나 기존 효과 문구를 노출하지 않는다`
  - `HUD 접근성 이름은 현재 자원 값을 포함하고 선원 설명을 분리한다`
  - `알 수 없는 카드 인스턴스는 손패 렌더링에서 건너뛴다`
- **전체 스위트 기준선:** 저장소 루트에서 인자 없이 `node --test`를 실행하면(디렉터리 자동 탐색) 179개 테스트 중 157 pass / 22 fail이 정상이다 (22 = `card-ui.test.js`의 21개 + `card-progression.test.js:306` "전투 보상 위에서 연 덱 열람은 원래 모달과 핸들러를 상태 변경 없이 복원한다" 1개, 둘 다 이번 작업과 무관한 기존 실패). **주의:** `node --test tests/`처럼 경로를 인자로 주면 Node가 이를 `require`할 모듈 경로로 오인해 `MODULE_NOT_FOUND`로 즉시 실패한다 — 항상 인자 없이 `node --test`를 저장소 루트에서 실행하거나, 개별 파일을 `node --test tests/파일명.test.js` 형태로 지정한다.

---

## Task 1: 부채꼴 배치 계산 함수 `fanCardTransform`

**Files:**
- Modify: `src/game.js` (새 함수를 `renderCombatHand` 바로 앞, 약 2970행 부근에 추가)
- Test: Create `tests/combat-hand-fan.test.js`

**Interfaces:**
- Produces: `fanCardTransform(index: number, total: number) -> { rotateDeg: number, liftPx: number }`. Task 2가 이 함수를 `renderCombatHand()`에서 호출한다.
- Consumes: 기존 전역 함수 `clamp(value, min, max)` (`src/game.js:514`).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/combat-hand-fan.test.js` 파일을 새로 만든다:

```js
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { runGame, read } = require("./helpers/load-game.js");

function fan(index, total) {
  const context = runGame("globalThis.__ctx = true;");
  return JSON.parse(read(context, `JSON.stringify(fanCardTransform(${index}, ${total}))`));
}

test("카드가 한 장이면 회전과 리프트가 0이다", () => {
  assert.deepEqual(fan(0, 1), { rotateDeg: 0, liftPx: 0 });
});

test("카드가 없으면(total 0) 회전과 리프트가 0이다", () => {
  assert.deepEqual(fan(0, 0), { rotateDeg: 0, liftPx: 0 });
});

test("홀수 장수는 중앙 카드가 회전 0, 바깥으로 갈수록 대칭 회전한다", () => {
  assert.deepEqual(fan(2, 5), { rotateDeg: 0, liftPx: 0 });
  assert.deepEqual(fan(0, 5), { rotateDeg: -12, liftPx: 10 });
  assert.deepEqual(fan(4, 5), { rotateDeg: 12, liftPx: 10 });
  assert.deepEqual(fan(1, 5), { rotateDeg: -6, liftPx: 5 });
});

test("짝수 장수는 중앙 두 장이 대칭으로 살짝 회전한다", () => {
  assert.deepEqual(fan(0, 2), { rotateDeg: -3, liftPx: 2.5 });
  assert.deepEqual(fan(1, 2), { rotateDeg: 3, liftPx: 2.5 });
});

test("최대 손패(8장)에서도 회전각이 최대치를 넘지 않는다", () => {
  const result = fan(0, 8);
  assert.equal(result.rotateDeg, -16);
  const result2 = fan(7, 8);
  assert.equal(result2.rotateDeg, 16);
});
```

- [ ] **Step 2: 테스트 실행 후 실패 확인**

Run: `node --test tests/combat-hand-fan.test.js`
Expected: FAIL — `fanCardTransform is not defined` (ReferenceError), 5개 테스트 모두 실패.

- [ ] **Step 3: 최소 구현 작성**

`src/game.js`의 `renderCombatHand` 함수(약 2971행) 바로 위에 추가:

```js
const FAN_ROTATE_STEP_DEG = 6;
const FAN_ROTATE_MAX_DEG = 16;
const FAN_LIFT_STEP_PX = 5;

function fanCardTransform(index, total) {
  if (total <= 1) return { rotateDeg: 0, liftPx: 0 };
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotateDeg = clamp(offset * FAN_ROTATE_STEP_DEG, -FAN_ROTATE_MAX_DEG, FAN_ROTATE_MAX_DEG);
  const liftPx = Math.abs(offset) * FAN_LIFT_STEP_PX;
  return { rotateDeg, liftPx };
}
```

- [ ] **Step 4: 테스트 실행 후 통과 확인**

Run: `node --test tests/combat-hand-fan.test.js`
Expected: PASS — 5개 테스트 모두 통과.

- [ ] **Step 5: 전체 회귀 확인**

Run: `node --test tests/card-ui.test.js`
Expected: 여전히 3 pass / 21 fail (Global Constraints에 적힌 기존 실패 그대로, 새로 늘어난 실패 없음).

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/combat-hand-fan.test.js
git commit -m "feat(cards): add fan layout transform calculation"
```

---

## Task 2: `renderCombatHand`에 부채꼴 커스텀 프로퍼티 적용

**Files:**
- Modify: `src/game.js:3008-3036` (`renderCombatHand`의 카드 생성 루프)

**Interfaces:**
- Consumes: `fanCardTransform(index, total)` (Task 1).
- Produces: 각 `.combat-card` 버튼 요소에 인라인 스타일 `--fan-rotate`(`"{deg}deg"`), `--fan-lift`(`"{px}px"`)가 설정됨. Task 4의 CSS가 이 커스텀 프로퍼티를 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/helpers/load-game.js`의 기본 `makeElement()`는 `style: { setProperty() {} }`가 완전한 no-op이라 커스텀 프로퍼티 설정 여부를 검증할 수 없다. 이 테스트는 **helper 파일을 수정하지 않고**, 테스트 안에서 `document.createElement`를 감싸 각 button 요소가 받은 `style.setProperty` 호출을 기록한다. `tests/combat-hand-fan.test.js` 파일 맨 아래에 추가한다:

```js
test("renderCombatHand는 손패 카드마다 부채꼴 커스텀 프로퍼티를 설정한다", () => {
  const context = runGame(`globalThis.__marker = true;`);
  const raw = read(context, `
    (() => {
      const originalCreateElement = document.createElement.bind(document);
      const created = [];
      document.createElement = (tag) => {
        const element = originalCreateElement(tag);
        const props = {};
        element.style = { setProperty(name, value) { props[name] = value; } };
        if (tag === "button") created.push(props);
        return element;
      };
      run = makeTestRun({ mode: "combat" });
      run.combat = {
        cardState: {
          hand: [
            { instanceId: "c0", cardId: "fire", costDelta: 0 },
            { instanceId: "c1", cardId: "chain", costDelta: 0 },
            { instanceId: "c2", cardId: "approach", costDelta: 0 },
          ],
          drawPile: [], discardPile: [], exhaustPile: [],
          energy: 3, maxEnergy: 3,
        },
        enemies: [enemyState()],
        log: ["테스트 시작"],
        locked: false,
      };
      renderCombatHand();
      const fanButtons = created.filter((props) => "--fan-rotate" in props);
      return JSON.stringify(fanButtons);
    })();
  `);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]["--fan-rotate"], "-6deg");
  assert.equal(parsed[0]["--fan-lift"], "5px");
  assert.equal(parsed[1]["--fan-rotate"], "0deg");
  assert.equal(parsed[1]["--fan-lift"], "0px");
  assert.equal(parsed[2]["--fan-rotate"], "6deg");
  assert.equal(parsed[2]["--fan-lift"], "5px");
});
```

`created`는 tag가 `"button"`인 모든 생성 요소의 `props` 객체 참조를 담는다 (이 테스트의 손패 카드 3장뿐 아니라 더미/기술/턴종료 버튼도 포함된다). `renderCombatHand()` 실행이 끝난 뒤 `--fan-rotate`가 실제로 설정된 것만 걸러내면, 손패 카드 3장만 남는다 (다른 버튼들은 `style.setProperty`를 호출하지 않으므로 `props`가 빈 객체로 남는다).

- [ ] **Step 2: 테스트 실행 후 실패 확인**

Run: `node --test tests/combat-hand-fan.test.js`
Expected: FAIL — `parsed.length`가 0 (아직 `renderCombatHand`가 `--fan-rotate`를 설정하지 않음).

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:3008-3016`의 카드 생성 루프를 수정한다. 현재:

```js
  state.hand.forEach((instance, index) => {
    const card = CardDefinitions.getCard(instance.cardId);
    if (!card) return;
    const reason = cardDisabledReason(instance);
    const selected = instance.instanceId === keyboardCardSelection.instanceId;
    const button = makeElement("button", `combat-card rarity-${card.rarity}${selected ? " is-selected" : ""}`);
    button.type = "button";
    button.disabled = Boolean(reason);
    button.setAttribute("data-instance-id", instance.instanceId);
```

다음으로 교체 (세 줄 추가):

```js
  state.hand.forEach((instance, index) => {
    const card = CardDefinitions.getCard(instance.cardId);
    if (!card) return;
    const reason = cardDisabledReason(instance);
    const selected = instance.instanceId === keyboardCardSelection.instanceId;
    const button = makeElement("button", `combat-card rarity-${card.rarity}${selected ? " is-selected" : ""}`);
    button.type = "button";
    button.disabled = Boolean(reason);
    button.setAttribute("data-instance-id", instance.instanceId);
    const { rotateDeg, liftPx } = fanCardTransform(index, state.hand.length);
    button.style.setProperty("--fan-rotate", `${rotateDeg}deg`);
    button.style.setProperty("--fan-lift", `${liftPx}px`);
```

- [ ] **Step 4: 테스트 실행 후 통과 확인**

Run: `node --test tests/combat-hand-fan.test.js`
Expected: PASS — 모든 테스트 통과.

- [ ] **Step 5: 전체 회귀 확인**

Run: `node --test tests/card-ui.test.js`
Expected: 3 pass / 21 fail 그대로 (증가 없음). `renderCombatHand`가 사용하는 `tests/helpers/load-game.js`의 기본 `makeElement().style.setProperty`는 no-op이므로 기존 테스트에는 영향이 없다.

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/combat-hand-fan.test.js
git commit -m "feat(cards): apply fan transform to hand card elements"
```

---

## Task 3: 캔버스 오버레이로 전환 (`#actionDock`을 `.canvas-wrap` 안으로)

**Files:**
- Modify: `index.html:48-64`
- Modify: `styles.css:174-214` (`.canvas-wrap`, `.action-dock` 주변)

**Interfaces:**
- Consumes: 없음 (순수 구조/스타일 변경).
- Produces: `.action-dock:has(.combat-hand)`가 전투 중에만 절대위치 오버레이가 되는 CSS 규칙. Task 4/5가 이 위에서 부채꼴·드래그 스타일을 쌓는다.

- [ ] **Step 1: `index.html` 수정 — `#actionDock`을 `.canvas-wrap` 안으로 이동**

`index.html:48-64` 현재:

```html
      <div class="game-grid">
        <section class="viewport-panel" aria-label="항해 지도와 전투 화면">
          <div class="canvas-wrap">
            <canvas
              id="gameCanvas"
              width="1200"
              height="700"
              aria-label="항해 지도"
            ></canvas>

            <div id="modalLayer" class="modal-layer" role="dialog" aria-modal="true">
              <div id="modalPanel" class="modal-panel"></div>
            </div>
          </div>

          <div id="actionDock" class="action-dock" aria-live="polite"></div>
        </section>
```

다음으로 교체 (`#actionDock`을 `.canvas-wrap` 닫는 태그 안으로 이동):

```html
      <div class="game-grid">
        <section class="viewport-panel" aria-label="항해 지도와 전투 화면">
          <div class="canvas-wrap">
            <canvas
              id="gameCanvas"
              width="1200"
              height="700"
              aria-label="항해 지도"
            ></canvas>

            <div id="modalLayer" class="modal-layer" role="dialog" aria-modal="true">
              <div id="modalPanel" class="modal-panel"></div>
            </div>

            <div id="actionDock" class="action-dock" aria-live="polite"></div>
          </div>
        </section>
```

- [ ] **Step 2: `styles.css` 수정 — 전투 중에만 오버레이 스타일 적용**

`styles.css:207-214`의 기존 `.action-dock` 규칙(박스형 배경/테두리)은 이벤트·항구 화면에서 계속 써야 하므로 **그대로 둔다**. 바로 아래에 새 규칙을 추가한다:

```css
.action-dock:has(.combat-hand) {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 5;
  margin-top: 0;
  padding: 10px 14px 12px;
  border: 0;
  background: linear-gradient(to top, rgba(5, 18, 22, 0.95) 0%, rgba(5, 18, 22, 0.65) 55%, transparent 100%);
  box-shadow: none;
  pointer-events: none;
}

.action-dock:has(.combat-hand) > * {
  pointer-events: auto;
}
```

`.canvas-wrap`은 이미 `position: relative; overflow: hidden;`이므로 (`styles.css:186-194`) 별도 수정이 필요 없다 — 오버레이가 이 컨테이너를 기준으로 배치되고, 캔버스 밖으로 벗어나는 부분은 자동으로 잘린다.

`#modalLayer`는 `z-index: 10` (`styles.css:1073`)으로 이미 `.action-dock`의 `z-index: 5`보다 높으므로, 전투 승리·카드 보상 모달이 손패 오버레이 위에 정상적으로 표시된다.

- [ ] **Step 3: 수동 회귀 확인 — 비전투 화면**

브라우저에서 게임을 열고: (a) 출항 전 선장/항로 선택 화면, (b) 항해 지도에서 "미지의 조우" 이벤트 노드 진입 시 선택지 화면, (c) 항구 화면에서 각각 `#actionDock`이 기존과 동일한 박스형 레이아웃(테두리·배경 있음, 캔버스 하단에 고정)으로 보이는지 확인한다. 이 화면들에는 `.combat-hand` 요소가 없으므로 `:has()` 규칙이 적용되지 않아야 한다.

- [ ] **Step 4: 수동 확인 — 전투 화면**

전투에 진입해 `#actionDock`이 더 이상 테두리/배경 박스로 보이지 않고, 캔버스 하단에 그라데이션으로 자연스럽게 겹쳐 보이는지 확인한다 (아직 부채꼴은 적용 전이라 카드는 기존 그리드 배치로 보임 — 정상).

- [ ] **Step 5: 자동 테스트 회귀 확인**

Run: `node --test tests/card-ui.test.js`
Expected: 3 pass / 21 fail 그대로. (`tests/helpers/load-game.js`는 실제 `index.html`을 파싱하지 않고 합성 DOM을 만들므로 이 구조 변경으로 영향받지 않는다.)

- [ ] **Step 6: 커밋**

```bash
git add index.html styles.css
git commit -m "feat(ui): overlay combat action dock on the battle canvas"
```

---

## Task 4: 부채꼴 손패 CSS + 호버·선택 시 펼치기

**Files:**
- Modify: `styles.css:314-354` (`.combat-hand`, `.combat-card`, 호버/선택 규칙)

**Interfaces:**
- Consumes: `--fan-rotate`, `--fan-lift` 커스텀 프로퍼티 (Task 2에서 각 카드 버튼에 설정됨).
- Produces: 없음 (최종 시각 레이어).

- [ ] **Step 1: `.combat-hand`을 그리드에서 부채꼴 flex로 전환**

`styles.css:314-318` 현재:

```css
.combat-hand {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  gap: 7px;
}
```

다음으로 교체:

```css
.combat-hand {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-wrap: nowrap;
  padding-top: 34px;
}
```

- [ ] **Step 2: `.combat-card`에 부채꼴 겹침·회전 적용**

`styles.css:320-342` 현재:

```css
.combat-card {
  --drag-x: 0px;
  --drag-y: 0px;
  --flight-x: 0px;
  --flight-y: 0px;
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 138px;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 10px 9px 8px;
  overflow: hidden;
  border: 1px solid #516b70;
  border-top: 3px solid #8ba1a2;
  color: #e9e5d8;
  background: linear-gradient(160deg, #18333b, #0b2027 72%);
  box-shadow: 0 7px 16px rgba(0, 0, 0, 0.24);
  cursor: grab;
  touch-action: none;
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}
```

다음으로 교체 (`--fan-rotate`/`--fan-lift` 기본값 추가, `flex: 0 0 auto` + 고정 폭, `margin-left`로 겹침, 기본 `transform` 추가):

```css
.combat-card {
  --drag-x: 0px;
  --drag-y: 0px;
  --flight-x: 0px;
  --flight-y: 0px;
  --fan-rotate: 0deg;
  --fan-lift: 0px;
  position: relative;
  display: flex;
  flex: 0 0 118px;
  min-width: 0;
  min-height: 138px;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 10px 9px 8px;
  margin-left: -38px;
  overflow: hidden;
  border: 1px solid #516b70;
  border-top: 3px solid #8ba1a2;
  color: #e9e5d8;
  background: linear-gradient(160deg, #18333b, #0b2027 72%);
  box-shadow: 0 7px 16px rgba(0, 0, 0, 0.24);
  cursor: grab;
  touch-action: none;
  transform-origin: bottom center;
  transform: rotate(var(--fan-rotate)) translateY(var(--fan-lift));
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, z-index 0ms;
}

.combat-hand .combat-card:first-child {
  margin-left: 0;
}
```

- [ ] **Step 3: 호버/선택 시 회전 해제하고 띄우기**

`styles.css:347-354` 현재:

```css
.combat-card:hover:not(:disabled),
.combat-card:focus-visible,
.combat-card.is-selected {
  border-color: #f0c968;
  outline: none;
  box-shadow: 0 0 0 2px rgba(240, 201, 104, 0.28), 0 9px 22px rgba(0, 0, 0, 0.34);
  transform: translateY(-3px);
}
```

다음으로 교체:

```css
.combat-card:hover:not(:disabled),
.combat-card:focus-visible,
.combat-card.is-selected {
  border-color: #f0c968;
  outline: none;
  box-shadow: 0 0 0 2px rgba(240, 201, 104, 0.28), 0 9px 22px rgba(0, 0, 0, 0.34);
  transform: translateY(calc(var(--fan-lift) - 34px)) rotate(0deg);
  z-index: 20;
}
```

- [ ] **Step 4: 수동 확인**

브라우저에서 전투에 진입해 5장 이상의 손패를 확인한다: 카드들이 부채꼴로 겹쳐 보이고, 중앙 카드는 회전이 거의 없으며 바깥쪽 카드일수록 기울어지고 아래로 처지는지 확인한다. 마우스를 카드 위에 올렸을 때 해당 카드만 회전이 풀리고 위로 떠올라 다른 카드를 가리지 않고 전체 텍스트가 보이는지 확인한다.

- [ ] **Step 5: 자동 테스트 회귀 확인**

Run: `node --test tests/card-ui.test.js && node --test tests/combat-hand-fan.test.js`
Expected: `card-ui.test.js`는 3 pass / 21 fail 그대로, `combat-hand-fan.test.js`는 전체 통과.

- [ ] **Step 6: 커밋**

```bash
git add styles.css
git commit -m "feat(ui): fan out combat hand cards with hover reveal"
```

---

## Task 5: 드래그 시각 피드백 강화 + reduced-motion 회귀 방지

**Files:**
- Modify: `styles.css:362-372` (`.combat-card.is-dragging`)
- Modify: `styles.css:1805-1812` (`prefers-reduced-motion` 블록)

**Interfaces:**
- Consumes: 기존 `--drag-x`/`--drag-y` 커스텀 프로퍼티 (`src/game.js`의 `updateCardDrag`가 이미 설정, 변경 없음).
- Produces: 없음.

- [ ] **Step 1: 드래그 중 스케일/그림자/글로우 강화**

`styles.css:362-372` 현재:

```css
.combat-card.is-dragging {
  z-index: 30;
  cursor: grabbing;
  transform: translate(var(--drag-x), var(--drag-y)) rotate(-2deg) scale(1.04);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.48);
}

.combat-card.is-dragging.has-valid-target {
  border-color: #7fe2a6;
  box-shadow: 0 0 0 3px rgba(88, 215, 137, 0.3), 0 16px 34px rgba(0, 0, 0, 0.48);
}
```

다음으로 교체:

```css
.combat-card.is-dragging {
  z-index: 30;
  cursor: grabbing;
  transform: translate(var(--drag-x), var(--drag-y)) rotate(-3deg) scale(1.16);
  box-shadow: 0 22px 46px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(255, 255, 255, 0.14);
}

.combat-card.is-dragging.has-valid-target {
  border-color: #7fe2a6;
  box-shadow: 0 0 0 4px rgba(88, 215, 137, 0.45), 0 22px 46px rgba(0, 0, 0, 0.55);
}
```

- [ ] **Step 2: reduced-motion 블록이 부채꼴 기본 배치까지 지우지 않도록 범위 축소**

`styles.css:1805-1812` 현재:

```css
  .combat-card,
  .combat-card.is-dragging,
  .combat-card.is-flying,
  .combat-card.is-returning {
    animation: none;
    transition-duration: 1ms;
    transform: none;
  }
```

다음으로 교체 (`.combat-card` 단독 셀렉터 제거 — 나머지 세 상태는 그대로 유지):

```css
  .combat-card.is-dragging,
  .combat-card.is-flying,
  .combat-card.is-returning {
    animation: none;
    transition-duration: 1ms;
    transform: none;
  }
```

이렇게 하면 `prefers-reduced-motion: reduce` 환경에서도 부채꼴의 정적 회전/리프트(`--fan-rotate`/`--fan-lift` 기반 `transform`)는 유지되고, 드래그/비행/복귀 중 동적 모션만 계속 억제된다 (기존 접근성 의도 그대로).

- [ ] **Step 3: 수동 확인**

브라우저 개발자 도구에서 "prefers-reduced-motion: reduce"를 에뮬레이트하고 전투 화면에 진입해, 손패가 여전히 부채꼴(정적 회전)로 보이는지, 카드를 드래그했을 때 애니메이션 없이 즉시 상태가 바뀌는지 확인한다. 이후 에뮬레이션을 해제하고 일반 모드에서 드래그 시 카드가 확실히 커지고 그림자가 진해지는지 확인한다.

- [ ] **Step 4: 자동 테스트 회귀 확인**

Run: `node --test tests/card-ui.test.js`
Expected: 3 pass / 21 fail 그대로 (CSS만 변경했으므로 이 테스트 스위트의 결과는 원칙적으로 변하지 않는다).

- [ ] **Step 5: 커밋**

```bash
git add styles.css
git commit -m "fix(ui): sharpen drag feedback and preserve fan layout under reduced motion"
```

---

## Task 6: 모바일 브레이크포인트에서 오버레이·부채꼴 비활성화

**Files:**
- Modify: `styles.css:1605-1667` (`@media (max-width: 620px)` 블록)

**Interfaces:**
- Consumes: Task 3/4에서 추가한 `.action-dock:has(.combat-hand)`, `.combat-card`의 부채꼴 규칙.
- Produces: 없음.

- [ ] **Step 1: 좁은 화면에서 오버레이를 원래 박스형 레이아웃으로 되돌리기**

`styles.css:1653-1659`의 기존 모바일 `.combat-hand` 규칙 바로 뒤에 추가한다 (`@media (max-width: 620px)` 블록 내부, 대략 1659행 다음):

```css
  .action-dock:has(.combat-hand) {
    position: static;
    padding: 10px;
    background: none;
  }

  .combat-hand {
    padding-top: 0;
  }

  .combat-card {
    margin-left: 0;
    transform: none;
  }

  .combat-card:hover:not(:disabled),
  .combat-card:focus-visible,
  .combat-card.is-selected {
    transform: translateY(-3px);
    z-index: auto;
  }
```

기존 모바일 규칙(`.action-dock { min-height: 104px; margin-top: 0; padding: 10px; border-right: 0; border-left: 0; }`, `styles.css:1616-1622`)은 그대로 두되, 위 `.action-dock:has(.combat-hand)`가 동일 specificity(2 class-level)로 더 뒤에 선언되어 `position`/`background`를 확실히 덮어쓴다.

- [ ] **Step 2: 수동 확인**

브라우저 창을 620px 이하로 좁히거나 (`resize_window`로 mobile 프리셋 사용) 전투 화면에 진입해, 카드가 부채꼴 없이 2열 그리드로, `#actionDock`이 다시 캔버스 아래 별도 박스(배경 있음)로 보이는지 확인한다. 화면 폭을 다시 넓히면 오버레이·부채꼴이 복원되는지도 확인한다.

- [ ] **Step 3: 자동 테스트 회귀 확인**

Run: `node --test tests/card-ui.test.js && node --test tests/responsive-accessibility.test.js`
Expected: `card-ui.test.js` 3 pass / 21 fail 그대로. `responsive-accessibility.test.js`는 이번 변경 전 통과율을 확인해두고 동일하게 유지되는지 비교한다 (사전에 `git stash` 없이 현재 브랜치에서 한 번 실행해 기준선을 기록해 둔다).

- [ ] **Step 4: 커밋**

```bash
git add styles.css
git commit -m "fix(ui): keep boxed hand layout on narrow viewports"
```

---

## Task 7: 최종 회귀 확인 및 실전 플레이 검증

**Files:** 없음 (검증 전용 태스크)

**Interfaces:** 없음.

- [ ] **Step 1: 전체 자동 테스트 실행**

Run: `node --test` (저장소 루트에서, 경로 인자 없이 — 디렉터리를 인자로 주면 `MODULE_NOT_FOUND`로 실패한다)
Expected: 179개 테스트 중 157 pass / 22 fail 그대로 (Global Constraints의 전체 스위트 기준선과 동일: `card-ui.test.js`의 21개 + `card-progression.test.js:306`의 1개, 둘 다 기존 실패). 차이가 있다면 어느 테스트가 새로 깨졌는지 정확히 특정하고 원인을 CSS/JS 변경과 연결해 확인한다.

- [ ] **Step 2: 브라우저 실전 플레이**

`.claude/launch.json`의 `pirate-game` 설정(`python3 -m http.server 5173`)으로 로컬 서버를 띄우고, 새 항해를 시작해 전투 노드까지 진행한다. 손패에서 카드를 하나 골라 적 위로 드래그해 실제로 명중/피해가 적용되는지, 부채꼴 배치와 드래그 강조, 캔버스 오버레이가 함께 자연스럽게 보이는지 스크린샷으로 확인한다.

- [ ] **Step 3: 접근성 경로 확인**

숫자 키(1~5)로 카드를 선택하고 방향키/Tab으로 대상을 고른 뒤 Enter로 실행하는 키보드 흐름이 오버레이 전환 후에도 그대로 동작하는지 확인한다 (이 흐름은 `selectCardByInstance`/`renderCombatTargetChoices`를 그대로 사용하므로 로직 변화는 없어야 하지만, 오버레이 z-index/pointer-events 변경으로 시각적으로 가려지지 않는지 확인이 필요하다).

- [ ] **Step 4: 커밋 (필요 시)**

이 태스크는 검증 전용이므로 코드 변경이 없으면 커밋하지 않는다. 검증 중 발견된 사소한 CSS 보정이 있다면:

```bash
git add styles.css
git commit -m "fix(ui): polish overlay verification fixes"
```
