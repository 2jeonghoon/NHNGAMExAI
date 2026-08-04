"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  act: document.querySelector("#actLabel"),
  infamy: document.querySelector("#infamyLabel"),
  legacy: document.querySelector("#legacyLabel"),
  shipName: document.querySelector("#shipNameLabel"),
  captainBadge: document.querySelector("#captainBadge"),
  hull: document.querySelector("#hullLabel"),
  hullMeter: document.querySelector("#hullMeter"),
  sails: document.querySelector("#sailsLabel"),
  sailsMeter: document.querySelector("#sailsMeter"),
  morale: document.querySelector("#moraleLabel"),
  moraleMeter: document.querySelector("#moraleMeter"),
  food: document.querySelector("#foodLabel"),
  water: document.querySelector("#waterLabel"),
  gold: document.querySelector("#goldLabel"),
  cannons: document.querySelector("#cannonLabel"),
  crewPower: document.querySelector("#crewPowerLabel"),
  crewList: document.querySelector("#crewList"),
  artifactList: document.querySelector("#artifactList"),
  artifactCount: document.querySelector("#artifactCount"),
  eventLog: document.querySelector("#eventLog"),
  actionDock: document.querySelector("#actionDock"),
  modalLayer: document.querySelector("#modalLayer"),
  modalPanel: document.querySelector("#modalPanel"),
  soundButton: document.querySelector("#soundButton"),
  statsButton: document.querySelector("#statsButton"),
  newVoyageButton: document.querySelector("#newVoyageButton"),
};

const PLAYER_SHIP_IMAGES = {
  gunner: "./src/assets/ships/player/ship-player-isabella-black-barrel.png",
  navigator: "./src/assets/ships/player/ship-player-raul-storm-eye.png",
  mystic: "./src/assets/ships/player/ship-player-mara-belladonna.png",
  revenant: "./src/assets/ships/player/ship-player-secret-pirate-king.png",
};

const ENEMY_SHIP_IMAGES = {
  "소금칼 밀수선": "./src/assets/ships/enemies/act1/ship-enemy-act1-salt-knife.png",
  "검은 이빨 해적선": "./src/assets/ships/enemies/act1/ship-enemy-act1-black-tooth.png",
  "현상금 사냥꾼 마고": "./src/assets/ships/enemies/act1/ship-enemy-act1-bounty-hunter.png",
  "난파선 약탈자": "./src/assets/ships/enemies/act1/ship-enemy-act1-wreck-raider.png",
  "왕실 추격함": "./src/assets/ships/enemies/act2/ship-enemy-act2-royal-interceptor.png",
  "왕실 초계함": "./src/assets/ships/enemies/act2/ship-enemy-act2-royal-patrol.png",
  "벼락 포격선": "./src/assets/ships/enemies/act2/ship-enemy-act2-thunder-artillery.png",
  "폭풍 약탈선": "./src/assets/ships/enemies/act2/ship-enemy-act2-storm-raider.png",
  "망령 해적선": "./src/assets/ships/enemies/act3/ship-enemy-act3-ghost-pirate.png",
  "뼈돛 추격선": "./src/assets/ships/enemies/act3/ship-enemy-act3-bone-sail.png",
  "심연 포격선": "./src/assets/ships/enemies/act3/ship-enemy-act3-abyss-artillery.png",
  "침묵의 접안선": "./src/assets/ships/enemies/act3/ship-enemy-act3-silent-boarder.png",
};

const STANDARD_BOSS_SHIP_IMAGES = [
  "./src/assets/ships/bosses/standard/ship-boss-act1-red-coral.png",
  "./src/assets/ships/bosses/standard/ship-boss-act2-royal-tempest.png",
  "./src/assets/ships/bosses/standard/ship-boss-act3-graveyard-guardian.png",
];

const HARD_FINAL_BOSS_SHIP_IMAGES = [
  "./src/assets/ships/bosses/hard/ship-boss-hard-storm-dreadnought.png",
  "./src/assets/ships/bosses/hard/ship-boss-hard-storm-dreadnought-phase2.png",
  "./src/assets/ships/bosses/hard/ship-boss-hard-storm-dreadnought-phase3.png",
];

const EXTREME_FINAL_BOSS_SHIP_IMAGES = [
  "./src/assets/ships/bosses/extreme/ship-boss-extreme-abyss-pirate-king.png",
  "./src/assets/ships/bosses/extreme/ship-boss-extreme-abyss-pirate-king-phase2.png",
  "./src/assets/ships/bosses/extreme/ship-boss-extreme-abyss-pirate-king-phase3.png",
];

const shipImageCache = new Map();

function getShipImage(path) {
  if (!path) return null;
  if (!shipImageCache.has(path)) {
    const image = new Image();
    image.decoding = "async";
    image.src = path;
    shipImageCache.set(path, image);
  }
  const image = shipImageCache.get(path);
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function bossShipImagePaths(mapId, actIndex) {
  if (mapId === "storm" && actIndex === 2) return HARD_FINAL_BOSS_SHIP_IMAGES;
  if (mapId === "abyss" && actIndex === 2) return EXTREME_FINAL_BOSS_SHIP_IMAGES;
  return [STANDARD_BOSS_SHIP_IMAGES[actIndex]];
}

const MAPS = [
  {
    id: "calm",
    name: "잔잔한 무역풍 항로",
    subtitle: "첫 출항에 어울리는 표준 항로입니다.",
    difficulty: "표준",
    enemyMultiplier: 1,
    rewardMultiplier: 1,
    unlock: null,
    acts: [
      {
        name: "Act 1 · 평온한 시작의 바다",
        short: "시작의 바다",
        subtitle: "상선의 등불 사이로 무법자들의 깃발이 떠오른다.",
        boss: "붉은 산호 해적단",
        sky: "#9ec4c0",
        sea: "#176071",
        deep: "#0b3f51",
        foam: "#b8d9d2",
        accent: "#e0ae4b",
      },
      {
        name: "Act 2 · 폭풍우의 중심",
        short: "폭풍우의 중심",
        subtitle: "왕실 함대와 벼락이 같은 수평선을 가른다.",
        boss: "왕실 철갑함 리바이어던",
        sky: "#697d83",
        sea: "#184451",
        deep: "#0b2b36",
        foam: "#9bb6b7",
        accent: "#d98b58",
      },
      {
        name: "Act 3 · 신들의 무덤",
        short: "신들의 무덤",
        subtitle: "지도 끝, 가라앉은 왕국 위에서 마지막 괴수가 기다린다.",
        boss: "심해의 왕 크라켄",
        sky: "#342f49",
        sea: "#193f4c",
        deep: "#101c2a",
        foam: "#8da8a0",
        accent: "#c77262",
      },
    ],
  },
  {
    id: "storm",
    name: "폭풍의 사각지대 항로",
    subtitle: "첫 항해를 마친 자만이 들어설 수 있는 거친 뱃길입니다.",
    difficulty: "험로",
    enemyMultiplier: 1.3,
    rewardMultiplier: 1.2,
    unlock: { type: "mapVictory", mapId: "calm", hint: "잔잔한 무역풍 항로를 완주하면 해금됩니다." },
    acts: [
      {
        name: "Act 1 · 불타는 함대",
        short: "불타는 함대",
        subtitle: "가라앉은 함선 사이로 화공선의 붉은 돛이 정찰을 돈다.",
        boss: "불타는 백작 함대",
        sky: "#6b4a42",
        sea: "#4a1f16",
        deep: "#20100c",
        foam: "#d9a98a",
        accent: "#e2703d",
      },
      {
        name: "Act 2 · 칼날 산호초",
        short: "칼날 산호초",
        subtitle: "날카로운 산호 사이로 여왕의 함대가 매복한다.",
        boss: "산호 여왕 메두사",
        sky: "#3c5a55",
        sea: "#0d3f3a",
        deep: "#081f1c",
        foam: "#8fc9b8",
        accent: "#3fae86",
      },
      {
        name: "Act 3 · 천 파도의 무덤",
        short: "천 파도의 무덤",
        subtitle: "천 번의 폭풍이 겹겹이 가라앉은 뱃사람들의 무덤.",
        boss: "천 파도의 지배자",
        sky: "#414463",
        sea: "#1c2050",
        deep: "#0d0f2c",
        foam: "#9aa0d9",
        accent: "#7161c9",
      },
    ],
  },
  {
    id: "abyss",
    name: "심연의 마지막 항로",
    subtitle: "폭풍의 뱃길조차 정복한 전설에게만 열리는 항로입니다.",
    difficulty: "극한",
    enemyMultiplier: 1.65,
    rewardMultiplier: 1.4,
    unlock: { type: "mapVictory", mapId: "storm", hint: "폭풍의 사각지대 항로를 완주하면 해금됩니다." },
    acts: [
      {
        name: "Act 1 · 잊혀진 해도",
        short: "잊혀진 해도",
        subtitle: "지도에 없는 바다 위, 이름 없는 감시자의 그림자가 드리운다.",
        boss: "이름 없는 감시자",
        sky: "#332f3d",
        sea: "#1a1626",
        deep: "#0a0812",
        foam: "#8f84a8",
        accent: "#8a5fc9",
      },
      {
        name: "Act 2 · 가라앉은 대성당",
        short: "가라앉은 대성당",
        subtitle: "무너진 첨탑 사이로 대주교의 성가가 물결친다.",
        boss: "심연의 대주교",
        sky: "#3a2c33",
        sea: "#28121c",
        deep: "#120810",
        foam: "#c98fa0",
        accent: "#c94f6c",
      },
      {
        name: "Act 3 · 별이 잠든 바다",
        short: "별이 잠든 바다",
        subtitle: "빛조차 가라앉은 심해 밑바닥, 태초의 존재가 눈을 뜬다.",
        boss: "태초의 크라켄 군주",
        sky: "#1e2233",
        sea: "#0a0e24",
        deep: "#040611",
        foam: "#7d8fc9",
        accent: "#4f6ec9",
      },
    ],
  },
];

let ACTS = MAPS[0].acts;

function isMapUnlocked(mapDef) {
  if (!mapDef.unlock) return true;
  if (mapDef.unlock.type === "mapVictory") return meta.clearedMapIds.includes(mapDef.unlock.mapId);
  return true;
}

function mapName(id) {
  return MAPS.find((item) => item.id === id)?.name || id;
}

const CAPTAINS = [
  {
    id: "gunner",
    name: "이사벨라 블랙배럴",
    title: "화약 냄새를 좇는 포격선장",
    ship: "복수의 화약고",
    description: "화력 +2. 전투마다 한 번, 명중이 보장되는 전탄 일제사격을 사용합니다.",
    skill: "전탄 일제사격",
    hull: 2,
    sails: 0,
    morale: 0,
    supplies: 0,
    cannons: 2,
    crew: "gunner",
    portrait: "#d2a06a",
    coat: "#a14135",
  },
  {
    id: "navigator",
    name: "라울 스톰아이",
    title: "바람의 결을 읽는 조타수",
    ship: "은빛 알바트로스",
    description: "돛 +4, 보급품 +3. 전투마다 한 번, 완전 회피와 재배치를 수행합니다.",
    skill: "폭풍 가르기",
    hull: 0,
    sails: 4,
    morale: 0,
    supplies: 3,
    cannons: 0,
    crew: "rigger",
    portrait: "#a87952",
    coat: "#2d6c79",
  },
  {
    id: "mystic",
    name: "마라 벨라돈나",
    title: "심해와 거래한 주술선장",
    ship: "검은 세이렌",
    description: "사기 +12. 전투마다 한 번, 적 선체·돛·선원을 동시에 약화합니다.",
    skill: "심해의 속삭임",
    hull: 0,
    sails: 0,
    morale: 12,
    supplies: 0,
    cannons: 0,
    crew: "cook",
    portrait: "#a87565",
    coat: "#644b78",
  },
  {
    id: "revenant",
    name: "빅토르 나이트폴",
    title: "죽음을 두 번 속인 유령선장",
    ship: "잊혀진 심연호",
    description: "선체 +3, 사기 +4. 구사일생이 항해당 두 번으로 늘어납니다. 전투마다 한 번, 적을 타격하며 선체를 되돌리는 진혼곡을 부릅니다.",
    skill: "저승의 진혼곡",
    hull: 3,
    sails: 0,
    morale: 4,
    supplies: 1,
    cannons: 0,
    crew: "carpenter",
    portrait: "#8d7c96",
    coat: "#3a2f45",
    safetyNetCharges: 2,
    unlock: { type: "victory", count: 1, hint: "해적왕의 유산을 완성하면 해금됩니다." },
  },
];

function isCaptainUnlocked(captainDef) {
  if (!captainDef.unlock) return true;
  if (captainDef.unlock.type === "victory") return meta.victories >= captainDef.unlock.count;
  return true;
}

const RARITIES = {
  normal: { name: "노말", chance: 0.55, powerBonus: 0, crewTier: 0, color: "#aeb9b6" },
  rare: { name: "레어", chance: 0.28, powerBonus: 1, crewTier: 1, color: "#54a9c2" },
  epic: { name: "에픽", chance: 0.13, powerBonus: 2, crewTier: 2, color: "#b982d9" },
  legendary: { name: "레전드", chance: 0.04, powerBonus: 4, crewTier: 3, color: "#ffd36f" },
};

const CREW_ROLES = {
  gunner: { label: "포수", mark: "포", power: 3, effect: "포격 피해 +1" },
  rigger: { label: "조타수", mark: "타", power: 2, effect: "기동 성공률 +10%" },
  carpenter: { label: "수리공", mark: "수", power: 2, effect: "응급수리 +3" },
  cook: { label: "요리사", mark: "요", power: 1, effect: "이동 보급 소모 -1" },
  marine: { label: "갑판전사", mark: "전", power: 4, effect: "접안 전투력 +4" },
  lookout: { label: "감시원", mark: "감", power: 2, effect: "적 명중률 -5%" },
  quartermaster: { label: "보급관", mark: "보", power: 2, effect: "항구 구매 비용 -1 금화" },
  surgeon: { label: "군의관", mark: "의", power: 2, effect: "전투 승리 시 사기 +3" },
  boatswain: { label: "갑판장", mark: "갑", power: 2, effect: "전투 에너지 지원" },
};

const CREW_NAMES = [
  "애꾸눈 모건",
  "붉은 수염 앤",
  "도끼손 잭",
  "썰물의 니아",
  "북극성 톰",
  "무쇠턱 로사",
  "까마귀 핀",
  "조용한 벤",
  "파도칼 미라",
  "노을빛 산초",
];

const TRAITS = [
  { id: "steady", name: "굳센", effect: "전투 승리 시 사기 +2" },
  { id: "drunk", name: "주당", effect: "주점 효율 +5, 식량 소모 +1" },
  { id: "lucky", name: "행운아", effect: "금화 획득 +10%" },
  { id: "scarred", name: "상처투성이", effect: "접안 전투력 +2" },
  { id: "brave", name: "용맹한", effect: "접안 공격 승률 +8%" },
  { id: "eagleEyed", name: "매의 눈", effect: "포격·사슬탄 명중률 +5%" },
  { id: "superstitious", name: "미신을 믿는", effect: "유물 획득 시 사기 +3" },
  { id: "stoic", name: "무감한", effect: "식량·식수 고갈로 인한 사기 피해 없음" },
  { id: "frugal", name: "절약가", effect: "매 전투 첫 카드 비용 -1" },
  { id: "rallying", name: "분발", effect: "매 전투 한 번 에너지가 0이 되면 에너지 +1" },
];

const ARTIFACTS = [
  { id: "sextant", rarity: "normal", name: "황동 육분의", description: "포격 명중률 +10%" },
  { id: "figurehead", rarity: "normal", name: "노래하는 선수상", description: "항해할 때 사기 +1" },
  { id: "storm", rarity: "normal", name: "병 속의 폭풍", description: "역풍 명중 페널티 무효" },
  { id: "grog", rarity: "normal", name: "썩지 않는 건빵", description: "이동 시 식량 소모 -1" },
  { id: "sailcloth", rarity: "normal", name: "여분의 돛감", description: "최대 돛 +6" },
  { id: "map", rarity: "rare", name: "도금된 보물지도", description: "금화 획득 +30%" },
  { id: "plating", rarity: "rare", name: "심해 강철판", description: "최대 선체 +8" },
  { id: "chainLocker", rarity: "rare", name: "여분의 사슬탄 통", description: "사슬탄 피해 +4" },
  { id: "spyglass", rarity: "rare", name: "정찰용 야시경", description: "매 전투 첫 사격은 명중이 보장됨" },
  { id: "anchor", rarity: "rare", name: "닻줄 부적", description: "회피 기동 성공 시 사기 +2" },
  { id: "kraken", rarity: "epic", name: "크라켄의 이빨", description: "접안 전투력 +5" },
  { id: "rum", rarity: "epic", name: "끝없는 럼주통", description: "전투 승리 시 사기 +4" },
  { id: "ghostSail", rarity: "epic", name: "유령의 돛", description: "접근 기동이 항상 성공함" },
  { id: "cursedCompass", rarity: "epic", name: "저주받은 나침반", description: "미지의 조우에서 위험 판정 성공률 대폭 상승" },
  { id: "phantomCrew", rarity: "epic", name: "유령 선원의 초상", description: "접안 공격 실패 시 선원을 잃지 않음" },
  { id: "powder", rarity: "legendary", name: "왕실 흑색화약", description: "포격 피해 +3" },
  { id: "kingsRansom", rarity: "legendary", name: "폐위된 국왕의 몸값", description: "전투 승리 보상 금화·악명 +50%" },
  { id: "leviathan", rarity: "legendary", name: "리바이어던의 심장", description: "최대 선체 +15, 전투 시작 시 선체 5 회복" },
  { id: "navigatorHourglass", rarity: "normal", name: "항해사의 모래시계", description: "매 전투 첫 턴 에너지 +1" },
  { id: "brassCapacitor", rarity: "rare", name: "황동 축전기", description: "세 번째 플레이어 턴마다 에너지 +1" },
  { id: "smugglerPulley", rarity: "epic", name: "밀수업자의 도르래", description: "매 턴 첫 비용 0 카드 사용 시 에너지 +1" },
  { id: "tyrantFleetSeal", rarity: "legendary", name: "폭군의 함대 인장", description: "최대 에너지 +1, 매 턴 드로우 4장" },
];

const NODE_TYPES = {
  battle: { name: "교전", mark: "전", description: "해적 또는 밀수선", color: "#c46a51" },
  elite: { name: "정예", mark: "정", description: "강력한 적 · 유물 확정", color: "#dfb14f" },
  event: { name: "미지의 조우", mark: "?", description: "선택이 운명을 바꾼다", color: "#7ca3a5" },
  port: { name: "항구", mark: "항", description: "보급 · 수리 · 고용", color: "#62a979" },
  treasure: { name: "숨겨진 보물", mark: "$", description: "유물 또는 함정", color: "#ddc168" },
  boss: { name: "해역 지배자", mark: "왕", description: "다음 바다로 가는 길", color: "#bd4d4b" },
  start: { name: "출항지", mark: "출", description: "현재 항로", color: "#d8ddd5" },
};

const LEGACY_UPGRADES = [
  { id: "hull", name: "강화 용골", description: "항해 시작 시 최대 선체 +4", costs: [18, 38, 64] },
  { id: "supplies", name: "밀수업자 연줄", description: "항해 시작 시 식량·식수 +2", costs: [16, 34, 58] },
  { id: "morale", name: "해적왕의 깃발", description: "항해 시작 시 사기 +5", costs: [20, 40, 68] },
];

const STORAGE_KEY = "pirate-king-legacy-meta-v1";
let meta = loadMeta();
let selectedCaptainId = "gunner";
let selectedMapId = "calm";
let run = null;
let muted = false;
let audioContext = null;
let lastFrame = 0;
let visualEffects = [];
let mapClickRipples = [];
let shakeMagnitude = 0;

function loadMeta() {
  const fallback = {
    legacyInfamy: 0,
    bestInfamy: 0,
    victories: 0,
    upgrades: { hull: 0, supplies: 0, morale: 0 },
    clearedMapIds: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;
    return {
      ...fallback,
      ...saved,
      upgrades: { ...fallback.upgrades, ...(saved.upgrades || {}) },
      clearedMapIds: Array.isArray(saved.clearedMapIds) ? saved.clearedMapIds : fallback.clearedMapIds,
    };
  } catch {
    return fallback;
  }
}

function saveMeta() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // The voyage remains playable when browser storage is unavailable.
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedChoice(items, getWeight) {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= getWeight(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function rollRarity(availableItems = null) {
  const rarityIds = Object.keys(RARITIES).filter((rarityId) => (
    !availableItems || availableItems.some((item) => item.rarity === rarityId)
  ));
  return weightedChoice(rarityIds, (rarityId) => RARITIES[rarityId].chance);
}

function rarityOddsText() {
  return Object.values(RARITIES)
    .map((rarity) => `${rarity.name} ${Math.round(rarity.chance * 100)}%`)
    .join(" · ");
}

function drawArtifactChoices(available, count = 3) {
  const pool = [...available];
  const choices = [];
  while (pool.length > 0 && choices.length < count) {
    const rarityId = rollRarity(pool);
    const candidates = pool.filter((artifact) => artifact.rarity === rarityId);
    const artifact = randomChoice(candidates);
    choices.push(artifact);
    pool.splice(pool.findIndex((item) => item.id === artifact.id), 1);
  }
  return choices;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hasBatchim(word) {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return true;
  return code % 28 !== 0;
}

function josa(word, withBatchim, withoutBatchim) {
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

function withJosa(word, withBatchim, withoutBatchim) {
  return `${word}${josa(word, withBatchim, withoutBatchim)}`;
}

function hasNonRieulBatchim(word) {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return true;
  const finalIndex = code % 28;
  return finalIndex !== 0 && finalIndex !== 8;
}

function withRoJosa(word) {
  return `${word}${hasNonRieulBatchim(word) ? "으로" : "로"}`;
}

function numberHasBatchim(value) {
  return [0, 1, 3, 6, 7, 8].includes(Math.abs(Math.trunc(value)) % 10);
}

function withNumberJosa(value, withBatchim, withoutBatchim) {
  return `${value}${numberHasBatchim(value) ? withBatchim : withoutBatchim}`;
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeButton(label, className, onClick, disabled = false) {
  const button = makeElement("button", className, label);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function makeCrew(roleId) {
  const role = CREW_ROLES[roleId];
  const rarityId = rollRarity();
  const rarity = RARITIES[rarityId];
  const member = {
    id: `${Date.now()}-${Math.random()}`,
    name: randomChoice(CREW_NAMES),
    roleId,
    role: role.label,
    mark: role.mark,
    basePower: role.power,
    power: role.power + rarity.powerBonus,
    effect: role.effect,
    trait: randomChoice(TRAITS),
    rarityId,
    rarity: rarity.name,
    rarityBonus: rarity.powerBonus,
    crewTier: rarity.crewTier,
  };
  member.effect = getCrewRoleEffect(member);
  return member;
}

function captain() {
  return CAPTAINS.find((item) => item.id === run?.captainId) || CAPTAINS[0];
}

function hasArtifact(id) {
  return Boolean(run?.artifacts.some((artifact) => artifact.id === id));
}

function crewCount(roleId) {
  return run ? run.crew.filter((member) => member.roleId === roleId).length : 0;
}

function crewTier(member) {
  return (RARITIES[member.rarityId] || RARITIES.normal).crewTier;
}

function getCrewRoleEffect(member) {
  const tier = crewTier(member);
  if (member.roleId === "gunner") return `포격·사슬탄 피해 +${1 + tier}`;
  if (member.roleId === "rigger") return `접근 기동 성공률 +${10 + tier * 5}%`;
  if (member.roleId === "carpenter") return `응급수리 선체 +${3 + tier * 2}`;
  if (member.roleId === "cook") {
    return tier === 0 ? "이동 보급 소모 -1" : `이동 보급 소모 -1 · 사기 +${tier}`;
  }
  if (member.roleId === "marine") return `접안 전투력 +${4 + tier * 2}`;
  if (member.roleId === "lookout") return `적 명중률 -${5 + tier * 3}%`;
  if (member.roleId === "quartermaster") return `항구 구매 비용 -${1 + tier} 금화`;
  if (member.roleId === "surgeon") return `전투 승리 시 사기 +${3 + tier * 2}`;
  if (member.roleId === "boatswain") {
    return [
      "전투 첫 턴 에너지 +1",
      "첫 턴 에너지 +1 · 카드 1장 추가 드로우",
      "첫 번째와 두 번째 턴 에너지 +1",
      "최대 에너지 +1 · 첫 턴 카드 1장 추가 드로우",
    ][tier];
  }
  return CREW_ROLES[member.roleId]?.effect || "";
}

function getBoatswainModifiers() {
  const boatswains = (run?.crew || []).filter((member) => member.roleId === "boatswain");
  const tier = Math.max(-1, ...boatswains.map((member) => RARITIES[member.rarityId]?.crewTier ?? 0));
  if (tier < 0) return { maxEnergy: 0, turnEnergy: {}, openingDraw: 0 };
  return [
    { maxEnergy: 0, turnEnergy: { 1: 1 }, openingDraw: 0 },
    { maxEnergy: 0, turnEnergy: { 1: 1 }, openingDraw: 1 },
    { maxEnergy: 0, turnEnergy: { 1: 1, 2: 1 }, openingDraw: 0 },
    { maxEnergy: 1, turnEnergy: {}, openingDraw: 1 },
  ][tier];
}

function getEnergyModifiers(turn = 1) {
  const boatswain = getBoatswainModifiers();
  const maxEnergy = Math.min(4, 3 + boatswain.maxEnergy + (hasArtifact("tyrantFleetSeal") ? 1 : 0));
  let turnEnergy = boatswain.turnEnergy[turn] || 0;
  if (turn === 1 && hasArtifact("navigatorHourglass")) turnEnergy += 1;
  if (turn % 3 === 0 && hasArtifact("brassCapacitor")) turnEnergy += 1;
  return {
    maxEnergy,
    handSize: hasArtifact("tyrantFleetSeal") ? 4 : 5,
    openingDrawBonus: boatswain.openingDraw,
    turnEnergy,
  };
}

function sumCrewRoleEffect(roleId, valueForMember) {
  if (!run) return 0;
  return run.crew
    .filter((member) => member.roleId === roleId)
    .reduce((sum, member) => sum + valueForMember(member), 0);
}

function getGunnerBonus() {
  return sumCrewRoleEffect("gunner", (member) => 1 + crewTier(member));
}

function getRiggerChanceBonus() {
  return sumCrewRoleEffect("rigger", (member) => 0.1 + crewTier(member) * 0.05);
}

function getCarpenterRepairBonus() {
  return sumCrewRoleEffect("carpenter", (member) => 3 + crewTier(member) * 2);
}

function getCookMoraleBonus() {
  return sumCrewRoleEffect("cook", (member) => crewTier(member));
}

function getMarineBoardingBonus() {
  return sumCrewRoleEffect("marine", (member) => 4 + crewTier(member) * 2);
}

function getLookoutEvasionBonus() {
  return sumCrewRoleEffect("lookout", (member) => 0.05 + crewTier(member) * 0.03);
}

function getQuartermasterDiscount() {
  return sumCrewRoleEffect("quartermaster", (member) => 1 + crewTier(member));
}

function getSurgeonMoraleBonus() {
  return sumCrewRoleEffect("surgeon", (member) => 3 + crewTier(member) * 2);
}

function hasTrait(id) {
  return Boolean(run?.crew.some((member) => member.trait.id === id));
}

function getCrewPower() {
  if (!run) return 0;
  let total = 8 + run.crew.reduce((sum, member) => sum + member.power, 0);
  total += run.combat?.boardingPowerBonus || 0;
  total += getMarineBoardingBonus();
  total += run.crew.filter((member) => member.trait.id === "scarred").length * 2;
  if (hasArtifact("kraken")) total += 5;
  return total;
}

function getCannonPower() {
  if (!run) return 0;
  return run.cannons + getGunnerBonus();
}

function getSupplyCost() {
  if (!run) return 0;
  let cost = 2;
  if (captain().id === "navigator") cost -= 1;
  if (crewCount("cook") > 0) cost -= 1;
  return Math.max(1, cost);
}

function getFoodTravelCost() {
  if (!run) return 0;
  let cost = getSupplyCost() + (hasTrait("drunk") ? 1 : 0);
  if (hasArtifact("grog")) cost -= 1;
  return Math.max(1, cost);
}

function adjustedGold(amount) {
  let multiplier = 1;
  if (hasArtifact("map")) multiplier += 0.3;
  if (hasTrait("lucky")) multiplier += 0.1;
  return Math.round(amount * multiplier);
}

function logEvent(message) {
  if (!run) return;
  run.logs.unshift(message);
  run.logs = run.logs.slice(0, 8);
  updateHud();
}

function playTone(frequency, duration = 0.08, type = "square", volume = 0.035) {
  if (muted) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    muted = true;
    ui.soundButton.classList.add("is-muted");
  }
}

function updateHud() {
  ui.legacy.textContent = meta.legacyInfamy;

  if (!run) {
    ui.act.textContent = "출항 준비";
    ui.infamy.textContent = "0";
    ui.shipName.textContent = "무명의 돛단배";
    ui.captainBadge.textContent = "선장 미정";
    [ui.hull, ui.sails, ui.morale].forEach((element) => { element.textContent = "0 / 0"; });
    [ui.hullMeter, ui.sailsMeter, ui.moraleMeter].forEach((element) => { element.style.width = "0%"; });
    [ui.food, ui.water, ui.gold, ui.cannons].forEach((element) => { element.textContent = "0"; });
    ui.crewPower.textContent = "전투력 0";
    ui.artifactCount.textContent = "0 / 6";
    clearElement(ui.crewList);
    clearElement(ui.artifactList);
    clearElement(ui.eventLog);
    ui.crewList.append(makeElement("p", "empty-state", "선장이 첫 선원을 기다립니다."));
    ui.artifactList.append(makeElement("p", "empty-state", "아직 발견한 유물이 없습니다."));
    return;
  }

  const currentCaptain = captain();
  ui.act.textContent = ACTS[run.actIndex].short;
  ui.infamy.textContent = run.infamy;
  ui.shipName.textContent = currentCaptain.ship;
  ui.captainBadge.textContent = currentCaptain.name;
  ui.hull.textContent = `${Math.max(0, run.hull)} / ${run.maxHull}`;
  ui.sails.textContent = `${Math.max(0, run.sails)} / ${run.maxSails}`;
  ui.morale.textContent = `${Math.max(0, run.morale)} / 100`;
  ui.hullMeter.style.width = `${clamp((run.hull / run.maxHull) * 100, 0, 100)}%`;
  ui.sailsMeter.style.width = `${clamp((run.sails / run.maxSails) * 100, 0, 100)}%`;
  ui.moraleMeter.style.width = `${clamp(run.morale, 0, 100)}%`;
  ui.food.textContent = run.food;
  ui.water.textContent = run.water;
  ui.gold.textContent = run.gold;
  ui.cannons.textContent = getCannonPower();
  ui.crewPower.textContent = `전투력 ${getCrewPower()}`;
  ui.artifactCount.textContent = `${run.artifacts.length} / 6`;

  clearElement(ui.crewList);
  run.crew.forEach((member) => {
    const rarity = RARITIES[member.rarityId] || RARITIES.normal;
    const row = makeElement("div", `crew-member game-tooltip rarity-${member.rarityId || "normal"}`);
    row.append(makeElement("div", `crew-avatar crew-avatar--${member.roleId}`, member.mark));
    const copy = makeElement("div", "crew-copy");
    copy.append(makeElement("strong", "", member.name));
    const detail = makeElement("div", "crew-detail");
    detail.append(makeElement("span", "", `${member.role} · ${member.trait.name}`));
    detail.append(makeElement("span", "rarity-badge", rarity.name));
    copy.append(detail);
    copy.append(makeElement("span", "crew-effect", getCrewRoleEffect(member)));
    const actions = makeElement("div", "item-actions");
    actions.append(makeElement("b", "crew-stat", `+${member.power}`));
    const dismiss = makeButton("내보내기", "item-remove-button", () => confirmDismissCrew(member.id), !canManageInventory() || run.crew.length <= 1);
    dismiss.title = run.crew.length <= 1
      ? "마지막 선원은 내보낼 수 없습니다."
      : canManageInventory()
        ? "선원을 내보냅니다."
        : "항로 화면에서만 선원을 내보낼 수 있습니다.";
    actions.append(dismiss);
    row.append(copy, actions);
    const crewTooltip = `${rarity.name} 선원 · 개인 전투력 ${member.power} · 역할 효과: ${getCrewRoleEffect(member)} · 특성 효과: ${member.trait.effect}`;
    row.dataset.tooltip = crewTooltip;
    row.tabIndex = 0;
    row.setAttribute("aria-label", `${member.name}. ${crewTooltip}`);
    ui.crewList.append(row);
  });

  clearElement(ui.artifactList);
  if (run.artifacts.length === 0) {
    ui.artifactList.append(makeElement("p", "empty-state", "항로 어딘가에 유물이 잠들어 있습니다."));
  } else {
    run.artifacts.forEach((artifact) => {
      const rarity = RARITIES[artifact.rarity] || RARITIES.normal;
      const row = makeElement("div", `artifact-row rarity-${artifact.rarity || "normal"}`);
      const token = makeElement("span", "artifact-token", artifact.name);
      token.title = artifact.description;
      const badge = makeElement("span", "rarity-badge", rarity.name);
      const discard = makeButton("버리기", "item-remove-button", () => confirmDiscardArtifact(artifact.id), !canManageInventory());
      discard.title = canManageInventory()
        ? "유물을 버립니다."
        : "항로 화면에서만 유물을 버릴 수 있습니다.";
      row.append(token, badge, discard);
      ui.artifactList.append(row);
    });
  }

  clearElement(ui.eventLog);
  run.logs.forEach((entry) => ui.eventLog.append(makeElement("li", "", entry)));
}

function setModalBase(eyebrow, title, copy, narrow = true) {
  clearElement(ui.modalPanel);
  ui.modalPanel.className = `modal-panel${narrow ? " narrow" : ""}`;
  ui.modalPanel.append(makeElement("p", "eyebrow", eyebrow));
  ui.modalPanel.append(makeElement("h2", "", title));
  if (copy) ui.modalPanel.append(makeElement("p", "modal-copy", copy));
  ui.modalLayer.hidden = false;
}

function closeModal() {
  ui.modalLayer.hidden = true;
}

function canManageInventory() {
  return Boolean(run && run.mode === "map" && ui.modalLayer.hidden);
}

function closeInventoryModal() {
  closeModal();
  updateHud();
  renderActionDock();
}

function confirmDismissCrew(memberId) {
  if (!canManageInventory() || run.crew.length <= 1) return;
  const member = run.crew.find((candidate) => candidate.id === memberId);
  if (!member) return;
  setModalBase("DISMISS CREW", "선원을 내보냅니까?", `${member.rarity} ${member.role} ${withJosa(member.name, "을", "를")} 배에서 내보냅니다. 되돌릴 수 없으며 보상은 없습니다.`);
  updateHud();
  addModalActions([
    { label: "취소", onClick: closeInventoryModal },
    {
      label: "내보내기",
      primary: true,
      onClick: () => {
        if (run.crew.length <= 1) return closeInventoryModal();
        const index = run.crew.findIndex((candidate) => candidate.id === memberId);
        if (index >= 0) {
          const [dismissed] = run.crew.splice(index, 1);
          logEvent(`${withJosa(dismissed.name, "을", "를")} 선원 명부에서 내보냈다.`);
          playTone(130, 0.08, "sine");
        }
        closeInventoryModal();
      },
    },
  ]);
}

function confirmDiscardArtifact(artifactId) {
  if (!canManageInventory()) return;
  const artifact = run.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact) return;
  const rarity = RARITIES[artifact.rarity] || RARITIES.normal;
  setModalBase("DISCARD ARTIFACT", "유물을 버립니까?", `${rarity.name} 유물 ${withJosa(artifact.name, "을", "를")} 버립니다. 효과가 즉시 사라지며 보상은 없습니다.`);
  updateHud();
  addModalActions([
    { label: "취소", onClick: closeInventoryModal },
    {
      label: "버리기",
      primary: true,
      onClick: () => {
        const index = run.artifacts.findIndex((candidate) => candidate.id === artifactId);
        if (index >= 0) {
          const [discarded] = run.artifacts.splice(index, 1);
          if (discarded.id === "plating") {
            run.maxHull = Math.max(1, run.maxHull - 8);
            run.hull = Math.min(run.hull, run.maxHull);
          }
          if (discarded.id === "leviathan") {
            run.maxHull = Math.max(1, run.maxHull - 15);
            run.hull = Math.min(run.hull, run.maxHull);
          }
          if (discarded.id === "sailcloth") {
            run.maxSails = Math.max(1, run.maxSails - 6);
            run.sails = Math.min(run.sails, run.maxSails);
          }
          logEvent(`${withJosa(discarded.name, "을", "를")} 바다에 버렸다.`);
          playTone(130, 0.08, "sine");
        }
        closeInventoryModal();
      },
    },
  ]);
}

function addModalActions(actions) {
  const row = makeElement("div", "modal-actions");
  actions.forEach((action) => {
    row.append(makeButton(action.label, action.primary ? "primary-button" : "secondary-button", action.onClick, action.disabled));
  });
  ui.modalPanel.append(row);
}

function showHarbor() {
  run = null;
  visualEffects = [];
  mapClickRipples = [];
  shakeMagnitude = 0;
  canvas.classList.remove("map-active");
  updateHud();
  clearElement(ui.actionDock);
  setModalBase(
    "A ROGUELIKE VOYAGE",
    "항해의 끝: 해적왕의 유산",
    "단 한 척의 배와 무작위로 모인 선원들로 출항하십시오. 세 개의 해역을 돌파하고 전설의 보물을 차지한 자만이 해적왕의 이름을 얻습니다.",
    false,
  );

  if (!isCaptainUnlocked(CAPTAINS.find((item) => item.id === selectedCaptainId) || CAPTAINS[0])) {
    selectedCaptainId = CAPTAINS.find(isCaptainUnlocked).id;
  }
  if (!isMapUnlocked(MAPS.find((item) => item.id === selectedMapId) || MAPS[0])) {
    selectedMapId = MAPS.find(isMapUnlocked).id;
  }

  const captainGrid = makeElement("div", "captain-grid");
  CAPTAINS.forEach((item) => {
    const unlocked = isCaptainUnlocked(item);
    if (!unlocked) {
      const lockedCard = makeButton("", "captain-card is-locked", () => {}, true);
      const portrait = makeElement("div", "captain-portrait captain-portrait--placeholder");
      portrait.style.setProperty("--portrait", "#4a545a");
      portrait.style.setProperty("--coat", "#2a3236");
      lockedCard.append(
        portrait,
        makeElement("h3", "", "잠긴 선장"),
        makeElement("span", "", "???"),
        makeElement("p", "", item.unlock?.hint || "아직 해금되지 않았습니다."),
      );
      captainGrid.append(lockedCard);
      return;
    }
    const card = makeButton("", `captain-card${selectedCaptainId === item.id ? " is-selected" : ""}`, () => {
      selectedCaptainId = item.id;
      playTone(420, 0.05, "triangle");
      showHarbor();
    });
    const portrait = makeElement("div", `captain-portrait captain-portrait--${item.id}`);
    card.append(portrait, makeElement("h3", "", item.name), makeElement("span", "", item.title), makeElement("p", "", item.description));
    captainGrid.append(card);
  });
  ui.modalPanel.append(captainGrid);
  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const mapHead = makeElement("div", "legacy-head");
  mapHead.append(makeElement("h3", "", "항로 선택"));
  ui.modalPanel.append(mapHead);

  const mapGrid = makeElement("div", "map-grid");
  MAPS.forEach((item) => {
    const unlocked = isMapUnlocked(item);
    if (!unlocked) {
      const lockedCard = makeButton("", "map-card is-locked", () => {}, true);
      lockedCard.append(
        makeElement("h3", "", "잠긴 항로"),
        makeElement("span", "", "???"),
        makeElement("p", "", item.unlock?.hint || "아직 해금되지 않았습니다."),
      );
      mapGrid.append(lockedCard);
      return;
    }
    const card = makeButton("", `map-card${selectedMapId === item.id ? " is-selected" : ""}`, () => {
      selectedMapId = item.id;
      playTone(420, 0.05, "triangle");
      showHarbor();
    });
    card.append(
      makeElement("h3", "", item.name),
      makeElement("span", "", `난이도 · ${item.difficulty}`),
      makeElement("p", "", item.subtitle),
    );
    mapGrid.append(card);
  });
  ui.modalPanel.append(mapGrid);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const legacyHead = makeElement("div", "legacy-head");
  legacyHead.append(makeElement("h3", "", "해적왕의 유산"), makeElement("strong", "", `전승 악명 ${meta.legacyInfamy}`));
  ui.modalPanel.append(legacyHead);

  const legacyGrid = makeElement("div", "legacy-grid");
  LEGACY_UPGRADES.forEach((upgrade) => {
    const level = meta.upgrades[upgrade.id];
    const maxed = level >= upgrade.costs.length;
    const cost = maxed ? 0 : upgrade.costs[level];
    const button = makeButton("", "legacy-button", () => buyLegacyUpgrade(upgrade.id), maxed || meta.legacyInfamy < cost);
    button.append(
      makeElement("strong", "", `${upgrade.name} · ${maxed ? "MAX" : `Lv.${level}`}`),
      makeElement("span", "", maxed ? upgrade.description : `${upgrade.description} · 악명 ${cost}`),
    );
    legacyGrid.append(button);
  });
  ui.modalPanel.append(legacyGrid);

  addModalActions([
    {
      label: "항해 시작",
      primary: true,
      onClick: () => startVoyage(selectedCaptainId, selectedMapId),
    },
  ]);
}

function buyLegacyUpgrade(id) {
  const upgrade = LEGACY_UPGRADES.find((item) => item.id === id);
  const level = meta.upgrades[id];
  if (!upgrade || level >= upgrade.costs.length) return;
  const cost = upgrade.costs[level];
  if (meta.legacyInfamy < cost) return;
  meta.legacyInfamy -= cost;
  meta.upgrades[id] += 1;
  saveMeta();
  playTone(620, 0.1, "triangle");
  showHarbor();
}

function startVoyage(captainId, mapId) {
  const chosen = CAPTAINS.find((item) => item.id === captainId && isCaptainUnlocked(item))
    || CAPTAINS.find(isCaptainUnlocked)
    || CAPTAINS[0];
  const chosenMap = MAPS.find((item) => item.id === mapId && isMapUnlocked(item))
    || MAPS.find(isMapUnlocked)
    || MAPS[0];
  ACTS = chosenMap.acts;
  const maxHull = 42 + chosen.hull + meta.upgrades.hull * 4;
  const maxSails = 20 + chosen.sails;
  const supplyBonus = chosen.supplies + meta.upgrades.supplies * 2;

  run = {
    captainId: chosen.id,
    mapId: chosenMap.id,
    enemyMultiplier: chosenMap.enemyMultiplier,
    rewardMultiplier: chosenMap.rewardMultiplier,
    actIndex: 0,
    mode: "interstitial",
    map: null,
    currentNodeId: null,
    hull: maxHull,
    maxHull,
    sails: maxSails,
    maxSails,
    morale: clamp(72 + chosen.morale + meta.upgrades.morale * 5, 0, 100),
    food: 15 + supplyBonus,
    water: 15 + supplyBonus,
    gold: 14,
    cannons: 6 + chosen.cannons,
    repairKits: 2,
    deck: [...CardDefinitions.STARTER_DECK],
    cardRemovals: 0,
    infamy: 0,
    crew: [makeCrew(chosen.crew)],
    artifacts: [],
    logs: [],
    combat: null,
    travelCount: 0,
    banked: false,
    safetyNetCharges: chosen.safetyNetCharges || 1,
  };

  Analytics.startRun(chosen.id, chosenMap.id);
  logEvent(`${chosen.name} 선장이 ${chosen.ship}의 닻을 올렸다.`);
  beginAct(0);
}

function beginAct(actIndex) {
  run.actIndex = actIndex;
  run.map = generateMap(actIndex);
  run.currentNodeId = run.map.layers[0][0].id;
  run.mode = "interstitial";
  updateHud();
  const act = ACTS[actIndex];
  setModalBase(act.name.toUpperCase(), act.short, act.subtitle);
  addModalActions([
    {
      label: actIndex === 0 ? "출항" : "해역 진입",
      primary: true,
      onClick: () => {
        closeModal();
        run.mode = "map";
        canvas.classList.add("map-active");
        renderActionDock();
        logEvent(`${act.short}에 진입했다.`);
      },
    },
  ]);
}

function generateMap(actIndex) {
  const rowSets = [[2.55], [1.15, 2.75, 4.25], [0.85, 2.55, 4.45], [1.2, 2.95, 4.55], [1.65, 3.7], [2.65]];
  const typeSets = [
    ["start"],
    shuffle(["battle", "event", "port"]),
    shuffle(["battle", "event", "treasure"]),
    shuffle(["event", "battle", "port"]),
    shuffle(["battle", "elite"]),
    ["boss"],
  ];

  const layers = rowSets.map((rows, column) => rows.map((row, index) => ({
    id: `a${actIndex}-c${column}-n${index}`,
    column,
    row,
    x: 78 + column * 207,
    y: 60 + row * 120,
    type: typeSets[column][index],
    next: [],
    visited: column === 0,
  })));

  for (let column = 0; column < layers.length - 1; column += 1) {
    const currentLayer = layers[column];
    const nextLayer = layers[column + 1];
    currentLayer.forEach((node) => {
      const ordered = [...nextLayer].sort((left, right) => Math.abs(left.y - node.y) - Math.abs(right.y - node.y));
      node.next.push(ordered[0].id);
      if (ordered[1] && Math.random() < 0.72) node.next.push(ordered[1].id);
    });

    nextLayer.forEach((nextNode) => {
      const hasIncoming = currentLayer.some((node) => node.next.includes(nextNode.id));
      if (!hasIncoming) {
        const nearest = [...currentLayer].sort((left, right) => Math.abs(left.y - nextNode.y) - Math.abs(right.y - nextNode.y))[0];
        nearest.next.push(nextNode.id);
      }
    });
  }

  return { layers, nodes: layers.flat() };
}

function currentNode() {
  return run?.map?.nodes.find((node) => node.id === run.currentNodeId) || null;
}

function availableNodes() {
  const node = currentNode();
  if (!node) return [];
  return node.next.map((id) => run.map.nodes.find((candidate) => candidate.id === id)).filter(Boolean);
}

function travelTo(nodeId) {
  if (!run || run.mode !== "map") return;
  const target = availableNodes().find((node) => node.id === nodeId);
  if (!target) return;

  const baseCost = getSupplyCost();
  const foodCost = getFoodTravelCost();
  run.food = Math.max(0, run.food - foodCost);
  run.water = Math.max(0, run.water - baseCost);
  run.travelCount += 1;
  run.currentNodeId = target.id;
  target.visited = true;
  Analytics.recordNode(target.type);
  run.mode = "resolving";
  canvas.classList.remove("map-active");

  const travelMorale = (hasArtifact("figurehead") ? 1 : 0) + getCookMoraleBonus();
  if (travelMorale > 0) run.morale = clamp(run.morale + travelMorale, 0, 100);
  let starvationPenalty = 0;
  if (!hasTrait("stoic")) {
    if (run.food === 0) starvationPenalty += 10;
    if (run.water === 0) starvationPenalty += 12;
  }
  if (starvationPenalty > 0) run.morale = clamp(run.morale - starvationPenalty, 0, 100);
  const moraleNote = travelMorale > 0 ? `, 사기 +${travelMorale}` : starvationPenalty > 0 ? `, 굶주림으로 사기 -${starvationPenalty}` : "";
  logEvent(`${NODE_TYPES[target.type].name} 항로로 이동했다. 식량 -${foodCost}, 식수 -${baseCost}${moraleNote}.`);
  updateHud();
  clearElement(ui.actionDock);

  if (checkDefeat()) return;
  setTimeout(() => resolveNode(target), 240);
}

function resolveNode(node) {
  if (!run || run.currentNodeId !== node.id) return;
  if (node.type === "battle") startCombat("battle");
  if (node.type === "elite") startCombat("elite");
  if (node.type === "boss") startCombat("boss");
  if (node.type === "event") showRandomEvent();
  if (node.type === "port") showPort();
  if (node.type === "treasure") showTreasure();
}

function returnToMap() {
  if (!run) return;
  closeModal();
  run.mode = "map";
  run.combat = null;
  canvas.classList.add("map-active");
  updateHud();
  renderActionDock();
}

function renderActionDock() {
  clearElement(ui.actionDock);
  if (!run) return;

  if (run.mode === "map") {
    const title = makeElement("div", "action-title");
    title.append(makeElement("h2", "", "다음 항로"), makeElement("p", "", `이동 소모 · 식량 ${getFoodTravelCost()} / 식수 ${getSupplyCost()}`));
    const buttons = makeElement("div", "action-buttons");
    availableNodes().forEach((node) => {
      const type = NODE_TYPES[node.type];
      const button = makeElement("button", `command-button${node.type === "boss" ? " danger" : ""}`);
      button.type = "button";
      button.append(makeElement("strong", "", type.name), makeElement("span", "", type.description));
      button.addEventListener("click", () => travelTo(node.id));
      buttons.append(button);
    });
    ui.actionDock.append(title, buttons);
    return;
  }

  if (run.mode === "combat") renderCombatActions();
}

function makeEnemy(kind, excludedNames = []) {
  const act = run.actIndex;
  const regularNames = [
    ["소금칼 밀수선", "검은 이빨 해적선", "현상금 사냥꾼 마고", "난파선 약탈자"],
    ["폭풍 약탈선", "왕실 추격함", "왕실 초계함", "벼락 포격선"],
    ["망령 해적선", "뼈돛 추격선", "심연 포격선", "침묵의 접안선"],
  ];
  const eliteNames = ["현상금 사냥꾼 마고", "벼락 포격선", "망령 해적선"];
  const bossNames = ACTS.map((item) => item.boss);
  const boss = kind === "boss";
  const elite = kind === "elite";
  const availableNames = regularNames[act].filter((candidate) => !excludedNames.includes(candidate));
  const name = boss
    ? bossNames[act]
    : elite
      ? eliteNames[act]
      : randomChoice(availableNames.length > 0 ? availableNames : regularNames[act]);
  const enemyMult = run.enemyMultiplier || 1;
  const maxHull = Math.round((boss ? 54 + act * 15 : elite ? 40 + act * 12 : 27 + act * 9 + randomInt(-2, 4)) * enemyMult);
  const maxSails = Math.round((boss ? 24 + act * 4 : elite ? 20 + act * 3 : 15 + act * 2) * enemyMult);
  const crew = Math.round((boss ? 20 + act * 5 : elite ? 16 + act * 4 : 10 + act * 3) * enemyMult);

  return {
    kind,
    name,
    shipImages: boss ? bossShipImagePaths(run.mapId, act) : [ENEMY_SHIP_IMAGES[name]],
    hull: maxHull,
    maxHull,
    sails: maxSails,
    maxSails,
    crew,
    maxCrew: crew,
    damage: Math.round((boss ? 8 + act * 2 : elite ? 7 + act : 5 + act) * enemyMult),
    rewardGold: boss ? 28 + act * 10 : elite ? 20 + act * 7 : 11 + act * 5,
    rewardInfamy: boss ? 28 + act * 8 : elite ? 15 + act * 4 : 7 + act * 2,
  };
}

function rollWind() {
  const direction = randomChoice(["순풍", "측풍", "역풍"]);
  return { direction, speed: randomInt(1, 3) };
}

function energyOptions(turn = 1) {
  return { ...getEnergyModifiers(turn), handLimit: 8 };
}

function startCombat(kind) {
  const cardOptions = energyOptions(1);
  const enemyCount = FleetCombat.enemyCount(run.mapId, kind, run.actIndex, Math.random);
  const enemies = [];
  const excludedNames = [];
  for (let index = 0; index < enemyCount; index += 1) {
    const enemyKind = index === 0 ? kind : "battle";
    const enemy = makeEnemy(enemyKind, excludedNames);
    excludedNames.push(enemy.name);
    enemies.push(enemy);
  }
  const statScale = FleetCombat.statScale(enemies.length);
  enemies.forEach((enemy, index) => {
    enemy.id = `enemy-${index}`;
    enemy.maxHull = Math.round(enemy.maxHull * statScale);
    enemy.hull = enemy.maxHull;
    enemy.maxSails = Math.round(enemy.maxSails * statScale);
    enemy.sails = enemy.maxSails;
    enemy.maxCrew = Math.round(enemy.maxCrew * statScale);
    enemy.crew = enemy.maxCrew;
    enemy.damage = Math.max(1, Math.round(enemy.damage * statScale));
    enemy.range = kind === "boss" ? 3 : randomChoice([2, 3]);
    enemy.intent = "attack";
    enemy.intentReady = false;
    enemy.captured = false;
    enemy.defeated = false;
  });
  const leadEnemy = enemies[0];
  run.mode = "combat";
  const cardState = typeof CardEngine === "undefined"
    ? null
    : CardEngine.createState(run.deck || CardDefinitions.STARTER_DECK, Math.random, cardOptions);
  if (cardState) {
    cardState.energy += cardOptions.turnEnergy;
    CardEngine.drawCards(cardState, cardOptions.openingDrawBonus, Math.random);
  }
  run.combat = {
    enemies,
    focusedEnemyId: leadEnemy.id,
    attackCursor: 0,
    capturedCount: 0,
    rewardGold: Math.round(leadEnemy.rewardGold * FleetCombat.rewardScale(enemies.length)),
    rewardInfamy: Math.round(leadEnemy.rewardInfamy * FleetCombat.rewardScale(enemies.length)),
    wind: rollWind(),
    turn: 1,
    evasion: 0,
    skillReady: true,
    locked: false,
    firstShotUsed: false,
    victoryScheduled: false,
    enemyActions: 0,
    cardState,
    smugglerPulleyUsed: false,
    frugalUsed: false,
    rallyingUsed: false,
    boardingPowerBonus: 0,
    message: enemies.length > 1
      ? `${leadEnemy.name}을 기함으로 한 적 함대가 포문을 열었다.`
      : `${withJosa(leadEnemy.name, "이", "가")} 포문을 열었다.`,
    log: [enemies.length > 1
      ? `${leadEnemy.name}을 기함으로 한 적 함대가 포문을 열었다.`
      : `${withJosa(leadEnemy.name, "이", "가")} 포문을 열었다.`],
  };
  if (hasArtifact("leviathan")) {
    run.hull = Math.min(run.maxHull, run.hull + 5);
  }
  closeModal();
  canvas.classList.remove("map-active");
  logEvent(enemies.length > 1
    ? `${leadEnemy.name}을 기함으로 한 ${enemies.length}척 함대와 교전 시작.`
    : `${withJosa(leadEnemy.name, "과", "와")} 교전 시작.`);
  Analytics.recordCombatStart();
  renderActionDock();
  playTone(160, 0.16, "sawtooth", 0.045);
}

function findEnemy(enemyId) {
  return run?.combat?.enemies.find((enemy) => enemy.id === enemyId) || null;
}

function focusedEnemy() {
  if (!run?.combat) return null;
  const combat = run.combat;
  const focused = findEnemy(combat.focusedEnemyId);
  if (focused && !focused.defeated && !focused.captured) return focused;
  const next = FleetCombat.livingEnemies(combat.enemies)[0] || focused || combat.enemies[0] || null;
  if (next) combat.focusedEnemyId = next.id;
  return next;
}

function enemyRange(enemyId) {
  return findEnemy(enemyId)?.range ?? 3;
}

function setEnemyRange(enemyId, value) {
  const enemy = findEnemy(enemyId);
  if (!enemy) return null;
  enemy.range = clamp(value, 1, 3);
  return enemy.range;
}

function playerHitChance(shotType, targetEnemy = focusedEnemy()) {
  const combat = run.combat;
  const enemy = targetEnemy;
  let chance = shotType === "chain" ? 0.76 : 0.84;
  chance -= (enemyRange(enemy.id) - 1) * (shotType === "chain" ? 0.11 : 0.09);
  if (combat.wind.direction === "순풍") chance += 0.06;
  if (combat.wind.direction === "역풍" && !hasArtifact("storm")) chance -= 0.1;
  if (captain().id === "gunner") chance += 0.06;
  if (hasArtifact("sextant")) chance += 0.1;
  if (hasTrait("eagleEyed")) chance += 0.05;
  return clamp(chance, 0.25, 0.96);
}

function cannonDamage() {
  return getCannonPower() + randomInt(2, 6) + (hasArtifact("powder") ? 3 : 0);
}

function consumeGuaranteedFirstShot() {
  const combat = run.combat;
  if (hasArtifact("spyglass") && !combat.firstShotUsed) {
    combat.firstShotUsed = true;
    return true;
  }
  return false;
}

function findHandInstance(instanceId) {
  return run?.combat?.cardState?.hand.find((instance) => instance.instanceId === instanceId) || null;
}

function cardTargetId(target) {
  return typeof target === "object" && target ? target.id : target;
}

function cardTargetCandidates(card) {
  if (!run?.combat || !card) return [];
  if (card.id === "navigator_reposition") {
    return [
      { type: "sea", id: "sea", range: 1 },
      { type: "sea", id: "sea", range: 3 },
    ];
  }
  if (["approach", "tailwind_charge", "ram"].includes(card.id)) {
    return FleetCombat.livingEnemies(run.combat.enemies).map((enemy) => ({ type: "enemy", id: enemy.id }));
  }
  if (card.targetType === "enemy") {
    return FleetCombat.livingEnemies(run.combat.enemies).map((enemy) => ({ type: "enemy", id: enemy.id }));
  }
  if (card.targetType === "self") return [{ type: "self", id: "self" }];
  if (card.targetType === "sea") return [{ type: "sea", id: "sea" }];
  if (card.targetType === "allEnemies") return [{ type: "allEnemies", id: "allEnemies" }];
  return [];
}

function maneuverUseError(cardId, enemy = null) {
  if (["approach", "tailwind_charge", "ram", "retreat", "hard_turn", "smoke_sail"].includes(cardId)
    && run.sails <= 0) return "돛이 없어 기동할 수 없습니다.";
  if (["approach", "tailwind_charge", "ram"].includes(cardId) && enemy && enemyRange(enemy.id) <= 1) {
    return "이미 가장 가까운 거리입니다.";
  }
  if (cardId === "tailwind_charge" && run.combat.wind.direction !== "순풍") {
    return "순풍일 때만 사용할 수 있습니다.";
  }
  return null;
}

function effectiveCardCost(instance) {
  const card = instance ? CardDefinitions.getCard(instance.cardId) : null;
  const frugalDiscount = hasTrait("frugal") && !run.combat.frugalUsed ? 1 : 0;
  return Math.max(0, (card?.cost || 0) + (instance?.costDelta || 0) - frugalDiscount);
}

function cardUseError(instanceId, target) {
  if (!run || run.mode !== "combat" || !run.combat?.cardState) return "전투 중에만 카드를 사용할 수 있습니다.";
  if (!ui.modalLayer.hidden) return "모달이 열린 동안에는 카드를 사용할 수 없습니다.";
  if (run.combat.locked || run.combat.victoryScheduled) return "지금은 카드를 사용할 수 없습니다.";
  const instance = findHandInstance(instanceId);
  if (!instance) return "손패에 없는 카드입니다.";
  const card = CardDefinitions.getCard(instance.cardId);
  if (!card) return "알 수 없는 카드입니다.";
  if (card.captainId && card.captainId !== captain().id) return "다른 선장 전용 카드는 사용할 수 없습니다.";
  if (run.combat.cardState.energy < effectiveCardCost(instance)) return "에너지가 부족합니다.";
  if (card.id === "navigator_reposition"
    && (typeof target !== "object" || ![1, 3].includes(target?.range))) {
    return "완전 재배치는 거리 1 또는 3을 선택해야 합니다.";
  }

  const targetId = cardTargetId(target);
  const targetCandidate = cardTargetCandidates(card).find((candidate) => (
    candidate.id === targetId
    && (typeof target !== "object" || !target?.type || target.type === candidate.type)
    && (candidate.range === undefined || target?.range === candidate.range)
  ));
  if (!targetCandidate) return "유효하지 않은 대상입니다.";
  const enemy = targetCandidate.type === "enemy" ? findEnemy(targetId) : null;
  const maneuverError = maneuverUseError(card.id, enemy);
  if (maneuverError) return maneuverError;

  if (["repair", "overhaul"].includes(card.id)) {
    if (run.repairKits <= 0) return "수리도구가 없습니다.";
    if (run.hull >= run.maxHull) return "선체가 이미 완전히 수리되었습니다.";
  }
  if (card.id === "rigging_repair" && run.sails >= run.maxSails) return "돛이 이미 완전히 수리되었습니다.";
  if (card.id === "board" && (enemyRange(enemy.id) !== 1 || enemy.sails > enemy.maxSails * 0.55)) {
    return "거리 1에서 적의 돛을 충분히 손상시켜야 합니다.";
  }
  if (["grappling_hook", "desperate_board"].includes(card.id) && enemyRange(enemy.id) !== 1) {
    return "거리 1에서만 사용할 수 있습니다.";
  }
  return null;
}

function validTargets(instanceId) {
  const instance = findHandInstance(instanceId);
  const card = instance ? CardDefinitions.getCard(instance.cardId) : null;
  if (!card) return [];
  return cardTargetCandidates(card).filter((candidate) => cardUseError(instanceId, candidate) === null);
}

function makeCardResolution() {
  return { damageByEnemy: {}, playerDamage: 0, moraleDelta: 0, cardsDrawn: 0, combatEnded: false };
}

function recordEnemyDamage(resolution, enemy, before) {
  const existing = resolution.damageByEnemy[enemy.id] || { hull: 0, sails: 0, crew: 0 };
  resolution.damageByEnemy[enemy.id] = {
    hull: existing.hull + Math.max(0, before.hull - enemy.hull),
    sails: existing.sails + Math.max(0, before.sails - enemy.sails),
    crew: existing.crew + Math.max(0, before.crew - enemy.crew),
  };
}

function dealEnemyHullDamage(enemy, amount) {
  let hullDamage = amount;
  if (hullDamage > 0 && enemy.abyssMarkCharges > 0) {
    hullDamage += 4;
    enemy.abyssMarkCharges -= 1;
  }
  enemy.hull -= hullDamage;
  return hullDamage;
}

function damageEnemy(enemy, damage, resolution) {
  const before = { hull: enemy.hull, sails: enemy.sails, crew: enemy.crew };
  dealEnemyHullDamage(enemy, damage.hull || 0);
  enemy.sails -= damage.sails || 0;
  enemy.crew -= damage.crew || 0;
  recordEnemyDamage(resolution, enemy, before);
}

function fireHits(enemy, shotType, chanceDelta = 0) {
  const preparedBonus = run.combat.nextShotAccuracyBonus || 0;
  run.combat.nextShotAccuracyBonus = 0;
  return consumeGuaranteedFirstShot()
    || Math.random() <= clamp(playerHitChance(shotType, enemy) + chanceDelta + preparedBonus, 0, 1);
}

function drawForCard(count) {
  return CardEngine.drawCards(run.combat.cardState, count, Math.random).length;
}

function captureEnemy(enemy, chance, resolution) {
  const before = { hull: enemy.hull, sails: enemy.sails, crew: enemy.crew };
  if (Math.random() < chance) {
    enemy.hull = 0;
    enemy.captured = true;
    run.combat.capturedCount += 1;
    recordEnemyDamage(resolution, enemy, before);
    return true;
  }
  const damage = randomInt(5, 9);
  run.hull -= damage;
  run.morale -= 6;
  if (run.crew.length > 1 && !hasArtifact("phantomCrew") && Math.random() < 0.25) {
    run.crew.splice(randomInt(0, run.crew.length - 1), 1);
  }
  resolution.playerDamage += damage;
  resolution.moraleDelta -= 6;
  return false;
}

function executePublicCard(cardId, target) {
  const resolution = makeCardResolution();
  const combat = run.combat;
  const targetId = cardTargetId(target);
  const enemy = findEnemy(targetId);
  const living = FleetCombat.livingEnemies(combat.enemies);
  const playerHullBefore = run.hull;
  const moraleBefore = run.morale;
  let message = CardDefinitions.getCard(cardId)?.name || cardId;

  if (cardId === "fire" && fireHits(enemy, "fire")) {
    const hullDamage = cannonDamage();
    const crewDamage = Math.random() < 0.25 ? 1 : 0;
    damageEnemy(enemy, { hull: hullDamage, crew: crewDamage }, resolution);
    message = "포탄이 적 선체를 갈랐다.";
  } else if (cardId === "aimed_fire" && fireHits(enemy, "fire", 0.15)) {
    damageEnemy(enemy, { hull: cannonDamage() + 6 }, resolution);
    message = "조준 포격이 적 선체에 명중했다.";
  } else if (cardId === "rapid_fire") {
    if (fireHits(enemy, "fire")) damageEnemy(enemy, { hull: Math.max(1, Math.round(cannonDamage() * 0.6)) }, resolution);
    resolution.cardsDrawn = drawForCard(1);
  } else if (cardId === "chain" && fireHits(enemy, "chain")) {
    damageEnemy(enemy, { sails: randomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0) }, resolution);
  } else if (cardId === "heavy_chain" && fireHits(enemy, "chain")) {
    damageEnemy(enemy, { sails: randomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0) + 8 }, resolution);
  } else if (cardId === "entangling_chain" && fireHits(enemy, "chain")) {
    damageEnemy(enemy, { sails: randomInt(3, 6) + getGunnerBonus() }, resolution);
    enemy.movementBlocked = true;
  } else if (["approach", "tailwind_charge", "ram"].includes(cardId)) {
    const chance = hasArtifact("ghostSail")
      ? 1
      : clamp(0.68 + getRiggerChanceBonus() + run.sails / run.maxSails * 0.12, 0.3, 0.96);
    if (Math.random() < chance) {
      setEnemyRange(enemy.id, enemyRange(enemy.id) - 1);
      combat.evasion = 0.08;
      if (cardId === "ram") {
        damageEnemy(enemy, { hull: 8 }, resolution);
        run.hull -= 3;
        resolution.playerDamage += 3;
      }
    }
    if (cardId === "tailwind_charge") resolution.cardsDrawn = drawForCard(1);
  } else if (cardId === "retreat") {
    if (living.every((candidate) => enemyRange(candidate.id) >= 3)) {
      combat.evasion = 0.28;
    } else {
      living.forEach((candidate) => setEnemyRange(candidate.id, enemyRange(candidate.id) + 1));
      combat.evasion = 0.2;
    }
    if (hasArtifact("anchor")) run.morale = clamp(run.morale + 2, 0, 100);
  } else if (cardId === "hard_turn") {
    combat.evasion = 0.15;
    resolution.cardsDrawn = drawForCard(1);
  } else if (cardId === "smoke_sail") {
    living.forEach((candidate) => setEnemyRange(candidate.id, 3));
    combat.evasion = 0.5;
  } else if (cardId === "repair") {
    run.repairKits -= 1;
    run.hull = Math.min(run.maxHull, run.hull + 7 + getCarpenterRepairBonus());
    run.sails = Math.min(run.maxSails, run.sails + 3);
  } else if (cardId === "rigging_repair") {
    run.sails = Math.min(run.maxSails, run.sails + 4);
  } else if (cardId === "overhaul") {
    run.repairKits -= 1;
    run.hull = Math.min(run.maxHull, run.hull + 14 + getCarpenterRepairBonus());
    run.sails = Math.min(run.maxSails, run.sails + 6);
  } else if (cardId === "board") {
    const chance = clamp(0.42 + (getCrewPower() - enemy.crew) / 45 + (hasTrait("brave") ? 0.08 : 0), 0.2, 0.9);
    captureEnemy(enemy, chance, resolution);
  } else if (cardId === "grappling_hook") {
    damageEnemy(enemy, { sails: 5 }, resolution);
  } else if (cardId === "desperate_board") {
    const chance = clamp(0.42 + (getCrewPower() - enemy.crew) / 45 + (hasTrait("brave") ? 0.08 : 0) - 0.15, 0.15, 0.75);
    captureEnemy(enemy, chance, resolution);
  } else if (["barrage_fire", "chain_rain", "fireship"].includes(cardId)) {
    const outcomes = living.map((candidate) => {
      if (cardId === "barrage_fire") {
        const hit = fireHits(candidate, "fire", -0.1);
        return { enemy: candidate, damage: hit ? { hull: Math.max(1, Math.round(cannonDamage() * 0.6)) } : {} };
      }
      if (cardId === "chain_rain") {
        const hit = fireHits(candidate, "chain", -0.1);
        return { enemy: candidate, damage: hit ? { sails: 5 + getGunnerBonus() } : {} };
      }
      return { enemy: candidate, damage: { hull: 10, sails: 5 } };
    });
    outcomes.forEach((outcome) => damageEnemy(outcome.enemy, outcome.damage, resolution));
    if (cardId === "fireship") run.morale -= 4;
  }

  resolution.playerDamage = Math.max(0, playerHullBefore - run.hull);
  resolution.moraleDelta = run.morale - moraleBefore;
  combat.message = message;
  return resolution;
}

function drawRandomArtilleryCard() {
  const state = run.combat.cardState;
  if (state.hand.length >= state.handLimit) return null;
  const candidates = state.drawPile
    .map((instance, index) => ({ instance, index }))
    .filter(({ instance }) => CardDefinitions.getCard(instance.cardId)?.family === "포격");
  if (candidates.length === 0) return null;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const [instance] = state.drawPile.splice(selected.index, 1);
  instance.costDelta = -1;
  state.hand.push(instance);
  return instance;
}

function executeCaptainCard(cardId, target) {
  const resolution = makeCardResolution();
  const combat = run.combat;
  const enemy = findEnemy(cardTargetId(target));
  const living = FleetCombat.livingEnemies(combat.enemies);
  const playerHullBefore = run.hull;
  const moraleBefore = run.morale;
  const cardName = CardDefinitions.getCard(cardId)?.name || cardId;

  if (cardId === "gunner_steady_aim") {
    combat.nextShotAccuracyBonus = 0.15;
    resolution.cardsDrawn = drawForCard(1);
  } else if (cardId === "gunner_shrapnel") {
    if (fireHits(enemy, "fire")) {
      damageEnemy(enemy, { hull: Math.max(1, Math.round(cannonDamage() * 0.6)), crew: 2 }, resolution);
    }
  } else if (cardId === "gunner_double_broadside") {
    for (let shot = 0; shot < 2; shot += 1) {
      if (fireHits(enemy, "fire")) {
        damageEnemy(enemy, { hull: Math.max(1, Math.round(cannonDamage() * 0.7)) }, resolution);
      }
    }
  } else if (cardId === "gunner_powder_shift") {
    resolution.cardsDrawn = drawRandomArtilleryCard() ? 1 : 0;
  } else if (cardId === "gunner_overcharge") {
    if (fireHits(enemy, "fire")) damageEnemy(enemy, { hull: cannonDamage() + 8, sails: 5 }, resolution);
    run.sails -= 3;
  } else if (cardId === "gunner_magazine_open") {
    damageEnemy(enemy, { hull: 18 + getCannonPower() }, resolution);
    run.hull -= 6;
  } else if (cardId === "gunner_fleet_broadside") {
    const damage = 10 + getCannonPower() * 0.5;
    living.forEach((candidate) => damageEnemy(candidate, { hull: damage, sails: 3 }, resolution));
    run.hull -= 4;
  } else if (cardId === "navigator_read_wind") {
    combat.wind = rollWind();
    if (combat.wind.direction === "순풍") combat.cardState.energy += 1;
  } else if (cardId === "navigator_raise_sails") {
    run.sails = Math.min(run.maxSails, run.sails + 5);
    resolution.cardsDrawn = drawForCard(1);
  } else if (cardId === "navigator_crosswind_turn") {
    living.forEach((candidate) => setEnemyRange(candidate.id, 2));
    combat.evasion = 0.2;
  } else if (cardId === "navigator_wave_ride") {
    if (run.sails >= run.maxSails / 2) resolution.cardsDrawn = drawForCard(2);
  } else if (cardId === "navigator_tailwind_route") {
    combat.wind = { direction: "순풍", speed: combat.wind.speed };
    combat.tailwindUntilTurn = combat.cardState.turn + 1;
  } else if (cardId === "navigator_reposition") {
    const range = target.range;
    living.forEach((candidate) => setEnemyRange(candidate.id, range));
    combat.evasion = 0.6;
  } else if (cardId === "navigator_storm_corridor") {
    living.forEach((candidate) => {
      damageEnemy(candidate, { sails: 7 }, resolution);
      setEnemyRange(candidate.id, enemyRange(candidate.id) + 1);
    });
    combat.evasion = 0.3;
  } else if (cardId === "mystic_abyss_mark") {
    enemy.abyssMarkCharges = 2;
  } else if (cardId === "mystic_cursed_tide") {
    damageEnemy(enemy, { hull: 4, sails: 6, crew: 2 }, resolution);
  } else if (cardId === "mystic_fear_whisper") {
    combat.nextEnemyAttackReduction = 0.4;
    run.morale = Math.min(100, run.morale + 3);
  } else if (cardId === "mystic_dark_prophecy") {
    resolution.cardsDrawn = drawForCard(2);
  } else if (cardId === "mystic_blood_pact") {
    run.morale -= 5;
    combat.cardState.energy += 2;
  } else if (cardId === "mystic_open_abyss") {
    damageEnemy(enemy, { hull: 12, sails: 10, crew: 4 }, resolution);
  } else if (cardId === "mystic_abyss_chorus") {
    living.forEach((candidate) => damageEnemy(candidate, { hull: 8, sails: 8, crew: 3 }, resolution));
    run.morale = Math.min(100, run.morale + living.length * 2);
  } else if (cardId === "revenant_dead_nails") {
    run.hull = Math.min(run.maxHull, run.hull + 5);
    run.morale -= 2;
  } else if (cardId === "revenant_ghost_deckhand") {
    combat.boardingPowerBonus = 8;
  } else if (cardId === "revenant_soul_drain") {
    damageEnemy(enemy, { hull: 10 }, resolution);
    run.hull = Math.min(run.maxHull, run.hull + 6);
  } else if (cardId === "revenant_sinking_memory") {
    if (run.hull <= run.maxHull / 2) {
      resolution.cardsDrawn = drawForCard(2);
      combat.cardState.energy += 1;
    }
  } else if (cardId === "revenant_death_delay") {
    combat.deathDelayReady = true;
  } else if (cardId === "revenant_return_abyss") {
    damageEnemy(enemy, { hull: 18 }, resolution);
    run.hull = Math.min(run.maxHull, run.hull + 12);
    if (enemy.hull > 0 && enemy.crew > 0) run.morale -= 6;
  } else if (cardId === "revenant_ghost_fleet") {
    living.forEach((candidate) => damageEnemy(candidate, { hull: 10 }, resolution));
    run.hull = Math.min(run.maxHull, run.hull + living.length * 3);
  }

  resolution.playerDamage = Math.max(0, playerHullBefore - run.hull);
  resolution.moraleDelta = run.morale - moraleBefore;
  combat.message = cardName;
  return resolution;
}

function applyDeathDelay() {
  if (run.hull <= 0 && run.combat.deathDelayReady) {
    run.hull = 1;
    run.combat.deathDelayReady = false;
    return true;
  }
  return false;
}

function applyResolution(resolution) {
  run.combat.enemies.forEach((enemy) => {
    enemy.hull = Math.max(0, enemy.hull);
    enemy.sails = Math.max(0, enemy.sails);
    enemy.crew = Math.max(0, enemy.crew);
    if (!enemy.captured && (enemy.hull <= 0 || enemy.crew <= 0)) enemy.defeated = true;
  });
  applyDeathDelay();
  run.hull = Math.max(0, run.hull);
  run.sails = Math.max(0, run.sails);
  run.morale = Math.max(0, run.morale);
  resolution.combatEnded = FleetCombat.isDefeated(run.combat.enemies) || run.hull <= 0 || run.morale <= 0;
}

function recordCardUse(card, resolution) {
  const actionByFamily = { "포격": "fire", "사슬탄": "chain", "접근": "approach", "회피": "retreat", "수리": "repair", "접안": "board", "광역": "fire" };
  Analytics.addAction(card.id === "chain_rain" ? "chain" : actionByFamily[card.family] || card.id);
  const dealt = Object.values(resolution.damageByEnemy).reduce((sum, damage) => sum + damage.hull, 0);
  Analytics.addDamage(dealt, resolution.playerDamage);
}

function finishCardResolution(resolution) {
  const combat = run.combat;
  combat.log = [combat.message, ...(combat.log || [])].slice(0, 3);
  updateHud();
  renderActionDock();
  if (checkDefeat()) return;
  if (FleetCombat.isDefeated(combat.enemies)) {
    if (!combat.victoryScheduled) {
      combat.victoryScheduled = true;
      setTimeout(winCombat, 360);
    }
    return;
  }
  focusedEnemy();
}

function playCard(instanceId, target) {
  const error = cardUseError(instanceId, target);
  if (error) return false;
  const instance = findHandInstance(instanceId);
  const card = CardDefinitions.getCard(instance.cardId);
  const combat = run.combat;
  const usesFrugal = hasTrait("frugal") && !combat.frugalUsed;
  const cost = effectiveCardCost(instance);
  const energyBefore = combat.cardState.energy;
  if (usesFrugal) instance.costDelta -= 1;
  CardEngine.spendForCard(run.combat.cardState, instanceId);
  if (usesFrugal) combat.frugalUsed = true;
  if (hasTrait("rallying") && !combat.rallyingUsed && energyBefore > 0 && combat.cardState.energy === 0) {
    combat.cardState.energy += 1;
    combat.rallyingUsed = true;
  }
  if (hasArtifact("smugglerPulley") && !combat.smugglerPulleyUsed && cost === 0) {
    combat.cardState.energy += 1;
    combat.smugglerPulleyUsed = true;
  }
  const resolution = card.captainId
    ? executeCaptainCard(card.id, target)
    : executePublicCard(card.id, target);
  CardEngine.finishCard(run.combat.cardState, instanceId, card.exhaust);
  applyResolution(resolution);
  recordCardUse(card, resolution);
  finishCardResolution(resolution);
  return true;
}

function endPlayerTurn() {
  if (!run || run.mode !== "combat" || run.combat.locked || run.combat.victoryScheduled) return;
  CardEngine.endPlayerTurn(run.combat.cardState);
  run.combat.boardingPowerBonus = 0;
  run.combat.locked = true;
  renderActionDock();
  setTimeout(startEnemyTurn, 300);
}

function captainSkillError(target) {
  if (!run || run.mode !== "combat" || !run.combat) return "전투 중에만 선장 기술을 사용할 수 있습니다.";
  if (!ui.modalLayer.hidden) return "모달이 열린 동안에는 선장 기술을 사용할 수 없습니다.";
  if (run.combat.locked || run.combat.victoryScheduled) return "지금은 선장 기술을 사용할 수 없습니다.";
  if (!run.combat.skillReady) return "이번 전투에서는 이미 선장 기술을 사용했습니다.";
  const targetId = target === undefined ? run.combat.focusedEnemyId : cardTargetId(target);
  const enemy = findEnemy(targetId);
  if (!enemy || enemy.defeated || enemy.captured) return "유효한 적 대상을 선택해야 합니다.";
  return null;
}

function useCaptainSkill(target) {
  if (captainSkillError(target)) return false;
  const combat = run.combat;
  const targetId = target === undefined ? combat.focusedEnemyId : cardTargetId(target);
  const enemy = findEnemy(targetId);
  const enemyHullBefore = enemy.hull;
  const playerHullBefore = run.hull;
  combat.skillReady = false;

  if (captain().id === "gunner") {
    const damage = 16 + Math.floor(getCannonPower() * 0.8) + (hasArtifact("powder") ? 3 : 0);
    dealEnemyHullDamage(enemy, damage);
    enemy.sails -= 4;
    combat.message = `전탄 일제사격! 적 선체에 ${damage} 피해.`;
    addCannonEffect("player", true);
    playTone(76, 0.28, "square", 0.065);
  } else if (captain().id === "navigator") {
    FleetCombat.livingEnemies(combat.enemies).forEach((candidate) => setEnemyRange(candidate.id, 3));
    combat.evasion = 0.8;
    run.sails = Math.min(run.maxSails, run.sails + 5);
    const stormDamage = 10 + getGunnerBonus();
    enemy.sails = Math.max(0, enemy.sails - stormDamage);
    combat.message = `폭풍 가르기! 사선을 벗어나 돛을 복구하고 적 돛에 ${stormDamage} 피해를 입혔다.`;
    playTone(720, 0.15, "triangle");
  } else if (captain().id === "mystic") {
    dealEnemyHullDamage(enemy, 6);
    enemy.sails -= 7;
    enemy.crew = Math.max(0, enemy.crew - 4);
    run.morale = clamp(run.morale + 5, 0, 100);
    combat.message = "심해의 속삭임이 적 함선 전체를 뒤흔든다.";
    playTone(190, 0.3, "sine", 0.05);
  } else {
    const damage = 10 + Math.floor(getCannonPower() * 0.5);
    const heal = 8 + getCarpenterRepairBonus();
    dealEnemyHullDamage(enemy, damage);
    enemy.sails -= 5;
    run.hull = Math.min(run.maxHull, run.hull + heal);
    combat.message = `저승의 진혼곡! 적에게 ${damage} 피해를 주고 선체 ${heal}을 되돌렸다.`;
    addCannonEffect("player");
    playTone(300, 0.24, "sine", 0.05);
  }

  Analytics.addAction("skill");
  Analytics.addDamage(enemyHullBefore - enemy.hull, playerHullBefore - run.hull);
  combat.log = [combat.message, ...(combat.log || [])].slice(0, 3);
  enemy.hull = Math.max(0, enemy.hull);
  enemy.sails = Math.max(0, enemy.sails);
  if (!enemy.captured && (enemy.hull <= 0 || enemy.crew <= 0)) enemy.defeated = true;
  run.hull = Math.max(0, run.hull);
  run.morale = Math.max(0, run.morale);
  updateHud();
  renderActionDock();
  if (checkDefeat()) return true;
  if (FleetCombat.isDefeated(combat.enemies)) {
    if (!combat.victoryScheduled) {
      combat.victoryScheduled = true;
      setTimeout(winCombat, 360);
    }
    return true;
  }
  focusedEnemy();
  return true;
}

function combatAction(action) {
  if (!run || run.mode !== "combat" || run.combat.locked) return;
  if (action === "skill") {
    useCaptainSkill();
    return;
  }
  const combat = run.combat;
  const enemy = focusedEnemy();
  if (!enemy) return;
  if (maneuverUseError(action, enemy)) return;
  const enemyHullBefore = enemy.hull;
  const playerHullBefore = run.hull;
  combat.evasion = 0;
  let acted = true;

  if (action === "fire") {
    if (consumeGuaranteedFirstShot() || Math.random() <= playerHitChance("fire")) {
      const damage = cannonDamage();
      enemy.hull -= damage;
      if (Math.random() < 0.25) enemy.crew = Math.max(0, enemy.crew - 1);
      combat.message = `포탄이 적 선체를 갈랐다. 피해 ${damage}.`;
      addCannonEffect("player");
      playTone(92, 0.18, "square", 0.055);
    } else {
      combat.message = "일제사격이 파도 너머로 빗나갔다.";
      addCannonEffect("player", false, true);
      playTone(130, 0.08, "sine");
    }
  } else if (action === "chain") {
    if (consumeGuaranteedFirstShot() || Math.random() <= playerHitChance("chain")) {
      const damage = randomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0);
      enemy.sails -= damage;
      combat.message = `사슬탄이 적의 돛을 찢었다. 돛 피해 ${damage}.`;
      addCannonEffect("player");
      playTone(110, 0.14, "square", 0.05);
    } else {
      combat.message = "사슬탄이 적 돛대를 스쳤다.";
      addCannonEffect("player", false, true);
    }
  } else if (action === "approach") {
    if (enemyRange(enemy.id) <= 1) return;
    const chance = hasArtifact("ghostSail")
      ? 1
      : clamp(0.68 + getRiggerChanceBonus() + run.sails / run.maxSails * 0.12, 0.3, 0.96);
    if (Math.random() < chance) {
      setEnemyRange(enemy.id, enemyRange(enemy.id) - 1);
      combat.evasion = 0.08;
      combat.message = `바람을 타고 ${enemy.name}과의 거리 ${enemyRange(enemy.id)}까지 접근했다.`;
    } else {
      combat.message = "파도가 진로를 막아 거리를 좁히지 못했다.";
    }
    playTone(260, 0.07, "triangle");
  } else if (action === "retreat") {
    const living = FleetCombat.livingEnemies(combat.enemies);
    if (living.every((candidate) => enemyRange(candidate.id) >= 3)) {
      combat.evasion = 0.28;
      combat.message = "돛을 비틀어 적 포격선에서 벗어났다.";
    } else {
      living.forEach((candidate) => setEnemyRange(candidate.id, enemyRange(candidate.id) + 1));
      combat.evasion = 0.2;
      combat.message = "적 함대 전체와의 포격 거리를 벌렸다.";
    }
    if (hasArtifact("anchor")) {
      run.morale = clamp(run.morale + 2, 0, 100);
      combat.message += " 사기 +2.";
    }
    playTone(330, 0.07, "triangle");
  } else if (action === "repair") {
    if (run.repairKits <= 0 || run.hull >= run.maxHull) return;
    const amount = 7 + getCarpenterRepairBonus();
    run.repairKits -= 1;
    run.hull = Math.min(run.maxHull, run.hull + amount);
    run.sails = Math.min(run.maxSails, run.sails + 3);
    combat.message = `응급수리로 선체 ${amount}, 돛 3을 복구했다.`;
    playTone(500, 0.09, "triangle");
  } else if (action === "board") {
    if (enemyRange(enemy.id) !== 1 || enemy.sails > enemy.maxSails * 0.55) return;
    const chance = clamp(0.42 + (getCrewPower() - enemy.crew) / 45 + (hasTrait("brave") ? 0.08 : 0), 0.2, 0.9);
    spawnImpactSparks(482, 453, 14);
    triggerShake(8);
    if (Math.random() < chance) {
      enemy.hull = 0;
      enemy.captured = true;
      combat.capturedCount += 1;
      combat.message = "적 갑판을 장악했다. 선장과 화물을 생포했다!";
      playTone(680, 0.18, "sawtooth", 0.04);
    } else {
      const damage = randomInt(5, 9);
      run.hull -= damage;
      run.morale -= 6;
      if (run.crew.length > 1 && !hasArtifact("phantomCrew") && Math.random() < 0.25) {
        const lost = run.crew.splice(randomInt(0, run.crew.length - 1), 1)[0];
        combat.message = `접안 공격이 격퇴됐다. ${withJosa(lost.name, "을", "를")} 잃고 선체 피해 ${damage}.`;
      } else {
        combat.message = `접안 공격이 격퇴됐다. 선체 피해 ${damage}, 사기 -6.`;
      }
      playTone(82, 0.2, "sawtooth", 0.05);
    }
  } else {
    acted = false;
  }

  if (!acted) return;
  Analytics.addAction(action);
  Analytics.addDamage(enemyHullBefore - enemy.hull, playerHullBefore - run.hull);
  combat.log = [combat.message, ...(combat.log || [])].slice(0, 3);
  combat.locked = true;
  enemy.hull = Math.max(0, enemy.hull);
  enemy.sails = Math.max(0, enemy.sails);
  if (!enemy.captured && (enemy.hull <= 0 || enemy.crew <= 0)) enemy.defeated = true;
  run.hull = Math.max(0, run.hull);
  run.morale = Math.max(0, run.morale);
  updateHud();
  renderActionDock();

  if (checkDefeat()) return;

  if (FleetCombat.isDefeated(combat.enemies)) {
    if (!combat.victoryScheduled) {
      combat.victoryScheduled = true;
      setTimeout(winCombat, 360);
    }
    return;
  }

  focusedEnemy();
  setTimeout(startEnemyTurn, 300);
}

function rotateFromCursor(items, cursor) {
  if (items.length === 0) return [];
  const offset = cursor % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function canDirectAttack(enemy) {
  if (enemy.intentReady) return true;
  return !(enemyRange(enemy.id) === 3 && enemy.sails > 0 && Math.random() < 0.58);
}

function performEnemyAttack(enemy) {
  let message = "";
  const damageReduction = run.combat.nextEnemyAttackReduction || 0;
  run.combat.nextEnemyAttackReduction = 0;
  enemy.intent = "attack";
  enemy.intentReady = false;

  if (enemyRange(enemy.id) === 1 && enemy.crew > getCrewPower() * 0.8 && Math.random() < 0.3) {
    const damage = Math.round((randomInt(4, 7) + run.actIndex) * (1 - damageReduction));
    run.hull -= damage;
    run.morale -= 5;
    message = `${enemy.name} 선원들이 난입했다. 선체 피해 ${damage}, 사기 -5.`;
    playTone(84, 0.18, "sawtooth", 0.045);
  } else {
    const hitChance = clamp(
      0.73 - enemyRange(enemy.id) * 0.07 - run.combat.evasion + run.actIndex * 0.03 - getLookoutEvasionBonus(),
      0.1,
      0.88,
    );
    if (Math.random() < hitChance) {
      const damage = Math.round((enemy.damage + randomInt(0, 4)) * (1 - damageReduction));
      run.hull -= damage;
      run.morale -= 2;
      if (Math.random() < 0.28) {
        const sailDamage = randomInt(3, 6);
        run.sails -= sailDamage;
        message = `${enemy.name}의 포격이 선체 ${damage}, 돛 ${sailDamage} 피해를 입혔다.`;
      } else {
        message = `${enemy.name}의 포격 명중. 선체 피해 ${damage}.`;
      }
      addCannonEffect("enemy");
      playTone(72, 0.2, "square", 0.055);
    } else {
      message = `${enemy.name}의 포탄이 뱃전을 아슬아슬하게 비껴갔다.`;
      addCannonEffect("enemy", false, true);
    }
  }

  applyDeathDelay();
  return { enemyId: enemy.id, type: "attack", directAttack: true, message };
}

function performEnemyManeuverOrPrepare(enemy) {
  if (enemyRange(enemy.id) === 3 && enemy.sails > 0 && !enemy.movementBlocked) {
    setEnemyRange(enemy.id, enemyRange(enemy.id) - 1);
    enemy.intent = "approach";
    enemy.intentReady = false;
    return {
      enemyId: enemy.id,
      type: "approach",
      directAttack: false,
      message: `${withJosa(enemy.name, "이", "가")} 돛을 당겨 거리를 좁혔다.`,
    };
  }

  if (Math.random() < 0.5) {
    enemy.intent = "attack";
    enemy.intentReady = true;
    return {
      enemyId: enemy.id,
      type: "prepare",
      directAttack: false,
      message: `${withJosa(enemy.name, "이", "가")} 다음 포격을 준비한다.`,
    };
  }

  enemy.intent = "hold";
  enemy.intentReady = false;
  return {
    enemyId: enemy.id,
    type: "hold",
    directAttack: false,
    message: `${withJosa(enemy.name, "이", "가")} 거리를 유지하며 기회를 엿본다.`,
  };
}

function startEnemyTurn() {
  if (!run || run.mode !== "combat") return [];
  const combat = run.combat;
  const living = FleetCombat.livingEnemies(combat.enemies);
  const playerHullBefore = run.hull;
  let attacksLeft = FleetCombat.attackBudget(run.mapId, living.length);
  const actions = [];

  combat.locked = true;
  for (const enemy of rotateFromCursor(living, combat.attackCursor)) {
    const action = attacksLeft > 0 && canDirectAttack(enemy)
      ? performEnemyAttack(enemy)
      : performEnemyManeuverOrPrepare(enemy);
    actions.push(action);
    enemy.movementBlocked = false;
    if (action.directAttack) attacksLeft -= 1;
    if (run.hull <= 0) break;
  }
  combat.attackCursor = (combat.attackCursor + 1) % Math.max(1, living.length);
  combat.pendingEnemyTurn = { actions, playerHullBefore };
  return finishEnemyTurn();
}

function finishEnemyTurn() {
  if (!run || run.mode !== "combat" || !run.combat.pendingEnemyTurn) return [];
  const combat = run.combat;
  const { actions, playerHullBefore } = combat.pendingEnemyTurn;
  delete combat.pendingEnemyTurn;
  combat.turn += 1;
  combat.enemyActions += 1;
  combat.locked = false;
  combat.message = actions.map((action) => action.message).join(" ");
  combat.evasion = 0;
  applyDeathDelay();
  run.hull = Math.max(0, run.hull);
  run.sails = Math.max(0, run.sails);
  run.morale = Math.max(0, run.morale);

  const nextPlayerTurn = (combat.cardState?.turn || combat.turn) + 1;
  if (combat.tailwindUntilTurn >= nextPlayerTurn) {
    combat.wind = { direction: "순풍", speed: combat.wind.speed };
  } else if (Math.random() < 0.28) {
    combat.wind = rollWind();
    combat.message += ` 바람이 ${combat.wind.direction} ${combat.wind.speed}단계로 바뀌었다.`;
  }

  Analytics.addDamage(0, playerHullBefore - run.hull);
  combat.log = [combat.message, ...(combat.log || [])].slice(0, 3);
  const defeated = checkDefeat();
  if (!defeated && run.mode === "combat" && combat.cardState && !combat.victoryScheduled) {
    const modifiers = getEnergyModifiers(nextPlayerTurn);
    CardEngine.startPlayerTurn(combat.cardState, { energy: modifiers.turnEnergy }, Math.random);
    combat.turn = combat.cardState.turn;
    combat.smugglerPulleyUsed = false;
    combat.boardingPowerBonus = 0;
    if (combat.tailwindUntilTurn >= combat.cardState.turn) {
      combat.wind = { direction: "순풍", speed: combat.wind.speed };
    }
  }
  updateHud();
  renderActionDock();
  return actions;
}

function enemyTurn() {
  return startEnemyTurn();
}

function addCannonEffect(source, broadside = false, missed = false) {
  const count = broadside ? 6 : 3;
  for (let index = 0; index < count; index += 1) {
    visualEffects.push({
      type: "ball",
      source,
      progress: -index * 0.05,
      speed: 0.035 + Math.random() * 0.012,
      offset: randomInt(-20, 20),
      missed,
      missOffset: missed ? randomChoice([-1, 1]) * randomInt(70, 120) : 0,
      hit: false,
    });
  }
  visualEffects.push({ type: "flash", source, progress: 0, speed: 0.11 });
  for (let index = 0; index < (broadside ? 12 : 6); index += 1) {
    visualEffects.push({
      type: "smoke",
      source,
      progress: 0,
      speed: 0.018 + Math.random() * 0.014,
      offset: randomInt(-16, 16),
      drift: randomInt(-16, 16),
    });
  }
}

function spawnImpactSparks(x, y, count = 9) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.4;
    visualEffects.push({
      type: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      progress: 0,
      speed: 0.05 + Math.random() * 0.045,
    });
  }
}

function triggerShake(magnitude) {
  shakeMagnitude = Math.max(shakeMagnitude, magnitude);
}

function renderCombatActions() {
  clearElement(ui.actionDock);
  const combat = run.combat;
  const enemy = focusedEnemy();
  if (!enemy) return;
  const title = makeElement("div", "action-title");
  const logWrap = makeElement("div", "combat-log");
  (combat.log && combat.log.length ? combat.log : [combat.message]).forEach((line, index) => {
    logWrap.append(makeElement(index === 0 ? "h2" : "p", index === 0 ? "" : "combat-log-line", line));
  });
  title.append(
    logWrap,
    makeElement("p", "", `${combat.wind.direction} ${combat.wind.speed} · 거리 ${enemyRange(enemy.id)} · 수리도구 ${run.repairKits}`),
  );

  const buttons = makeElement("div", "action-buttons");
  const commands = [
    { id: "fire", label: "선체 포격", copy: `명중 ${Math.round(playerHitChance("fire") * 100)}%` },
    { id: "chain", label: "사슬탄", copy: `돛 공격 · 명중 ${Math.round(playerHitChance("chain") * 100)}%` },
    { id: "approach", label: "접근 기동", copy: "접안 거리를 만든다", disabled: enemyRange(enemy.id) <= 1 || run.sails <= 0 },
    { id: "retreat", label: "회피 기동", copy: "거리를 벌리고 회피", disabled: run.sails <= 0 },
    { id: "repair", label: "응급수리", copy: `도구 ${run.repairKits}개`, disabled: run.repairKits <= 0 || run.hull >= run.maxHull },
    { id: "board", label: "접안 공격", copy: `승률 ${Math.round(clamp(0.42 + (getCrewPower() - enemy.crew) / 45 + (hasTrait("brave") ? 0.08 : 0), 0.2, 0.9) * 100)}%`, disabled: enemyRange(enemy.id) !== 1 || enemy.sails > enemy.maxSails * 0.55 },
    { id: "skill", label: captain().skill, copy: "선장 고유 기술", disabled: !combat.skillReady, skill: true },
  ];

  commands.forEach((command) => {
    const button = makeElement("button", `command-button${command.skill ? " skill" : ""}`);
    button.type = "button";
    button.disabled = Boolean(command.disabled || combat.locked);
    button.append(makeElement("strong", "", command.label), makeElement("span", "", command.copy));
    button.addEventListener("click", () => combatAction(command.id));
    buttons.append(button);
  });
  ui.actionDock.append(title, buttons);
}

function winCombat() {
  if (!run || run.mode !== "combat") return;
  const combat = run.combat;
  const enemy = combat.enemies[0];
  const encounterName = combat.enemies.length > 1 ? "적 함대" : enemy.name;
  const captured = combat.capturedCount > 0;
  run.mode = "reward";
  Analytics.recordCombatEnd(true, captured);
  const routeMultiplier = run.rewardMultiplier || 1;
  const ransomMultiplier = hasArtifact("kingsRansom") ? 1.5 : 1;
  let gold = adjustedGold(Math.round((combat.rewardGold + combat.capturedCount * 8) * routeMultiplier * ransomMultiplier));
  let infamy = Math.round((combat.rewardInfamy + combat.capturedCount * 5) * routeMultiplier * ransomMultiplier);
  run.gold += gold;
  run.infamy += infamy;
  run.morale = clamp(
    run.morale + (hasArtifact("rum") ? 4 : 0) + (hasTrait("steady") ? 2 : 0) + getSurgeonMoraleBonus(),
    0,
    100,
  );
  logEvent(`${encounterName} 격파. 금화 +${gold}, 악명 +${infamy}.`);
  clearElement(ui.actionDock);
  playTone(540, 0.16, "triangle", 0.05);

  setModalBase(captured ? "VESSEL CAPTURED" : "BATTLE WON", captured ? "나포 성공" : "승리", `${encounterName}의 깃발이 내려갔습니다. 살아남은 선원들이 화물칸과 선장실을 수색합니다.`);
  const stats = makeElement("div", "result-stats");
  [["금화", `+${gold}`], ["악명", `+${infamy}`], ["남은 선체", `${run.hull}/${run.maxHull}`]].forEach(([label, value]) => {
    const cell = makeElement("div");
    cell.append(makeElement("span", "", label), makeElement("strong", "", value));
    stats.append(cell);
  });
  ui.modalPanel.append(stats);

  addModalActions([
    {
      label: enemy.kind === "battle" ? "항로 복귀" : "전리품 확인",
      primary: true,
      onClick: () => {
        if (enemy.kind === "battle") returnToMap();
        else showArtifactChoice(enemy.kind === "boss" ? "지배자의 유산" : "정예함의 유물", () => {
          if (enemy.kind === "boss") completeAct();
          else returnToMap();
        });
      },
    },
  ]);
}

function showArtifactChoice(title, afterChoice) {
  run.mode = "reward";
  const availablePool = ARTIFACTS.filter((artifact) => !hasArtifact(artifact.id));
  const available = drawArtifactChoices(availablePool, 3);
  if (available.length === 0 || run.artifacts.length >= 6) {
    run.infamy += 8;
    logEvent("유물칸이 가득 차 유물을 악명 8로 바꿨다.");
    afterChoice();
    return;
  }

  setModalBase("CHOOSE ONE", title, `한 항해에서 지닐 수 있는 유물은 여섯 개입니다. 후보 1칸의 기본 등급 확률은 ${rarityOddsText()}이며, 남은 등급만으로 재정규화합니다.`);
  const grid = makeElement("div", "choice-grid");
  available.forEach((artifact) => {
    const rarity = RARITIES[artifact.rarity] || RARITIES.normal;
    const button = makeElement("button", `modal-choice rarity-${artifact.rarity || "normal"}`);
    button.type = "button";
    const head = makeElement("div", "choice-head");
    head.append(makeElement("h3", "", artifact.name), makeElement("span", "choice-cost rarity-badge", rarity.name));
    button.append(head, makeElement("p", "", artifact.description));
    button.addEventListener("click", () => {
      acquireArtifact(artifact);
      afterChoice();
    });
    grid.append(button);
  });
  ui.modalPanel.append(grid);
}

function acquireArtifact(artifact) {
  if (run.artifacts.length >= 6 || hasArtifact(artifact.id)) return;
  run.artifacts.push(artifact);
  if (artifact.id === "plating") {
    run.maxHull += 8;
    run.hull += 8;
  }
  if (artifact.id === "leviathan") {
    run.maxHull += 15;
    run.hull += 15;
  }
  if (artifact.id === "sailcloth") {
    run.maxSails += 6;
    run.sails += 6;
  }
  run.infamy += 3;
  if (hasTrait("superstitious")) run.morale = clamp(run.morale + 3, 0, 100);
  Analytics.recordArtifact(artifact.rarity);
  logEvent(`[${RARITIES[artifact.rarity]?.name || "노말"}] ${artifact.name} 획득. 악명 +3.`);
  playTone(760, 0.15, "triangle", 0.045);
  updateHud();
}

function showTreasure() {
  run.mode = "event";
  Analytics.recordEvent("treasure");
  setModalBase("UNCHARTED CACHE", "바다 아래 잠든 금고", "반쯤 가라앉은 석조 금고가 썰물에 모습을 드러냈습니다. 낡은 함정 장치가 아직 작동하는 듯합니다.");
  const grid = makeElement("div", "choice-grid");
  const choices = [
    {
      title: "금고를 해체한다",
      cost: "선체 위험",
      copy: `유물을 얻지만 ${hasArtifact("cursedCompass") ? 15 : 35}% 확률로 선체 피해를 입습니다.`,
      action: () => {
        if (Math.random() < (hasArtifact("cursedCompass") ? 0.15 : 0.35)) {
          const damage = randomInt(4, 9);
          run.hull -= damage;
          logEvent(`금고 함정이 폭발했다. 선체 피해 ${damage}.`);
          if (checkDefeat()) return;
        }
        showArtifactChoice("가라앉은 왕국의 유물", returnToMap);
      },
    },
    {
      title: "금화만 건진다",
      cost: "안전",
      copy: "금화 18과 악명 3을 얻습니다.",
      action: () => {
        const gold = adjustedGold(18);
        run.gold += gold;
        run.infamy += 3;
        logEvent(`침몰선에서 금화 ${withNumberJosa(gold, "을", "를")} 건졌다.`);
        returnToMap();
      },
    },
  ];
  choices.forEach((choice) => grid.append(makeChoiceButton(choice)));
  ui.modalPanel.append(grid);
}

function makeChoiceButton(choice) {
  const button = makeElement("button", "modal-choice");
  button.type = "button";
  button.disabled = Boolean(choice.disabled);
  const head = makeElement("div", "choice-head");
  head.append(makeElement("h3", "", choice.title), makeElement("span", "choice-cost", choice.cost || ""));
  button.append(head, makeElement("p", "", choice.copy));
  button.addEventListener("click", choice.action);
  return button;
}

function showRandomEvent() {
  run.mode = "event";
  const events = [showCastawayEvent, showStormEvent, showSirenEvent, showNavyEvent, showMutinyEvent];
  randomChoice(events)();
}

function showCastawayEvent() {
  Analytics.recordEvent("castaway");
  setModalBase("UNKNOWN ENCOUNTER", "부서진 구명정", "해류에 떠밀려온 구명정에서 한 명의 생존자가 깃발을 흔듭니다. 옆에는 아직 봉인된 보급 상자가 떠 있습니다.");
  const grid = makeElement("div", "choice-grid");
  grid.append(
    makeChoiceButton({
      title: "생존자를 구조한다",
      cost: "선원 +1",
      copy: `무작위 역할·특성·등급의 선원을 영입합니다. ${rarityOddsText()}`,
      disabled: run.crew.length >= 4,
      action: () => {
        const recruit = makeCrew(randomChoice(Object.keys(CREW_ROLES)));
        run.crew.push(recruit);
        run.morale = clamp(run.morale + 5, 0, 100);
        logEvent(`[${recruit.rarity}] ${withJosa(recruit.name, "이", "가")} 선원으로 합류했다. 사기 +5.`);
        returnToMap();
      },
    }),
    makeChoiceButton({
      title: "보급 상자를 건진다",
      cost: "식량·식수 +5",
      copy: "살아남기 위해 필요한 것만 챙깁니다.",
      action: () => {
        run.food += 5;
        run.water += 5;
        run.morale = Math.max(0, run.morale - 3);
        logEvent("보급품을 챙기고 생존자를 외면했다. 사기 -3.");
        returnToMap();
      },
    }),
  );
  ui.modalPanel.append(grid);
}

function showStormEvent() {
  Analytics.recordEvent("storm");
  setModalBase("THE WEATHER TURNS", "수평선을 삼킨 폭풍", "검은 구름이 항로 전체를 덮었습니다. 정면으로 돌파하면 시간을 벌 수 있지만 배가 버티지 못할 수도 있습니다.");
  const grid = makeElement("div", "choice-grid");
  grid.append(
    makeChoiceButton({
      title: "폭풍을 가른다",
      cost: "선체 4~10, 돛 2~5",
      copy: "피해를 감수하고 악명 8을 얻습니다.",
      action: () => {
        const damage = captain().id === "navigator" ? randomInt(2, 5) : randomInt(4, 10);
        const sailDamage = randomInt(2, 5);
        run.hull -= damage;
        run.sails = Math.max(0, run.sails - sailDamage);
        run.infamy += 8;
        logEvent(`폭풍을 돌파했다. 선체 피해 ${damage}, 돛 피해 ${sailDamage}, 악명 +8.`);
        if (!checkDefeat()) returnToMap();
      },
    }),
    makeChoiceButton({
      title: "먼 항로로 우회한다",
      cost: "식량·식수 -3",
      copy: "배를 지키는 대신 보급품을 추가로 사용합니다.",
      action: () => {
        run.food = Math.max(0, run.food - 3);
        run.water = Math.max(0, run.water - 3);
        const outOfSupplies = run.food === 0 || run.water === 0;
        if (outOfSupplies) run.morale = clamp(run.morale - 8, 0, 100);
        logEvent(`폭풍을 우회했다. 식량과 식수 -3${outOfSupplies ? ", 보급 고갈로 사기 -8" : ""}.`);
        if (!checkDefeat()) returnToMap();
      },
    }),
  );
  ui.modalPanel.append(grid);
}

function showSirenEvent() {
  Analytics.recordEvent("siren");
  setModalBase("SONG BELOW DECK", "세이렌의 암초", "새벽 안개 속에서 오래전에 죽은 이들의 노랫소리가 들립니다. 선원들은 난간 쪽으로 한 걸음씩 다가갑니다.");
  const grid = makeElement("div", "choice-grid");
  grid.append(
    makeChoiceButton({
      title: "노래의 근원을 찾는다",
      cost: "사기 위험",
      copy: "성공하면 금화와 악명을 얻고, 실패하면 사기를 잃습니다.",
      action: () => {
        const success = captain().id === "mystic" || Math.random() < (hasArtifact("cursedCompass") ? 0.8 : 0.55);
        if (success) {
          const gold = adjustedGold(16);
          run.gold += gold;
          run.infamy += 6;
          logEvent(`세이렌의 제단을 발견했다. 금화 +${gold}, 악명 +6.`);
        } else {
          run.morale -= 16;
          logEvent("세이렌의 환영에 선원들이 무너졌다. 사기 -16.");
        }
        if (!checkDefeat()) returnToMap();
      },
    }),
    makeChoiceButton({
      title: "귀를 막고 지나간다",
      cost: "사기 -2",
      copy: "아무것도 얻지 않고 항로로 돌아갑니다.",
      action: () => {
        run.morale -= 2;
        logEvent("세이렌의 암초를 뒤로했다. 사기 -2.");
        returnToMap();
      },
    }),
  );
  ui.modalPanel.append(grid);
}

function showNavyEvent() {
  Analytics.recordEvent("navy");
  setModalBase("ROYAL COLORS", "왕실 검문선", "왕실기가 걸린 프리깃이 항로를 막았습니다. 장교는 통행세를 내거나 투항하라는 신호를 보냅니다.");
  const grid = makeElement("div", "choice-grid");
  grid.append(
    makeChoiceButton({
      title: "통행세를 낸다",
      cost: "금화 10",
      copy: "불필요한 교전을 피하고 안전하게 통과합니다.",
      disabled: run.gold < 10,
      action: () => {
        run.gold -= 10;
        logEvent("왕실 검문선에 금화 10을 지불했다.");
        returnToMap();
      },
    }),
    makeChoiceButton({
      title: "해적기를 올린다",
      cost: "정예 전투",
      copy: "승리하면 유물을 얻을 수 있습니다.",
      action: () => {
        closeModal();
        startCombat("elite");
      },
    }),
  );
  ui.modalPanel.append(grid);
}

function showMutinyEvent() {
  Analytics.recordEvent("mutiny");
  setModalBase("WHISPERS IN THE HOLD", "선창의 불온한 속삭임", "오랜 항해로 선원들 사이에 불만이 번집니다. 오늘 밤 결단하지 않으면 내일은 늦을지도 모릅니다.");
  const tavernBonus = hasTrait("drunk") ? 5 : 0;
  const grid = makeElement("div", "choice-grid");
  grid.append(
    makeChoiceButton({
      title: "비상 식량을 푼다",
      cost: "식량 4",
      copy: "선원들과 잔치를 열어 사기 14를 회복합니다.",
      disabled: run.food < 4,
      action: () => {
        run.food -= 4;
        run.morale = clamp(run.morale + 14 + tavernBonus, 0, 100);
        logEvent(`갑판 잔치로 사기 +${14 + tavernBonus}.`);
        returnToMap();
      },
    }),
    makeChoiceButton({
      title: "주동자를 처벌한다",
      cost: hasArtifact("cursedCompass") ? "75% 판정" : "50% 판정",
      copy: "성공하면 사기 +8, 실패하면 사기 -12입니다.",
      action: () => {
        const change = Math.random() < (hasArtifact("cursedCompass") ? 0.75 : 0.5) ? 8 : -12;
        run.morale = clamp(run.morale + change, 0, 100);
        logEvent(`선상 재판이 끝났다. 사기 ${change >= 0 ? "+" : ""}${change}.`);
        if (!checkDefeat()) returnToMap();
      },
    }),
  );
  ui.modalPanel.append(grid);
}

function showPort() {
  run.mode = "port";
  setModalBase("SAFE HARBOR", "바람막이 항구", "밀수상과 조선공, 이름 없는 선원들이 좁은 부두를 메우고 있습니다. 금화가 있는 동안 필요한 준비를 마칠 수 있습니다.");
  const grid = makeElement("div", "choice-grid");
  const discount = getQuartermasterDiscount();
  const priceOf = (base) => Math.max(1, base - discount);
  const supplyPrice = priceOf(8);
  const repairPrice = priceOf(10);
  const recruitPrice = priceOf(14);
  const tavernPrice = priceOf(6);
  const kitPrice = priceOf(7);
  const options = [
    {
      title: "보급품 묶음",
      cost: `금화 ${supplyPrice}`,
      copy: "식량과 식수 +6",
      disabled: run.gold < supplyPrice,
      action: () => {
        run.gold -= supplyPrice;
        run.food += 6;
        run.water += 6;
        logEvent("항구에서 식량과 식수를 보충했다.");
        showPort();
      },
    },
    {
      title: "선체 수리",
      cost: `금화 ${repairPrice}`,
      copy: "선체 +12, 돛 +5",
      disabled: run.gold < repairPrice || (run.hull >= run.maxHull && run.sails >= run.maxSails),
      action: () => {
        run.gold -= repairPrice;
        run.hull = Math.min(run.maxHull, run.hull + 12);
        run.sails = Math.min(run.maxSails, run.sails + 5);
        logEvent("조선공이 선체와 돛을 수리했다.");
        showPort();
      },
    },
    {
      title: "선원 고용",
      cost: `금화 ${recruitPrice}`,
      copy: `무작위 역할·특성·등급 선원 +1 · ${rarityOddsText()}`,
      disabled: run.gold < recruitPrice || run.crew.length >= 4,
      action: () => {
        run.gold -= recruitPrice;
        const recruit = makeCrew(randomChoice(Object.keys(CREW_ROLES)));
        run.crew.push(recruit);
        logEvent(`[${recruit.rarity}] ${withJosa(recruit.name, "을", "를")} ${withRoJosa(recruit.role)} 고용했다.`);
        showPort();
      },
    },
    {
      title: "선술집",
      cost: `금화 ${tavernPrice}`,
      copy: `사기 +${15 + (hasTrait("drunk") ? 5 : 0)}`,
      disabled: run.gold < tavernPrice || run.morale >= 100,
      action: () => {
        run.gold -= tavernPrice;
        const gain = 15 + (hasTrait("drunk") ? 5 : 0);
        run.morale = clamp(run.morale + gain, 0, 100);
        logEvent(`선술집에서 사기 +${gain}.`);
        showPort();
      },
    },
    {
      title: "수리도구",
      cost: `금화 ${kitPrice}`,
      copy: "전투 중 사용하는 수리도구 +1",
      disabled: run.gold < kitPrice,
      action: () => {
        run.gold -= kitPrice;
        run.repairKits += 1;
        logEvent("응급 수리도구를 구입했다.");
        showPort();
      },
    },
  ];
  options.forEach((option) => grid.append(makeChoiceButton(option)));
  ui.modalPanel.append(grid);
  addModalActions([{ label: "출항", primary: true, onClick: returnToMap }]);
  updateHud();
}

function completeAct() {
  const completedAct = ACTS[run.actIndex];
  if (run.actIndex >= ACTS.length - 1) {
    finishRun("위대한 항로의 끝에서 해적왕의 보물을 차지했습니다.", true);
    return;
  }

  run.mode = "interstitial";
  run.food += 4;
  run.water += 4;
  run.morale = clamp(run.morale + 8, 0, 100);
  setModalBase("SEA CONQUERED", `${completedAct.short} 정복`, "지배자의 깃발이 불타고 새로운 해도가 펼쳐집니다. 선원들은 다음 바다를 앞두고 짧은 승리를 나눕니다.");
  const stats = makeElement("div", "result-stats");
  [["보급", "+4"], ["사기", "+8"], ["다음 해역", `${run.actIndex + 2}/3`]].forEach(([label, value]) => {
    const cell = makeElement("div");
    cell.append(makeElement("span", "", label), makeElement("strong", "", value));
    stats.append(cell);
  });
  ui.modalPanel.append(stats);
  addModalActions([{ label: "다음 해역", primary: true, onClick: () => beginAct(run.actIndex + 1) }]);
  updateHud();
}

function checkDefeat() {
  if (!run) return false;
  if (run.hull <= 0) {
    if (run.safetyNetCharges > 0) {
      run.safetyNetCharges -= 1;
      run.hull = 1;
      run.morale = Math.max(0, run.morale - 10);
      logEvent(
        run.safetyNetCharges > 0
          ? "침몰 직전, 선원들이 필사적으로 선체 1을 지켜냈다. 구사일생이 한 번 더 남았다."
          : "침몰 직전, 선원들이 필사적으로 선체 1을 지켜냈다. 이번 항해의 구사일생은 이제 없다.",
      );
      playTone(220, 0.2, "sine", 0.05);
      Analytics.recordSafetyNet();
      updateHud();
      return false;
    }
    run.deathCause = "hull";
    finishRun("선체가 부서져 배와 보물이 바다 아래로 가라앉았습니다.", false);
    return true;
  }
  if (run.morale <= 0) {
    run.deathCause = "morale";
    finishRun("사기가 바닥나 선상 반란이 일어났습니다. 선장의 깃발이 끌어내려졌습니다.", false);
    return true;
  }
  return false;
}

function finishRun(reason, victory) {
  if (!run || run.banked) return;
  run.banked = true;
  run.mode = victory ? "victory" : "gameover";
  const previouslyUnlockedCaptains = new Set(CAPTAINS.filter(isCaptainUnlocked).map((item) => item.id));
  const previouslyUnlockedMaps = new Set(MAPS.filter(isMapUnlocked).map((item) => item.id));
  meta.legacyInfamy += run.infamy;
  meta.bestInfamy = Math.max(meta.bestInfamy, run.infamy);
  if (victory) {
    meta.victories += 1;
    if (!meta.clearedMapIds.includes(run.mapId)) meta.clearedMapIds.push(run.mapId);
  }
  saveMeta();
  const newlyUnlocked = [
    ...CAPTAINS.filter((item) => isCaptainUnlocked(item) && !previouslyUnlockedCaptains.has(item.id))
      .map((item) => ({ kind: "captain", eyebrow: "신규 선장 해금", name: item.name, detail: `${item.title} · ${item.description}` })),
    ...MAPS.filter((item) => isMapUnlocked(item) && !previouslyUnlockedMaps.has(item.id))
      .map((item) => ({ kind: "map", eyebrow: "신규 항로 해금", name: item.name, detail: `${item.difficulty} · ${item.subtitle}` })),
  ];
  Analytics.endRun({
    victory,
    deathCause: victory ? null : run.deathCause,
    mapId: run.mapId,
    act: run.actIndex,
    infamy: run.infamy,
    gold: run.gold,
    hull: run.hull,
    maxHull: run.maxHull,
    crew: run.crew.length,
    artifacts: run.artifacts.length,
    travelCount: run.travelCount,
  });
  updateHud();
  clearElement(ui.actionDock);
  canvas.classList.remove("map-active");

  setModalBase(victory ? "PIRATE KING" : "VOYAGE ENDED", victory ? "해적왕의 탄생" : "항해의 끝", reason);
  const stats = makeElement("div", "result-stats");
  [["획득 악명", run.infamy], ["최고 악명", meta.bestInfamy], ["정복 횟수", meta.victories]].forEach(([label, value]) => {
    const cell = makeElement("div");
    cell.append(makeElement("span", "", label), makeElement("strong", "", String(value)));
    stats.append(cell);
  });
  ui.modalPanel.append(stats);
  if (newlyUnlocked.length > 0) {
    ui.modalPanel.append(makeElement("div", "modal-divider"));
    newlyUnlocked.forEach((item) => {
      const banner = makeElement("div", "unlock-banner");
      banner.append(
        makeElement("span", "unlock-banner-eyebrow", item.eyebrow),
        makeElement("h3", "", item.name),
        makeElement("p", "", item.detail),
      );
      ui.modalPanel.append(banner);
    });
  }
  addModalActions([{ label: "거점 섬으로", primary: true, onClick: showHarbor }]);
  playTone(victory ? 720 : 72, victory ? 0.35 : 0.45, victory ? "triangle" : "sawtooth", 0.055);
  if (newlyUnlocked.length > 0) {
    setTimeout(() => playTone(1180, 0.3, "triangle", 0.05), 260);
  }
}

function confirmAbandonVoyage() {
  if (!run) {
    showHarbor();
    return;
  }
  if (["gameover", "victory", "title"].includes(run.mode)) {
    showHarbor();
    return;
  }

  const previousMode = run.mode;
  setModalBase("ABANDON VOYAGE", "항해를 포기합니까?", "이번 항해에서 모은 악명과 유물은 전승되지 않습니다.");
  addModalActions([
    { label: "계속 항해", onClick: () => { closeModal(); run.mode = previousMode; renderActionDock(); } },
    {
      label: "항해 포기",
      primary: true,
      onClick: () => {
        Analytics.endRun({
          victory: false,
          deathCause: "abandoned",
          mapId: run.mapId,
          act: run.actIndex,
          infamy: run.infamy,
          gold: run.gold,
          hull: run.hull,
          maxHull: run.maxHull,
          crew: run.crew.length,
          artifacts: run.artifacts.length,
          travelCount: run.travelCount,
        });
        showHarbor();
      },
    },
  ]);
}

const ACTION_LABELS = {
  fire: "선체 포격",
  chain: "사슬탄",
  approach: "접근 기동",
  retreat: "회피 기동",
  repair: "응급수리",
  board: "접안 공격",
  skill: "선장 기술",
};

const DEATH_CAUSE_LABELS = {
  hull: "선체 파손",
  morale: "선상 반란",
  abandoned: "항해 포기",
};

function captainName(id) {
  return CAPTAINS.find((item) => item.id === id)?.name || id;
}

function statsRow(cells) {
  const row = makeElement("div", "stats-row");
  cells.forEach((text, index) => row.append(makeElement("span", index === 0 ? "stats-row-label" : "", text)));
  return row;
}

function showStats() {
  const summary = Analytics.getSummary();
  setModalBase(
    "VOYAGE LOG",
    "항해 기록 분석",
    "지금까지의 모든 항해 결과가 브라우저에 저장됩니다. 언제든 JSON으로 내보내 별도로 분석할 수 있습니다.",
    false,
  );

  if (summary.totalRuns === 0) {
    ui.modalPanel.append(makeElement("p", "empty-state", "아직 기록된 항해가 없습니다. 항해를 마치면 이곳에 결과가 쌓입니다."));
    addModalActions([{ label: "닫기", primary: true, onClick: closeModal }]);
    return;
  }

  const overview = makeElement("div", "result-stats");
  [
    ["총 항해", summary.totalRuns],
    ["승리", summary.victories],
    ["승률", `${Math.round(summary.winRate * 100)}%`],
    ["평균 악명", summary.avgInfamy.toFixed(1)],
    ["최고 악명", summary.bestInfamy],
    ["평균 이동 수", summary.avgTravelCount.toFixed(1)],
    ["구사일생 사용", summary.safetyNetUses],
  ].forEach(([label, value]) => {
    const cell = makeElement("div");
    cell.append(makeElement("span", "", label), makeElement("strong", "", String(value)));
    overview.append(cell);
  });
  ui.modalPanel.append(overview);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const captainHead = makeElement("div", "legacy-head");
  captainHead.append(makeElement("h3", "", "선장별 성과"));
  ui.modalPanel.append(captainHead);
  const captainTable = makeElement("div", "stats-table");
  Object.entries(summary.byCaptain).forEach(([captainId, entry]) => {
    captainTable.append(statsRow([
      captainName(captainId),
      `${entry.runs}회`,
      `승률 ${Math.round(entry.winRate * 100)}%`,
      `평균 악명 ${entry.avgInfamy.toFixed(1)}`,
    ]));
  });
  ui.modalPanel.append(captainTable);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const mapStatsHead = makeElement("div", "legacy-head");
  mapStatsHead.append(makeElement("h3", "", "항로별 성과"));
  ui.modalPanel.append(mapStatsHead);
  const mapTable = makeElement("div", "stats-table");
  Object.entries(summary.byMap).forEach(([mapId, entry]) => {
    mapTable.append(statsRow([
      mapName(mapId),
      `${entry.runs}회`,
      `승률 ${Math.round(entry.winRate * 100)}%`,
      `평균 악명 ${entry.avgInfamy.toFixed(1)}`,
    ]));
  });
  ui.modalPanel.append(mapTable);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const deathHead = makeElement("div", "legacy-head");
  deathHead.append(makeElement("h3", "", "사망 원인"));
  ui.modalPanel.append(deathHead);
  const deathTable = makeElement("div", "stats-table");
  const deathEntries = Object.entries(summary.deathCauses).filter(([, count]) => count > 0);
  if (deathEntries.length === 0) {
    deathTable.append(makeElement("p", "empty-state", "기록된 패배가 없습니다."));
  } else {
    deathEntries.forEach(([cause, count]) => {
      deathTable.append(statsRow([DEATH_CAUSE_LABELS[cause] || cause, `${count}회`]));
    });
  }
  ui.modalPanel.append(deathTable);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const actionHead = makeElement("div", "legacy-head");
  actionHead.append(makeElement("h3", "", "자주 사용한 전투 명령"));
  ui.modalPanel.append(actionHead);
  const actionTable = makeElement("div", "stats-table");
  Object.entries(summary.actionTotals)
    .sort((left, right) => right[1] - left[1])
    .forEach(([action, count]) => {
      actionTable.append(statsRow([ACTION_LABELS[action] || action, `${count}회`]));
    });
  ui.modalPanel.append(actionTable);

  ui.modalPanel.append(makeElement("div", "modal-divider"));
  const recentHead = makeElement("div", "legacy-head");
  recentHead.append(makeElement("h3", "", "최근 항해"));
  ui.modalPanel.append(recentHead);
  const recentTable = makeElement("div", "stats-table");
  summary.recent.forEach((pastRun) => {
    const date = new Date(pastRun.startedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const result = pastRun.victory ? "승리" : (DEATH_CAUSE_LABELS[pastRun.deathCause] || "패배");
    recentTable.append(statsRow([
      date,
      captainName(pastRun.captainId),
      mapName(pastRun.mapId || "calm"),
      result,
      `${pastRun.finalAct + 1}해역`,
      `악명 ${pastRun.finalInfamy}`,
    ]));
  });
  ui.modalPanel.append(recentTable);

  addModalActions([
    { label: "닫기", onClick: closeModal },
    { label: "기록 초기화", onClick: confirmClearAnalytics },
    { label: "JSON 내보내기", primary: true, onClick: () => Analytics.exportJSON() },
  ]);
}

function confirmClearAnalytics() {
  setModalBase("RESET LOG", "항해 기록을 초기화합니까?", "저장된 모든 항해 통계가 삭제됩니다. 되돌릴 수 없습니다.");
  addModalActions([
    { label: "취소", onClick: showStats },
    { label: "초기화", primary: true, onClick: () => { Analytics.clearAll(); showStats(); } },
  ]);
}

function drawOcean(palette, time, combatScene = false) {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, canvas.width, combatScene ? 310 : canvas.height);

  ctx.fillStyle = palette.deep;
  if (combatScene) {
    ctx.fillRect(0, 310, canvas.width, canvas.height - 310);
  } else {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (combatScene) {
    ctx.fillStyle = "rgba(235, 229, 205, 0.18)";
    for (let index = 0; index < 5; index += 1) {
      const x = ((index * 290 + time * 0.012) % 1450) - 120;
      const y = 75 + (index % 3) * 62;
      ctx.beginPath();
      ctx.arc(x, y, 42, Math.PI, 0);
      ctx.arc(x + 48, y - 8, 52, Math.PI, 0);
      ctx.arc(x + 96, y, 38, Math.PI, 0);
      ctx.fill();
    }
  }

  const top = combatScene ? 310 : 0;
  ctx.fillStyle = palette.sea;
  ctx.fillRect(0, top, canvas.width, canvas.height - top);
  ctx.lineWidth = 2;
  for (let row = 0; row < 12; row += 1) {
    const y = top + 18 + row * 42;
    ctx.strokeStyle = row % 2 === 0 ? `${palette.foam}55` : "rgba(4, 23, 31, 0.28)";
    ctx.beginPath();
    for (let x = -40; x <= canvas.width + 40; x += 36) {
      const waveY = y + Math.sin((x + time * (0.03 + row * 0.001)) / 32) * 5;
      if (x === -40) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }
}

function drawMap(time) {
  const palette = ACTS[run?.actIndex || 0];
  drawOcean(palette, time, false);
  if (!run?.map) {
    const previewCaptain = CAPTAINS.find((item) => item.id === selectedCaptainId) || CAPTAINS[0];
    drawShip(250, 480, 1.3, false, previewCaptain.coat, PLAYER_SHIP_IMAGES[previewCaptain.id]);
    drawIslandSilhouette(880, 420, 1.3);
    return;
  }

  const current = currentNode();
  const available = new Set(availableNodes().map((node) => node.id));

  ctx.save();
  ctx.lineWidth = 3;
  run.map.nodes.forEach((node) => {
    node.next.forEach((nextId) => {
      const next = run.map.nodes.find((candidate) => candidate.id === nextId);
      const active = node.id === current.id && available.has(next.id);
      ctx.setLineDash(active ? [10, 8] : [4, 10]);
      ctx.strokeStyle = active ? `${palette.accent}` : "rgba(215, 226, 218, 0.24)";
      ctx.beginPath();
      ctx.moveTo(node.x + 26, node.y);
      ctx.bezierCurveTo(node.x + 75, node.y, next.x - 75, next.y, next.x - 26, next.y);
      ctx.stroke();
    });
  });
  ctx.restore();

  run.map.nodes.forEach((node) => drawMapNode(node, current, available, time));
  drawShip(current.x - 4, current.y - 47, 0.54, false, captain().coat);

  mapClickRipples = mapClickRipples.filter((ripple) => ripple.progress < 1);
  mapClickRipples.forEach((ripple) => {
    ripple.progress += 0.05;
    const radius = 22 + ripple.progress * 46;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 241, 204, ${1 - ripple.progress})`;
    ctx.lineWidth = 3 * (1 - ripple.progress) + 1;
    ctx.stroke();
  });

  ctx.fillStyle = "rgba(4, 18, 24, 0.72)";
  ctx.fillRect(22, 20, 306, 62);
  ctx.fillStyle = "#f2dfbb";
  ctx.font = "700 20px Georgia, serif";
  ctx.fillText(ACTS[run.actIndex].short, 40, 48);
  ctx.fillStyle = "#a8bcb9";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("검은 깃발 아래, 미지의 항로가 열린다", 40, 69);
}

function drawMapNode(node, current, available, time) {
  const type = NODE_TYPES[node.type];
  const isCurrent = node.id === current.id;
  const isAvailable = available.has(node.id);
  const radius = node.type === "boss" ? 30 : 24;
  const pulse = isAvailable ? Math.sin(time * 0.006 + node.y) * 3 : 0;

  if (isAvailable) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 8 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `${type.color}88`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = node.visited ? "#172a2e" : "#10272e";
  ctx.fill();
  ctx.strokeStyle = isCurrent ? "#fff1cc" : isAvailable ? type.color : "#5f767b";
  ctx.lineWidth = isCurrent ? 4 : 2;
  ctx.stroke();

  ctx.fillStyle = isCurrent ? "#fff1cc" : type.color;
  ctx.font = `800 ${node.type === "boss" ? 14 : 16}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type.mark, node.x, node.y + 1);

  if (isAvailable || isCurrent) {
    ctx.fillStyle = "rgba(5, 20, 26, 0.86)";
    ctx.fillRect(node.x - 52, node.y + 34, 104, 22);
    ctx.fillStyle = "#e7ddc9";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(isCurrent ? "현재 위치" : type.name, node.x, node.y + 45);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawIslandSilhouette(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#142f2c";
  ctx.beginPath();
  ctx.moveTo(-140, 80);
  ctx.lineTo(-90, 32);
  ctx.lineTo(-58, 46);
  ctx.lineTo(-22, -25);
  ctx.lineTo(8, 18);
  ctx.lineTo(42, -70);
  ctx.lineTo(75, 16);
  ctx.lineTo(112, 44);
  ctx.lineTo(150, 80);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#203b2f";
  ctx.fillRect(-150, 80, 310, 22);
  ctx.restore();
}

function enemyShipImagePath(enemy) {
  const paths = enemy.shipImages?.filter(Boolean) || [];
  if (paths.length <= 1) return paths[0] || null;
  const hullRatio = clamp(enemy.hull / enemy.maxHull, 0, 1);
  if (hullRatio <= 0.33) return paths[2] || paths[paths.length - 1];
  if (hullRatio <= 0.66) return paths[1] || paths[0];
  return paths[0];
}

function drawShip(x, y, scale, flip, color, imagePath = null) {
  const image = getShipImage(imagePath);
  ctx.save();
  ctx.translate(x, y);
  if (image) {
    // 생성된 선박 원본은 모두 왼쪽을 바라본다. 플레이어만 적을 향하도록 반전한다.
    ctx.scale(flip ? scale : -scale, scale);
    ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;
    ctx.drawImage(image, -112, -170, 224, 224);
    ctx.restore();
    return;
  }
  ctx.scale(flip ? -scale : scale, scale);

  ctx.fillStyle = "#2c211b";
  ctx.beginPath();
  ctx.moveTo(-74, 22);
  ctx.lineTo(78, 22);
  ctx.lineTo(52, 54);
  ctx.lineTo(-48, 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color || "#8c3c34";
  ctx.fillRect(-54, 28, 112, 9);
  ctx.fillStyle = "#111c20";
  for (let index = 0; index < 5; index += 1) {
    ctx.beginPath();
    ctx.arc(-36 + index * 23, 36, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#39271c";
  ctx.fillRect(-3, -78, 6, 102);
  ctx.fillStyle = "#e7dbc2";
  ctx.beginPath();
  ctx.moveTo(5, -66);
  ctx.lineTo(5, 8);
  ctx.lineTo(58, 3);
  ctx.lineTo(22, -57);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#927c5e";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color || "#8c3c34";
  ctx.beginPath();
  ctx.moveTo(2, -78);
  ctx.lineTo(38, -65);
  ctx.lineTo(2, -53);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCombat(time) {
  const palette = ACTS[run?.actIndex || 0];
  ctx.save();
  if (shakeMagnitude > 0.3) {
    ctx.translate((Math.random() - 0.5) * shakeMagnitude, (Math.random() - 0.5) * shakeMagnitude);
  }
  drawOcean(palette, time, true);
  if (!run?.combat) {
    ctx.restore();
    shakeMagnitude *= 0.85;
    return;
  }
  const combat = run.combat;
  const enemy = focusedEnemy();
  if (!enemy) {
    ctx.restore();
    shakeMagnitude *= 0.85;
    return;
  }
  const rangePositions = { 1: 735, 2: 900, 3: 1060 };
  const enemyX = rangePositions[enemyRange(enemy.id)];
  const bobPlayer = Math.sin(time * 0.003) * 4;
  const bobEnemy = Math.sin(time * 0.003 + 1.7) * 5;

  drawShip(220, 468 + bobPlayer, 1.35, false, captain().coat, PLAYER_SHIP_IMAGES[captain().id]);
  drawShip(
    enemyX,
    452 + bobEnemy,
    enemy.kind === "boss" ? 1.7 : 1.42,
    true,
    enemy.kind === "boss" ? "#5d2528" : "#394e51",
    enemyShipImagePath(enemy),
  );

  drawCombatHud(36, 42, captain().ship, run.hull, run.maxHull, run.sails, run.maxSails, "#e0ae4b");
  drawCombatHud(754, 42, enemy.name, enemy.hull, enemy.maxHull, enemy.sails, enemy.maxSails, "#c7564d");

  ctx.fillStyle = "rgba(7, 22, 29, 0.82)";
  ctx.fillRect(472, 42, 256, 72);
  ctx.fillStyle = "#9fb1af";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("풍향", 492, 65);
  ctx.fillText("거리", 492, 94);
  ctx.fillStyle = "#f2dfba";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText(`${combat.wind.direction} ${"▸".repeat(combat.wind.speed)}`, 548, 67);
  ctx.fillText(`${enemyRange(enemy.id)} / 3`, 548, 96);

  ctx.strokeStyle = "rgba(238, 220, 186, 0.45)";
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.moveTo(335, 550);
  ctx.lineTo(enemyX - 115, 550);
  ctx.stroke();
  ctx.setLineDash([]);

  visualEffects = visualEffects.filter((effect) => effect.progress < 1.2);
  visualEffects.forEach((effect) => {
    effect.progress += effect.speed;

    if (effect.type === "flash") {
      const p = clamp(effect.progress, 0, 1);
      const x = effect.source === "player" ? 322 : enemyX - 95;
      const gradient = ctx.createRadialGradient(x, 453, 2, x, 453, 34);
      gradient.addColorStop(0, `rgba(255, 248, 207, ${0.95 * (1 - p)})`);
      gradient.addColorStop(0.4, `rgba(255, 167, 61, ${0.78 * (1 - p)})`);
      gradient.addColorStop(1, "rgba(255, 91, 35, 0)");
      ctx.beginPath();
      ctx.arc(x, 453, 34, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      return;
    }

    if (effect.type === "smoke") {
      const p = clamp(effect.progress, 0, 1);
      const originX = effect.source === "player" ? 322 : enemyX - 95;
      const direction = effect.source === "player" ? 1 : -1;
      const x = originX + direction * effect.progress * 54 + effect.drift * p;
      const y = 453 + effect.offset - effect.progress * 42;
      const radius = 5 + p * 17;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(78, 84, 82, ${0.34 * (1 - p)})`;
      ctx.fill();
      return;
    }

    if (effect.type === "impact") {
      const p = clamp(effect.progress, 0, 1);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 8 + p * 38, 0, Math.PI * 2);
      ctx.strokeStyle = effect.missed
        ? `rgba(148, 222, 239, ${0.72 * (1 - p)})`
        : `rgba(255, 194, 92, ${0.9 * (1 - p)})`;
      ctx.lineWidth = 5 * (1 - p) + 1;
      ctx.stroke();
      return;
    }

    if (effect.type === "vignette") {
      const p = clamp(effect.progress, 0, 1);
      const gradient = ctx.createRadialGradient(600, 350, 190, 600, 350, 680);
      gradient.addColorStop(0, "rgba(114, 17, 14, 0)");
      gradient.addColorStop(1, `rgba(157, 28, 19, ${0.38 * (1 - p)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (effect.type === "spark") {
      const p = clamp(effect.progress, 0, 1);
      const x = effect.x + effect.vx * effect.progress * 22;
      const y = effect.y + effect.vy * effect.progress * 22;
      ctx.beginPath();
      ctx.arc(x, y, 3 * (1 - p) + 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${170 + Math.floor(70 * (1 - p))}, 110, ${1 - p})`;
      ctx.fill();
      return;
    }

    const startX = effect.source === "player" ? 322 : enemyX - 95;
    const endX = effect.source === "player" ? enemyX - 92 : 322;
    const x = startX + (endX - startX) * effect.progress;
    const arc = Math.sin(effect.progress * Math.PI) * -95;
    const y = 453 + arc + effect.offset + effect.missOffset * Math.max(0, effect.progress);
    const previousProgress = Math.max(0, effect.progress - 0.08);
    const previousX = startX + (endX - startX) * previousProgress;
    const previousY = 453
      + Math.sin(previousProgress * Math.PI) * -95
      + effect.offset
      + effect.missOffset * previousProgress;
    const trail = ctx.createLinearGradient(previousX, previousY, x, y);
    trail.addColorStop(0, "rgba(255, 177, 73, 0)");
    trail.addColorStop(1, "rgba(255, 218, 145, 0.82)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(previousX, previousY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = effect.source === "player" ? "#211b17" : "#3a1a18";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    if (!effect.hit && effect.progress >= 0.97) {
      effect.hit = true;
      visualEffects.push({ type: "impact", x, y, missed: effect.missed, progress: 0, speed: 0.055 });
      if (effect.missed) {
        spawnImpactSparks(x, y, 3);
      } else {
        spawnImpactSparks(x, y, 10);
        triggerShake(effect.source === "player" ? 6 : 8);
        if (effect.source === "enemy") {
          visualEffects.push({ type: "vignette", progress: 0, speed: 0.045 });
        }
      }
    }
  });

  ctx.fillStyle = "rgba(6, 20, 25, 0.82)";
  ctx.fillRect(410, 606, 380, 54);
  ctx.fillStyle = "#d9c9ab";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`적 선원 ${Math.max(0, enemy.crew)} · 우리 선원 전투력 ${getCrewPower()} · ${combat.turn}턴`, 600, 638);
  ctx.textAlign = "left";
  ctx.restore();
  shakeMagnitude *= 0.85;
}

function drawCombatHud(x, y, name, hull, maxHull, sails, maxSails, accent) {
  ctx.fillStyle = "rgba(7, 22, 29, 0.84)";
  ctx.fillRect(x, y, 410, 96);
  ctx.fillStyle = "#f3e4c7";
  ctx.font = "700 18px Georgia, serif";
  ctx.fillText(name, x + 16, y + 27);
  const hullRatio = clamp(hull / maxHull, 0, 1);
  const sailRatio = clamp(sails / maxSails, 0, 1);
  ctx.fillStyle = "#08181e";
  ctx.fillRect(x + 16, y + 42, 300, 10);
  ctx.fillRect(x + 16, y + 66, 300, 8);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 16, y + 42, 300 * hullRatio, 10);
  ctx.fillStyle = "#58a9bf";
  ctx.fillRect(x + 16, y + 66, 300 * sailRatio, 8);
  ctx.fillStyle = "#b8c2be";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText(`선체 ${Math.max(0, hull)}/${maxHull}`, x + 325, y + 51);
  ctx.fillText(`돛 ${Math.max(0, sails)}/${maxSails}`, x + 325, y + 75);
}

function renderFrame(time) {
  const delta = Math.min(40, time - lastFrame);
  lastFrame = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (run?.combat && ["combat", "reward", "gameover"].includes(run.mode)) drawCombat(time + delta);
  else drawMap(time + delta);
  requestAnimationFrame(renderFrame);
}

canvas.addEventListener("click", (event) => {
  if (!run || run.mode !== "map") return;
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
  const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
  const target = availableNodes().find((node) => Math.hypot(node.x - x, node.y - y) <= 36);
  if (target) {
    mapClickRipples.push({ x: target.x, y: target.y, progress: 0 });
    travelTo(target.id);
  }
});

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const bounds = button.getBoundingClientRect();
  const ripple = makeElement("span", "interaction-ripple");
  const size = Math.max(bounds.width, bounds.height) * 1.7;
  ripple.setAttribute("aria-hidden", "true");
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - bounds.left - size / 2}px`;
  ripple.style.top = `${event.clientY - bounds.top - size / 2}px`;
  button.append(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();

  if (!ui.modalLayer.hidden) {
    const choices = [...ui.modalPanel.querySelectorAll(".modal-choice:not(:disabled)")];
    const index = Number.parseInt(key, 10) - 1;
    if (Number.isInteger(index) && choices[index]) choices[index].click();
    if (key === "enter") ui.modalPanel.querySelector(".primary-button:not(:disabled)")?.click();
    return;
  }

  if (run?.mode === "map") {
    const index = Number.parseInt(key, 10) - 1;
    const nodes = availableNodes();
    if (Number.isInteger(index) && nodes[index]) travelTo(nodes[index].id);
  }

  if (run?.mode === "combat") {
    const commands = { f: "fire", s: "chain", a: "approach", d: "retreat", r: "repair", b: "board", q: "skill" };
    if (commands[key]) combatAction(commands[key]);
  }
});

ui.soundButton.addEventListener("click", () => {
  muted = !muted;
  ui.soundButton.classList.toggle("is-muted", muted);
  ui.soundButton.title = muted ? "소리 켜기" : "소리 끄기";
  ui.soundButton.setAttribute("aria-label", ui.soundButton.title);
  if (!muted) playTone(520, 0.07, "triangle");
});

ui.newVoyageButton.addEventListener("click", confirmAbandonVoyage);
ui.statsButton.addEventListener("click", showStats);

showHarbor();
requestAnimationFrame(renderFrame);
