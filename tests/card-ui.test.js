"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadGameScripts, read } = require("./helpers/load-game.js");

class ClassList {
  constructor(element) { this.element = element; }
  values() { return this.element.className.split(/\s+/).filter(Boolean); }
  contains(name) { return this.values().includes(name); }
  add(...names) { this.element.className = [...new Set([...this.values(), ...names])].join(" "); }
  remove(...names) { this.element.className = this.values().filter((name) => !names.includes(name)).join(" "); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.contains(name) : force;
    if (enabled) this.add(name); else this.remove(name);
    return enabled;
  }
}

class TestElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.className = "";
    this.classList = new ClassList(this);
    this.dataset = {};
    this.attributes = {};
    this.disabled = false;
    this.hidden = true;
    this.listeners = new Map();
    this.style = {
      values: {},
      setProperty: (name, value) => { this.style.values[name] = value; },
      removeProperty: (name) => { delete this.style.values[name]; },
    };
    this.textContent = "";
    this.type = "";
    this.capture = null;
    this.rect = { bottom: 120, height: 100, left: 20, right: 100, top: 20, width: 80 };
  }

  get firstChild() { return this.children[0] || null; }
  append(...children) {
    children.forEach((child) => {
      if (child === null || child === undefined) return;
      if (typeof child !== "object") {
        this.textContent += String(child);
        return;
      }
      child.parentElement = this;
      this.children.push(child);
    });
  }
  appendChild(child) { this.append(child); return child; }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentElement = null;
    return child;
  }
  replaceChildren(...children) { this.children.slice().forEach((child) => this.removeChild(child)); this.append(...children); }
  remove() { this.parentElement?.removeChild(this); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = String(value);
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith("data-")) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())];
  }
  addEventListener(type, listener, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, once: Boolean(options?.once) });
    this.listeners.set(type, entries);
  }
  dispatch(type, init = {}) {
    const event = {
      bubbles: true,
      button: 0,
      clientX: 40,
      clientY: 40,
      currentTarget: this,
      defaultPrevented: false,
      pointerId: 1,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      target: this,
      ...init,
    };
    const entries = [...(this.listeners.get(type) || [])];
    entries.forEach((entry) => {
      entry.listener(event);
      if (entry.once) {
        this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== entry));
      }
    });
    return event;
  }
  click() { if (!this.disabled) this.dispatch("click"); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (matches(child, selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  getBoundingClientRect() { return { ...this.rect }; }
  setPointerCapture(pointerId) { this.capture = pointerId; }
  releasePointerCapture(pointerId) { if (this.capture === pointerId) this.capture = null; }
  hasPointerCapture(pointerId) { return this.capture === pointerId; }
}

function matches(element, selector) {
  const notDisabled = selector.includes(":not(:disabled)");
  const clean = selector.replace(":not(:disabled)", "");
  if (notDisabled && element.disabled) return false;
  const attribute = clean.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);
  const base = clean.replace(/\[[^\]]+\]/, "");
  if (attribute) {
    const [, name, value] = attribute;
    const actual = element.getAttribute(name);
    if (actual === null || (value !== undefined && actual !== value)) return false;
  }
  if (base.startsWith(".")) return element.classList.contains(base.slice(1));
  if (base.startsWith("#")) return element.getAttribute("id") === base.slice(1);
  return !base || element.tagName.toLowerCase() === base.toLowerCase();
}

function enemyState(id) {
  return {
    id, captured: false, crew: 20, defeated: false, hull: 100, intent: "attack", kind: "battle",
    maxCrew: 20, maxHull: 100, maxSails: 30, name: id, range: 2, sails: 30, damage: 1,
  };
}

function renderHandWith(cardIds, options = {}) {
  const elements = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const doc = {
    activeElement: null,
    createElement(tag) { return new TestElement(tag, doc); },
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new TestElement(selector === "#gameCanvas" ? "canvas" : "div", doc));
      return elements.get(selector);
    },
  };
  ["#hullLabel", "#sailsLabel", "#moraleLabel", "#foodLabel", "#waterLabel", "#goldLabel", "#cannonLabel", "#crewPowerLabel"]
    .forEach((selector) => {
      const tooltip = new TestElement("div", doc);
      tooltip.className = "game-tooltip";
      const value = new TestElement("strong", doc);
      tooltip.append(value);
      elements.set(selector, value);
    });
  const canvas = doc.querySelector("#gameCanvas");
  const actionDock = doc.querySelector("#actionDock");
  const modalLayer = doc.querySelector("#modalLayer");
  modalLayer.hidden = true;
  canvas.width = 1200;
  canvas.height = 700;
  canvas.rect = { bottom: 700, height: 700, left: 0, right: 1200, top: 0, width: 1200 };
  canvas.getContext = () => new Proxy({}, { get(target, property) { return target[property] ||= () => {}; } });
  const timers = [];
  const windowObject = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    matchMedia() { return { matches: Boolean(options.reducedMotion) }; },
  };
  const context = loadGameScripts([
    "src/analytics.js", "src/card-definitions.js", "src/card-engine.js", "src/fleet-combat.js", "src/game.js",
  ], {
    canvas,
    document: doc,
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    window: windowObject,
  });
  const enemies = Array.from({ length: options.enemies ?? 1 }, (_, index) => enemyState(`enemy-${index}`));
  read(context, `
    run = makeTestRun({
      captainId: ${JSON.stringify(options.captainId || "gunner")},
      mode: "combat", mapId: "calm", artifacts: [], crew: [], logs: [], cannons: 6,
      repairKits: 2, hull: 50, maxHull: 100, sails: 20, maxSails: 20, morale: 30,
      combat: {
        enemies: ${JSON.stringify(enemies)}, focusedEnemyId: ${JSON.stringify(enemies[0].id)},
        wind: { direction: "측풍", speed: 1 }, turn: 1, evasion: 0, skillReady: true,
        locked: ${Boolean(options.locked)}, firstShotUsed: false, victoryScheduled: false,
        enemyActions: 0, smugglerPulleyUsed: false, frugalUsed: false, rallyingUsed: false,
        boardingPowerBonus: 0, capturedCount: 0, message: "테스트 전투", log: ["테스트 전투"],
        cardState: {
          drawPile: [], discardPile: [], exhaustPile: [], energy: ${options.energy ?? 3}, maxEnergy: 3,
          handSize: ${cardIds.length}, handLimit: 8, turn: 1, nextInstanceId: ${cardIds.length + 1},
          hand: ${JSON.stringify(cardIds.map((cardId, index) => ({ instanceId: `card-${index + 1}`, cardId, costDelta: 0 })))},
        },
      },
    });
    globalThis.playCalls = [];
    globalThis.realPlayCard = playCard;
    playCard = (instanceId, target) => {
      playCalls.push({ instanceId, target });
      return realPlayCard(instanceId, target);
    };
    renderCombatHand();
  `);

  const card = (index) => actionDock.querySelectorAll(".combat-card")[index];
  const point = (value = {}) => ({ clientX: value.x ?? 40, clientY: value.y ?? 40, pointerId: value.pointerId ?? 7 });
  return {
    actionDock,
    canvas,
    context,
    element(selector) { return doc.querySelector(selector); },
    get dragPhase() { return read(context, "cardDragState.phase"); },
    get energy() { return read(context, "run.combat.cardState.energy"); },
    get handCardIds() { return JSON.parse(read(context, "JSON.stringify(run.combat.cardState.hand.map((item) => item.cardId))")); },
    get playCalls() { return JSON.parse(read(context, "JSON.stringify(playCalls)")); },
    get selectedTarget() { return JSON.parse(read(context, "JSON.stringify(currentKeyboardTarget())")); },
    finishAnimationTwice() {
      const active = card(0) || actionDock.querySelector(".is-flying");
      active?.dispatch("animationend", { animationName: "combat-card-flight" });
      timers.filter(({ delay }) => delay === 300).forEach(({ callback }) => callback());
    },
    flushTimers(delay) { timers.filter((timer) => delay === undefined || timer.delay === delay).forEach(({ callback }) => callback()); },
    key(key, extras = {}) {
      const event = { key, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras };
      windowListeners.get("keydown")?.(event);
      return event;
    },
    pointerDown(index, value = {}) { card(index).dispatch("pointerdown", point(value)); },
    pointerMove(value = {}) { card(0).dispatch("pointermove", point(value)); },
    pointerUp(value = {}) { card(0).dispatch("pointerup", point(value)); },
    pointerCancel(index = 0) { card(index).dispatch("pointercancel", point()); },
    dragTo(value, index = 0) { this.pointerDown(index); this.pointerMove(value); this.pointerUp(value); },
  };
}

function enemyCenter(ui, enemyId) {
  return JSON.parse(read(ui.context, `JSON.stringify((() => {
    const target = combatDropTargets().find((candidate) => candidate.type === "enemy" && candidate.id === ${JSON.stringify(enemyId)});
    return { x: (target.rect.left + target.rect.right) / 2, y: (target.rect.top + target.rect.bottom) / 2 };
  })())`));
}

function seaCenter(ui, range) {
  return JSON.parse(read(ui.context, `JSON.stringify((() => {
    const target = combatDropTargets().find((candidate) => candidate.type === "sea" && candidate.range === ${range});
    return { x: (target.rect.left + target.rect.right) / 2, y: (target.rect.top + target.rect.bottom) / 2 };
  })())`));
}

test("유효한 적 드롭은 애니메이션 뒤 한 번만 카드를 실행한다", () => {
  const ui = renderHandWith(["fire"], { enemies: 2, energy: 3 });
  const target = enemyCenter(ui, "enemy-1");
  ui.pointerDown(0, { pointerId: 7 });
  ui.pointerMove(target);
  ui.pointerUp(target);

  assert.equal(ui.energy, 3);
  assert.equal(ui.dragPhase, "flying");
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls.length, 1);
  assert.equal(ui.playCalls[0].target.id, "enemy-1");
  assert.equal(ui.energy, 2);
});

test("잘못된 드롭은 손패와 에너지를 보존한다", () => {
  const ui = renderHandWith(["repair"], { energy: 3 });
  ui.dragTo(enemyCenter(ui, "enemy-0"));

  assert.equal(ui.energy, 3);
  assert.deepEqual(ui.handCardIds, ["repair"]);
  assert.equal(ui.dragPhase, "returning");
  assert.equal(ui.playCalls.length, 0);
});

test("유효 대상을 지난 뒤 캔버스 밖에서 놓으면 최종 좌표를 다시 검사해 복귀한다", () => {
  const ui = renderHandWith(["fire"], { energy: 3 });
  ui.pointerDown(0);
  ui.pointerMove(enemyCenter(ui, "enemy-0"));
  ui.pointerUp({ x: -40, y: -40 });

  assert.equal(ui.dragPhase, "returning");
  assert.equal(ui.energy, 3);
  assert.deepEqual(ui.handCardIds, ["fire"]);
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls.length, 0);
});

test("함대 카드는 개별 적 영역 위에서도 allEnemies 대상으로 해석한다", () => {
  const ui = renderHandWith(["barrage_fire"], { enemies: 2, energy: 3 });
  ui.dragTo(enemyCenter(ui, "enemy-1"));
  ui.finishAnimationTwice();

  assert.equal(ui.playCalls.length, 1);
  assert.equal(ui.playCalls[0].target.type, "allEnemies");
});

test("손패와 전투 자원은 의미 있는 버튼과 비활성 이유로 렌더링된다", () => {
  const ui = renderHandWith(["fire"], { energy: 0 });
  const card = ui.actionDock.querySelector(".combat-card");

  assert.equal(card.tagName, "BUTTON");
  assert.equal(card.disabled, true);
  assert.match(card.querySelector(".combat-card-name").textContent, /선체 포격/);
  assert.match(card.querySelector(".combat-card-description").textContent, /명중 76%.*선체 6~10/);
  assert.match(ui.actionDock.querySelector(".combat-disabled-reason").textContent, /에너지/);
  assert.equal(ui.actionDock.querySelectorAll(".pile-button").length, 3);
  assert.equal(ui.actionDock.querySelector(".captain-skill-button").tagName, "BUTTON");
  assert.equal(ui.actionDock.querySelector(".end-turn-button").tagName, "BUTTON");
});

test("카드 설명은 현재 전투 수치로 계산되고 내부 함수명이나 기존 효과 문구를 노출하지 않는다", () => {
  const ui = renderHandWith(["fire", "aimed_fire", "chain", "approach", "repair", "board"], { energy: 9 });
  const descriptions = ui.actionDock.querySelectorAll(".combat-card-description").map((element) => element.textContent);

  assert.equal(descriptions[0], "명중 76% · 선체 6~10 피해 · 선원 1 피해 25%");
  assert.equal(descriptions[1], "명중 96% · 선체 12~16 피해");
  assert.equal(descriptions[2], "명중 66% · 돛 5~8 피해");
  assert.equal(descriptions[3], "성공 80% · 대상과 거리 -1 · 성공 시 이번 적 턴 적 명중률 -8%p");
  assert.equal(descriptions[4], "수리도구 1개 · 선체 7 · 돛 3 회복");
  assert.equal(descriptions[5], "거리 1·적 돛 55% 이하 · 나포 20%");
  descriptions.forEach((description) => assert.doesNotMatch(description, /기존|cannonDamage|get[A-Z]/));

  const captainUi = renderHandWith(["gunner_magazine_open"], { captainId: "gunner", energy: 3 });
  assert.equal(
    captainUi.actionDock.querySelector(".combat-card-description").textContent,
    "명중 보장 · 선체 24 피해 · 자신의 선체 6 피해",
  );
});

test("카드로 포커스 적을 격파하면 다음 생존 적으로 포커스를 옮긴 뒤 기술 버튼을 렌더링한다", () => {
  const ui = renderHandWith(["mystic_cursed_tide"], { captainId: "mystic", enemies: 2, energy: 3 });
  read(ui.context, "findEnemy('enemy-0').hull = 4");
  ui.key("1");
  ui.key("Enter");
  ui.finishAnimationTwice();

  assert.equal(read(ui.context, "run.combat.focusedEnemyId"), "enemy-1");
  assert.equal(ui.actionDock.querySelector(".captain-skill-button").disabled, false);
});

test("숫자 선택, 대상 순환, Enter 확인은 생산 키보드 핸들러를 사용한다", () => {
  const ui = renderHandWith(["fire"], { enemies: 2 });
  ui.key("1");
  assert.equal(ui.selectedTarget.id, "enemy-0");
  ui.key("ArrowRight");
  assert.equal(ui.selectedTarget.id, "enemy-1");
  ui.key("Enter");
  assert.equal(ui.dragPhase, "flying");
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls[0].target.id, "enemy-1");
});

test("Tab은 대상을 순환하고 Escape는 선택을 실행 없이 취소한다", () => {
  const ui = renderHandWith(["fire"], { enemies: 2 });
  ui.key("1");
  const tabEvent = ui.key("Tab");
  assert.equal(tabEvent.defaultPrevented, true);
  assert.equal(ui.selectedTarget.id, "enemy-1");
  ui.key("Escape");
  assert.equal(ui.selectedTarget, null);
  assert.equal(ui.playCalls.length, 0);
  assert.deepEqual(ui.handCardIds, ["fire"]);
});

test("pointercancel은 드래그를 복귀시키고 stale animation 콜백을 무효화한다", () => {
  const ui = renderHandWith(["fire"]);
  ui.pointerDown(0);
  ui.pointerMove(enemyCenter(ui, "enemy-0"));
  ui.pointerCancel();

  assert.equal(ui.dragPhase, "returning");
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls.length, 0);
  assert.equal(ui.energy, 3);
});

test("비행 단계에 들어간 뒤 취소해도 stale 비행 콜백은 카드를 실행하지 않는다", () => {
  const ui = renderHandWith(["fire"]);
  ui.dragTo(enemyCenter(ui, "enemy-0"));
  assert.equal(ui.dragPhase, "flying");
  ui.key("Escape");
  assert.equal(ui.dragPhase, "returning");
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls.length, 0);
  assert.equal(ui.energy, 3);
});

test("포인터 종료와 Escape 취소는 aria-grabbed 상태를 즉시 제거한다", () => {
  const valid = renderHandWith(["fire"]);
  valid.pointerDown(0);
  assert.equal(valid.actionDock.querySelector(".combat-card").getAttribute("aria-grabbed"), "true");
  valid.pointerUp(enemyCenter(valid, "enemy-0"));
  assert.equal(valid.actionDock.querySelector(".combat-card").getAttribute("aria-grabbed"), null);

  const invalid = renderHandWith(["repair"]);
  invalid.pointerDown(0);
  invalid.pointerUp(enemyCenter(invalid, "enemy-0"));
  assert.equal(invalid.actionDock.querySelector(".combat-card").getAttribute("aria-grabbed"), null);

  const cancelled = renderHandWith(["fire"]);
  cancelled.pointerDown(0);
  cancelled.pointerCancel();
  assert.equal(cancelled.actionDock.querySelector(".combat-card").getAttribute("aria-grabbed"), null);

  const escaped = renderHandWith(["fire"]);
  escaped.pointerDown(0);
  escaped.key("Escape");
  assert.equal(escaped.actionDock.querySelector(".combat-card").getAttribute("aria-grabbed"), null);
});

test("HUD 접근성 이름은 현재 자원 값을 포함하고 선원 설명을 분리한다", () => {
  const ui = renderHandWith(["fire"]);
  read(ui.context, `
    run.hull = 37;
    run.maxHull = 50;
    run.sails = 11;
    run.maxSails = 24;
    run.morale = 63;
    run.food = 7;
    run.water = 9;
    run.gold = 18;
    run.crew = [{
      id: "crew-a", name: "민서", mark: "M", power: 4, role: "포수", roleId: "gunner",
      rarityId: "rare", trait: { id: "stoic", name: "무감한", effect: "식량·식수 고갈로 인한 사기 피해 없음" },
    }];
    updateHud();
  `);

  const tooltipFor = (selector) => ui.element(selector).closest(".game-tooltip");
  assert.equal(tooltipFor("#hullLabel").getAttribute("aria-label"), "선체 37 / 50");
  assert.equal(tooltipFor("#moraleLabel").getAttribute("aria-label"), "사기 63 / 100");
  assert.equal(tooltipFor("#foodLabel").getAttribute("aria-label"), "식량 7");
  assert.equal(tooltipFor("#waterLabel").getAttribute("aria-label"), "식수 9");
  assert.equal(tooltipFor("#cannonLabel").getAttribute("aria-label"), "화력 8");

  const crew = ui.element("#crewList").querySelector(".crew-member");
  assert.equal(crew.getAttribute("aria-label"), "민서 · 포수 · 레어 · 개인 전투력 4");
  assert.match(crew.getAttribute("aria-description"), /역할 효과: 포격·사슬탄 피해 \+2/);
  assert.match(crew.getAttribute("aria-description"), /특성 효과: 식량·식수 고갈로 인한 사기 피해 없음/);
});

test("전투 잠금은 진행 중인 드래그를 취소하고 카드와 턴 행동을 비활성화한다", () => {
  const ui = renderHandWith(["fire"]);
  ui.pointerDown(0);
  read(ui.context, "run.combat.locked = true");
  ui.pointerMove(enemyCenter(ui, "enemy-0"));
  assert.equal(ui.dragPhase, "returning");
  assert.equal(ui.playCalls.length, 0);

  read(ui.context, "renderCombatHand()");
  assert.equal(ui.actionDock.querySelector(".combat-card").disabled, true);
  assert.equal(ui.actionDock.querySelector(".end-turn-button").disabled, true);
  assert.match(ui.actionDock.querySelector(".combat-disabled-reason").textContent, /기다려야/);
});

test("Q와 선장 기술 버튼은 적 대상을 고른 뒤 기술을 한 번 사용한다", () => {
  const keyboardUi = renderHandWith(["fire"], { enemies: 2 });
  keyboardUi.key("Q");
  assert.equal(keyboardUi.selectedTarget.id, "enemy-0");
  keyboardUi.key("ArrowRight");
  assert.equal(keyboardUi.selectedTarget.id, "enemy-1");
  keyboardUi.key("Enter");
  assert.equal(read(keyboardUi.context, "run.combat.skillReady"), false);
  assert.equal(read(keyboardUi.context, "findEnemy('enemy-0').hull"), 100);
  assert.equal(read(keyboardUi.context, "findEnemy('enemy-1').hull < 100"), true);
  keyboardUi.key("Q");
  assert.equal(keyboardUi.selectedTarget, null);

  const pointerUi = renderHandWith(["fire"], { enemies: 2 });
  pointerUi.actionDock.querySelector(".captain-skill-button").click();
  assert.equal(pointerUi.actionDock.querySelectorAll(".combat-target-button").length, 2);
  pointerUi.actionDock.querySelectorAll(".combat-target-button")[1].click();
  assert.equal(read(pointerUi.context, "run.combat.skillReady"), false);
  assert.equal(read(pointerUi.context, "findEnemy('enemy-1').hull < 100"), true);
});

test("E와 턴 종료 버튼은 손패를 버리고 전투를 잠근다", () => {
  const keyboardUi = renderHandWith(["fire", "chain"]);
  keyboardUi.key("E");
  assert.equal(read(keyboardUi.context, "run.combat.locked"), true);
  assert.deepEqual(keyboardUi.handCardIds, []);
  assert.equal(read(keyboardUi.context, "run.combat.cardState.discardPile.length"), 2);

  const pointerUi = renderHandWith(["fire"]);
  pointerUi.actionDock.querySelector(".end-turn-button").click();
  assert.equal(read(pointerUi.context, "run.combat.locked"), true);
});

for (const entry of [
  { cardId: "repair", targetType: "self", targetId: "self" },
  { cardId: "retreat", targetType: "sea", targetId: "sea" },
  { cardId: "barrage_fire", targetType: "allEnemies", targetId: "allEnemies" },
]) {
  test(`${entry.targetType} 대상 카드는 키보드와 포인터 선택 UI에서 실행된다`, () => {
    const ui = renderHandWith([entry.cardId], { enemies: 2, energy: 3 });
    ui.actionDock.querySelector(".combat-card").click();
    assert.equal(ui.selectedTarget.type, entry.targetType);
    const choice = ui.actionDock.querySelector(".combat-target-button");
    assert.equal(choice.dataset.targetValid, "true");
    choice.click();
    ui.finishAnimationTwice();
    assert.equal(ui.playCalls[0].target.id, entry.targetId);
  });
}

test("완전 재배치는 거리 1과 3을 선택 가능한 대상으로 노출한다", () => {
  const ui = renderHandWith(["navigator_reposition"], { captainId: "navigator", energy: 3 });
  ui.key("1");
  assert.equal(ui.selectedTarget.range, 1);
  assert.equal(ui.actionDock.querySelectorAll(".combat-target-button").length, 2);
  ui.key("ArrowDown");
  assert.equal(ui.selectedTarget.range, 3);
  ui.key("Enter");
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls[0].target.range, 3);
});

for (const range of [1, 3]) {
  test(`완전 재배치는 포인터로 거리 ${range} 해역에 드롭할 수 있다`, () => {
    const ui = renderHandWith(["navigator_reposition"], { captainId: "navigator", energy: 3 });
    ui.dragTo(seaCenter(ui, range));
    ui.finishAnimationTwice();
    assert.equal(ui.playCalls.length, 1);
    assert.equal(ui.playCalls[0].target.range, range);
  });
}

test("알 수 없는 카드 인스턴스는 손패 렌더링에서 건너뛴다", () => {
  const ui = renderHandWith(["fire"]);
  read(ui.context, `
    run.combat.cardState.hand.push({ instanceId: "broken-card", cardId: "missing_card", costDelta: 0 });
    renderCombatHand();
  `);
  assert.equal(ui.actionDock.querySelectorAll(".combat-card").length, 1);
  assert.equal(ui.actionDock.querySelector(".combat-card-name").textContent, "선체 포격");
});

test("reduced motion에서는 전투 dock 클래스를 선택하고 0ms 뒤 실행한다", () => {
  const ui = renderHandWith(["fire"], { reducedMotion: true });
  assert.equal(ui.actionDock.classList.contains("is-reduced-motion"), true);
  ui.key("1");
  ui.key("Enter");
  assert.equal(ui.dragPhase, "flying");
  ui.flushTimers(0);
  assert.equal(ui.playCalls.length, 1);
});

