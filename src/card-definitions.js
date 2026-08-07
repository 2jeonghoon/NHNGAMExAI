"use strict";

const CardDefinitions = (() => {
  const CARD_RARITY_WEIGHTS = Object.freeze({ normal: 0.55, rare: 0.30, epic: 0.15 });
  const STARTER_DECK = Object.freeze([
    "fire", "fire", "fire", "chain", "chain",
    "approach", "approach", "retreat", "repair", "board",
  ]);

  const card = (id, name, family, cost, rarity, captainId, targetType, exhaust, description) => Object.freeze({
    id, name, family, cost, rarity, captainId, targetType, exhaust, effect: id, description,
  });

  const definitions = [
    card("fire", "선체 포격", "포격", 1, "normal", null, "enemy", false, "현재 명중률로 기존 선체 포격을 수행한다."),
    card("aimed_fire", "조준 포격", "포격", 2, "rare", null, "enemy", false, "포격 명중률 +15%p, cannonDamage() + 6 선체 피해"),
    card("rapid_fire", "속사포", "포격", 0, "epic", null, "enemy", false, "포격 명중률로 cannonDamage()의 60% 선체 피해(최소 1), 카드 1장 드로우"),
    card("chain", "사슬탄", "사슬탄", 1, "normal", null, "enemy", false, "현재 명중률로 기존 돛 공격을 수행한다."),
    card("heavy_chain", "중사슬탄", "사슬탄", 2, "rare", null, "enemy", false, "사슬탄 명중률로 기존 사슬탄 피해 +8"),
    card("entangling_chain", "얽힘탄", "사슬탄", 1, "epic", null, "enemy", false, "사슬탄 명중률로 3~6 + 포수 보너스 돛 피해, 다음 적 턴의 거리 이동 차단"),
    card("approach", "접근 기동", "접근", 1, "normal", null, "sea", false, "기존 확률로 거리 1단계에 접근한다."),
    card("tailwind_charge", "순풍 돌입", "접근", 0, "rare", null, "sea", false, "순풍일 때만 사용하며 접근 후 카드 1장을 뽑는다."),
    card("ram", "충각 돌진", "접근", 2, "epic", null, "sea", false, "기존 접근 판정 성공 시 거리 -1, 적 선체 8 피해, 자신의 선체 3 피해"),
    card("retreat", "회피 기동", "회피", 1, "normal", null, "sea", false, "거리를 벌리고 기존 회피율을 얻는다."),
    card("hard_turn", "급선회", "회피", 0, "rare", null, "sea", false, "이번 적 턴 회피율 15%, 카드 1장 드로우. 거리는 바꾸지 않는다."),
    card("smoke_sail", "연막 항해", "회피", 2, "epic", null, "sea", false, "거리를 3으로 만들고 이번 적 턴 회피율 50%"),
    card("repair", "응급수리", "수리", 1, "normal", null, "self", false, "수리도구 1개로 기존 선체와 돛을 복구한다."),
    card("rigging_repair", "돛줄 정비", "수리", 0, "rare", null, "self", false, "수리도구 없이 돛 4 회복"),
    card("overhaul", "대수선", "수리", 2, "epic", null, "self", false, "수리도구 1개로 14 + 수리공 보너스 선체와 돛 6 회복"),
    card("board", "접안 공격", "접안", 2, "normal", null, "enemy", false, "기존 거리·돛 조건과 확률로 함선 나포를 시도한다."),
    card("grappling_hook", "갈고리 투척", "접안", 1, "rare", null, "enemy", false, "거리 1에서 지정한 적의 돛 5 피해"),
    card("desperate_board", "결사 돌입", "접안", 3, "epic", null, "enemy", false, "거리 1이면 적 돛 조건을 무시하고 기존 접안 확률 -15%p(15~75%)로 나포 시도"),
    card("barrage_fire", "탄막 사격", "광역", 2, "rare", null, "allEnemies", false, "각 적에게 포격 명중률 -10%p로 cannonDamage()의 60% 선체 피해"),
    card("chain_rain", "사슬 폭우", "광역", 2, "rare", null, "allEnemies", false, "각 적에게 사슬탄 명중률 -10%p로 5 + 포수 보너스 돛 피해"),
    card("fireship", "화공선 방출", "광역", 3, "epic", null, "allEnemies", true, "모든 적에게 명중 보장 선체 10·돛 5 피해, 사기 4 감소"),

    card("gunner_steady_aim", "준비 사격", "포격", 0, "normal", "gunner", "self", false, "다음 포격·사슬탄 명중률 +15%p, 카드 1장 드로우"),
    card("gunner_shrapnel", "파편탄", "포격", 1, "normal", "gunner", "enemy", false, "포격 명중률로 cannonDamage()의 60% 선체 피해(최소 1), 적 선원 2 피해"),
    card("gunner_double_broadside", "연속 포격", "포격", 2, "rare", "gunner", "enemy", false, "포격 명중률로 각각 cannonDamage()의 70% 피해를 주는 포격 2회"),
    card("gunner_powder_shift", "화약 재분배", "포격", 1, "rare", "gunner", "sea", false, "뽑기 더미에서 무작위 포격 카드 1장을 찾아 뽑고 이번 턴 비용 1 감소. 대상이 없으면 효과 없음."),
    card("gunner_overcharge", "과충전 포탄", "포격", 2, "epic", "gunner", "enemy", false, "포격 명중률로 cannonDamage() + 8 선체와 돛 5 피해, 자신의 돛 3 피해"),
    card("gunner_magazine_open", "화약고 개방", "포격", 3, "epic", "gunner", "enemy", true, "명중이 보장되는 18 + getCannonPower() 선체 피해, 자신의 선체 6 피해"),
    card("gunner_fleet_broadside", "전 함대 포문 개방", "포격", 3, "epic", "gunner", "allEnemies", true, "모든 적에게 10 + getCannonPower() × 0.5 선체 피해와 돛 3 피해, 자신의 선체 4 피해"),

    card("navigator_read_wind", "바람 읽기", "항해", 0, "normal", "navigator", "sea", false, "바람을 다시 결정하고 순풍이면 에너지 1 획득"),
    card("navigator_raise_sails", "돛 펼치기", "항해", 1, "normal", "navigator", "self", false, "돛 5 회복, 카드 1장 드로우"),
    card("navigator_crosswind_turn", "측풍 선회", "항해", 1, "rare", "navigator", "sea", false, "모든 살아 있는 적과의 거리를 2로 만들고 이번 적 턴 회피율 20%"),
    card("navigator_wave_ride", "파도타기", "항해", 0, "rare", "navigator", "self", true, "돛이 절반 이상이면 카드 2장 드로우"),
    card("navigator_tailwind_route", "순풍 항로", "항해", 2, "epic", "navigator", "sea", false, "현재와 다음 플레이어 턴까지 순풍 유지"),
    card("navigator_reposition", "완전 재배치", "항해", 2, "epic", "navigator", "sea", false, "모든 살아 있는 적과의 거리를 1 또는 3 중에서 선택하고 이번 적 턴 회피율 60% 획득"),
    card("navigator_storm_corridor", "폭풍의 회랑", "항해", 2, "epic", "navigator", "allEnemies", false, "모든 적의 돛 7 피해, 모든 적과의 거리 +1, 이번 적 턴 회피율 30%"),

    card("mystic_abyss_mark", "심연의 표식", "주술", 1, "normal", "mystic", "enemy", false, "적이 다음 두 번 받는 선체 피해 각각 +4"),
    card("mystic_cursed_tide", "저주받은 조류", "주술", 1, "normal", "mystic", "enemy", false, "적 선체 4, 돛 6, 선원 2 피해"),
    card("mystic_fear_whisper", "공포의 속삭임", "주술", 1, "rare", "mystic", "self", false, "다음 적 공격 피해 40% 감소, 사기 3 회복"),
    card("mystic_dark_prophecy", "검은 예언", "주술", 0, "rare", "mystic", "self", true, "카드 2장 드로우"),
    card("mystic_blood_pact", "피의 계약", "주술", 0, "epic", "mystic", "self", true, "사기 5를 잃고 에너지 2 획득"),
    card("mystic_open_abyss", "심연 개방", "주술", 3, "epic", "mystic", "enemy", false, "적 선체 12, 돛 10, 선원 4 피해"),
    card("mystic_abyss_chorus", "심연의 합창", "주술", 3, "epic", "mystic", "allEnemies", true, "모든 적에게 선체 8·돛 8·선원 3 피해, 적 한 척당 사기 2 회복"),

    card("revenant_dead_nails", "망자의 못질", "망령", 1, "normal", "revenant", "self", false, "수리도구 없이 선체 5 회복, 사기 2 감소"),
    card("revenant_ghost_deckhand", "유령 갑판원", "망령", 1, "normal", "revenant", "self", false, "이번 턴 접안 전투력 +8"),
    card("revenant_soul_drain", "영혼 흡수", "망령", 2, "rare", "revenant", "enemy", false, "지정한 적의 선체 10 피해, 자신의 선체 6 회복"),
    card("revenant_sinking_memory", "침몰의 기억", "망령", 0, "rare", "revenant", "self", true, "선체가 절반 이하면 카드 2장과 에너지 1 획득"),
    card("revenant_death_delay", "죽음 유예", "망령", 1, "epic", "revenant", "self", true, "다음 치명적 피해를 한 번 막고 선체 1로 생존"),
    card("revenant_return_abyss", "심연 귀환", "망령", 3, "epic", "revenant", "enemy", false, "지정한 적의 선체 18 피해와 자신의 선체 12 회복, 대상이 생존하면 사기 6 감소"),
    card("revenant_ghost_fleet", "망령 함대", "망령", 3, "epic", "revenant", "allEnemies", true, "모든 적에게 선체 10 피해, 적 한 척당 자신의 선체 3 회복"),
  ];

  const CARD_DEFINITIONS = Object.freeze(Object.fromEntries(definitions.map((definition) => [definition.id, definition])));

  function getCard(cardId) {
    return Object.hasOwn(CARD_DEFINITIONS, cardId) ? CARD_DEFINITIONS[cardId] : null;
  }

  function getRewardPool(captainId) {
    return definitions.filter((definition) => !definition.captainId || definition.captainId === captainId);
  }

  return Object.freeze({ CARD_DEFINITIONS, STARTER_DECK, CARD_RARITY_WEIGHTS, getCard, getRewardPool });
})();
