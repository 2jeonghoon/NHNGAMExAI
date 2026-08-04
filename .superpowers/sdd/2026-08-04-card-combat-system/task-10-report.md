# Task 10 Report

## Status

DONE_WITH_CONCERNS

Analytics and documentation implementation is complete with RED → GREEN coverage. Browser QA is deferred to the controller because the in-app browser connected and loaded the local game, but the first verification call stalled and was interrupted; the controller explicitly directed that browser tooling not be attempted again.

## Commit Verification

- Commit: `9288221 feat(cards): record and document card combat runs`.
- Exact committed scope: `README.md`, `src/analytics.js`, `src/game.js`, and `tests/analytics-cards.test.js`.
- Commit diff: 4 files changed, 240 insertions, 9 deletions.
- Worktree status after the controller commit: clean.
- The remaining `DONE_WITH_CONCERNS` status applies only to the deferred controller Browser QA described below.

## Implementation

- Added serializable card-use, acquisition, removal, energy, target, player-turn, fleet-result, capture-count, and final-deck analytics.
- Preserved legacy action totals, legacy card progression event IDs, old stored-run fallbacks, and boolean capture compatibility.
- Wired actual discounted card energy, affected enemy count, player turn endings, one fleet result per encounter, capture totals by count, and final decks into game analytics.
- Updated README card controls, drag instructions, turn shortcuts, and route fleet limits.

## RED → GREEN Evidence

- Initial `node --test tests/analytics-cards.test.js`: 2 failures because `Analytics.recordCardUse` was missing.
- Analytics unit GREEN: 2/2 passed.
- Game-wiring RED: 2 failures for absent card/turn/fleet/final-deck wiring.
- Discounted-energy RED: 1 failure (recorded base cost 2 instead of actual cost 1).
- Targeted GREEN: 4/4 passed after wiring actual energy and encounter data.
- Regression RED found and fixed: legacy card progression event IDs were no longer emitted when dedicated recorders existed.
- Read-only review found three Important issues. New RED tests reproduced missing winning-turn telemetry and AoE misses counted as hits; fixes now count turns when they begin, store per-combat turn counts, count only positive enemy damage, and keep legacy card events fallback-only. No Critical findings remained.

## Automated Verification

- `node --test tests/*.test.js`: 159 passed, 0 failed.
- `node --check src/analytics.js`: exit 0.
- `node --check src/card-definitions.js`: exit 0.
- `node --check src/card-engine.js`: exit 0.
- `node --check src/fleet-combat.js`: exit 0.
- `node --check src/game.js`: exit 0.
- `git diff --check`: exit 0, no output.

## Browser Verification Deferred

The in-app browser runtime was available and successfully loaded `http://127.0.0.1:5192/` at the harbor screen. No gameplay checklist item was completed before the stalled call was interrupted. The controller must complete all 12 Task 10 browser checks at desktop and 320px, including console errors and reduced motion.

Carry these concerns into controller QA:

- Real 320px overflow/clipping and stale flying-callback cancellation.
- Tooltip firepower copy versus chain-shot scaling; food/water/morale copy versus the stoic trait; accessible tooltip names versus live values; narrow tooltip bounds and forced-colors focus.
- `aria-grabbed` reset after drag completion/cancel.
- The earlier exhaustion test not forcing a recycle remains outside Task 10 scope.

## Fix Round 1

- Finding: gameplay counted actions separately and passed a null family to `recordCardUse`, while Navigator, Mystic, and Revenant families fell back to per-card action keys.
- RED: `node --test tests/analytics-cards.test.js` failed 3/6 tests; gameplay emitted separate `addAction` calls, recorded null families, and mapped `navigator_read_wind` to its card ID.
- GREEN: `recordCardUse` now owns action counting; gameplay passes stable normalized families (`항해` → `approach`, `주술` → `fire`, `망령` → `repair`) and no longer calls `addAction` separately.
- Focused verification: `node --test tests/analytics-cards.test.js tests/card-progression.test.js tests/card-combat.test.js` passed 51/51.
- Full verification: `node --test tests/*.test.js` passed 160/160; all five `node --check` commands and `git diff --check` exited 0.
- Browser was not attempted.
- Controller commit verified: `3f10f0c fix(analytics): record normalized card families`.
- Exact committed scope: `src/analytics.js`, `src/game.js`, and `tests/analytics-cards.test.js` (31 insertions, 10 deletions); post-commit worktree status was clean.
- Remaining `DONE_WITH_CONCERNS` status applies only to pending controller Browser QA.

## Fix Round 2

- Root causes: `html { min-width: 320px; }` exceeded the real 305px layout viewport at a nominal 320px browser width; absolutely positioned max-content tooltip pseudo-elements also contributed to document overflow. Static tooltip `aria-label` values replaced their live descendant values, and drag cleanup retained `aria-grabbed` until animation completion.
- RED: `node --test tests/card-ui.test.js tests/responsive-accessibility.test.js` passed 18/22 and failed four regressions covering immediate drag-state cleanup, live HUD and dynamic crew accessibility, narrow tooltip containment, and corrected firepower/stoic copy.
- GREEN: removed the forced HTML minimum width; pinned mobile tooltip bubbles to 14px viewport insets and hid their arrow; corrected firepower and stoic explanations; split live accessible names from `aria-description`; updated HUD names with their displayed values; and removed `aria-grabbed` immediately on valid, invalid, pointer-cancel, Escape, and reset paths.
- Focused verification: `node --test tests/card-ui.test.js tests/responsive-accessibility.test.js` passed 22/22.
- Relevant UI/tooltip/ship verification: `node --test tests/card-ui.test.js tests/responsive-accessibility.test.js tests/ship-preview.test.js tests/combat-rendering.test.js` passed 36/36.
- Full verification: `node --test tests/*.test.js` passed 164/164; all five `node --check` commands and `git diff --check` exited 0.
- Browser was not attempted, per controller direction.
- Commit: `38a67ec fix(ui): contain tooltips and preserve live labels` (5 files changed, 163 insertions, 26 deletions).

## Final Review Fix Wave

- Status: implementation complete; formal re-review remains controller-owned.
- Commit: the single final-review fix commit that includes this report and ledger update.
- RED covered distinct pointer geometry for Navigator distance 1/3, public/captain attack visuals with hit/miss and 80ms AoE staggering, invalid voyage cards, per-enemy-action morale/safety-net resolution, analytics hit buckets, forced-colors focus, discard reshuffle exhaustion, and cancellation after entering `flying`.
- GREEN implementation splits the sea drop zone into non-overlapping range targets while retaining keyboard target choices; captures attack anchors before batch damage; applies all AoE state and victory checks once while staggering only visual effects; filters and logs invalid voyage deck entries and skips unknown rendered instances; and checks defeat after each enemy fleet action so a rescue continues but actual defeat stops immediately.
- Analytics now stores aggregate `singleTarget`/`area` hit totals and the same breakdown per card. README inventory now matches 9 roles, 10 traits, 22 artifacts, the four Boatswain tiers, and the three card/fleet modules.
- Focused verification: `node --test tests/analytics-cards.test.js tests/captain-card-combat.test.js tests/card-combat.test.js tests/card-ui.test.js tests/combat-rendering.test.js tests/fleet-integration.test.js tests/card-engine.test.js tests/responsive-accessibility.test.js` passed 151/151.
- Full verification: `node --test tests/*.test.js` passed 175/175; `node --check` passed for analytics, card definitions, card engine, fleet combat, and game; `git diff --check` exited 0.
- Browser was not used, per final-fix dispatch instructions.
