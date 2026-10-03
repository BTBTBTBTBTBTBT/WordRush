# Night art queue (ChatGPT session after build 241 is submitted, 2026-10-03)

Founder rules: on brand (purple/gold/grey glossy, soft 3D, Nunito-heavy lettering), friendly cast only
(never w-cheer / w-lean, W never angry), no bordered/outlined boxes, no emoji look. Full-size saves approved.

1. Game titles — centered, hi-res re-letters (never ship screenshot captures)
2. Gauntlet header + stage medallions
3. Avatar parts (body/eyes/mouth/nose/accessories/hats) + packages/core/src/avatar-parts.json manifest + fixtures
4. Achievement celebration scene
5. Achievement badges, 110, in 3×3 sheets (achievements.txt + achievements-new.txt)
6. Onboarding scenes (welcome-cast, all-set)
7. MENU title
8. Card trims (spec BH)
9. Reactions, clock sprite, rounded-square frames, Halloween props + banner
10. TOGGLES (founder 10-03): glossy candy segmented toggles to replace plain pills — Daily | Unlimited
    (with PRO crown inside), Today | All-time, sound on/off, People | Bots, Solo | VS; track + thumb
    sprites in light and dark, selected/unselected states, no outlines
11. "Wordocious Polish Pass" design canvas: "small menus with flair" board + numbered proposals

Then: docs/design/brand/NIGHT-ART-2026-10-03.md (what shipped where) + a bible entry. No builds or pushes overnight.

Status 10-03 ~4:30 AM: 1–7, 9, 10, 11 done and shipped ×3 (see NIGHT-ART-2026-10-03.md); 8 skipped (no spec BH).

## Queued build work (not art) — 10-03 afternoon
- BJ9 Game open/close: "grow + soft rise" combo (founder approved the demo) — tapped card lifts (scale 1.03, −4) then a light card-colored shell grows to full screen on a soft spring (~0.44 s, ease-out-expo) while the pre-built game fades in over the last ~60%; close reverses back into the card (~0.38 s). Animate a cheap shell, never the live game view; game prebuilt under it. iOS 16+ custom overlay (iOS 18 zoom transition optional), Android shared-element/SharedTransitionLayout or the same shell, web View Transitions with fallback. Measured: 0 hitches >25 ms during open/close.
- BJ10 Menus/sheets "soft pop": dim + gentle spring scale (0.94→1) from the bottom-center instead of the system slide.
- FINAL GATE (founder 10-03): after the LAST feature lands (incl. widget-you, logo sweep, subscribe screens, avatar round 2, transitions), run one final full fluidity audit with the perf harness over EVERY surface — first-appearance frame (no placeholder/pop-in), scroll/typing/transition hitches (>25 ms), main-thread %, AttributeGraph cycles = 0 — on iOS (Release sim) + Android (gfxinfo, one emulator) + web (trace). Fix regressions, re-run, publish before/after table. Only then cut 242/198.
