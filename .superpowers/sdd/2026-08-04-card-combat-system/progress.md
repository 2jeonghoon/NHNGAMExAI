# SDD ledger — plan: docs/superpowers/plans/2026-08-04-card-combat-system.md

Workspace: /Users/2jh0926/NHNGAMExAI/.worktrees/card-combat-system
Branch: codex/card-combat-implementation
Merge base: b8c24c6
Baseline: `node --test tests/*.test.js` — 1/1 pass; `node --check src/game.js` — exit 0.
Pre-existing deferred review findings to re-check in the final review:
- Tooltip firepower copy overstates chain-shot scaling.
- Tooltip food/water/morale copy omits the `stoic` crew exception.
- Resource tooltip accessible names omit live values.
- Narrow-screen tooltip bounds and forced-colors focus visibility need browser verification.
- The zero-sails keyboard-path gap is expected to be closed by Task 5's centralized card legality.
Task 1: fix round 1/5 (1 addressed, 0 open — inherited card IDs now rejected; commits 56f0a52..104765e)
Task 1: complete (commits b8c24c6..104765e, review clean)
Task 2: minor (deferred): exhaustion test checks pile membership but does not force a discard reshuffle cycle.
Task 2: fix round 1/5 (1 addressed, 0 open — persistent energy capped at four; commits 88e8ab6..2b35173)
Task 2: complete (commits 104765e..2b35173, review clean; 1 minor deferred)
Task 3: complete (commits 2b35173..db417c6, review clean)
Task 4: fix round 1/5 (1 addressed, 0 open — capture/victory/reward/rotation regressions committed; commits f86f7d2..e38655f)
Task 4: complete (commits db417c6..e38655f, review clean)
Task 5: fix round 1/5 (1 addressed, 0 open — captain skills stay inside player turn; commits d92cf0a..47905ec)
Task 5: complete (commits e38655f..47905ec, review clean)
Task 6: complete (commits 47905ec..bdae5c3, review clean)
Task 7: fix round 1/5 (2 addressed, 0 open — event removal scope and modal restoration regression; commits 172ef5c..867ff7a)
Task 7: complete (commits bdae5c3..867ff7a, review clean)
Task 8: complete (commits 867ff7a..d3c5865, review clean)
Task 8: downstream note for Task 9: filter `combatDropTargetAtClientPoint()` to active card eligible target types so `allEnemies` is not shadowed by individual enemy rectangles.
Task 9: minor (deferred): reset/remove `aria-grabbed` after drag completion or cancellation.
Task 9: browser verification note for Task 10: verify real 320px overflow/clipping and stale `flying` callback cancellation, not only pre-flight cancellation.
Task 9: fix round 1/5 (3 addressed, 0 open — pointerup re-hit-test, focus-before-render, numeric runtime descriptions; commits fb03181..921dff1)
Task 9: complete (commits d3c5865..921dff1, review clean; 1 minor deferred)
Task 10: fix round 1/5 (1 addressed, 0 open — normalized card families and single action counting; commits 9288221..3f10f0c)
Task 10: fix round 2/5 (5 addressed, 0 open — mobile tooltip containment/copy/accessibility and drag state cleanup; commits 3f10f0c..38a67ec)
Task 10: browser QA complete (320px root 305/305 with no horizontal overflow; five-card mobile hand layout; live HUD and crew accessible descriptions; drag selection/Escape cleanup; end-turn enemy action, energy reset and five-card redraw; console 0 errors/warnings. Valid drop execution remains covered by automated interaction tests because the browser CUA pointer-capture drag could not emit a release event.)
Task 10: complete (commits 921dff1..38a67ec, scoped review clean; 164/164 implementation verification)
Final review: fix wave 1/1 (8 findings addressed, 0 knowingly open — pointer distance choice, card attack visuals, invalid-card isolation, per-action defeat checks, forced-colors focus, analytics hit buckets, recycle/cancel tests, and README inventory; final-wave commit includes this ledger entry)
Final review fix verification: focused 151/151; full `node --test tests/*.test.js` 175/175; five `node --check` commands and `git diff --check` exited 0.
