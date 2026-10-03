# Plain-text headings → ChatGPT title art (founder 10-03)

Founder: "There shouldn't be any plain text menus… If we can do titles for anything needing it that would be great through chat gpt."
Style = the approved cast-color titles (`titles/cast-colors/`): soft bubble lettering, one cast body color, deeper same-color rim, footer-level gloss, no flourishes.
Output: `titles/cast-colors/<slug>.png` (transparent, spell-checked). Wiring happens after founder approval of the title/button set.

## Priority 1 — high traffic

| Slug | Title | Color |
|---|---|---|
| solved | SOLVED! | gold |
| nottoday | NOT TODAY | slate |
| share | SHARE | orange |
| sweep | DAILY SWEEP | purple |
| overview | OVERVIEW | blue |
| shields | SHIELDS | purple |
| savestreak | SAVE YOUR STREAK! | purple |
| streaksaved | STREAK SAVED! | purple |
| playedtoday | PLAYED TODAY | slate |
| vsused | DAILY VS USED | teal |
| achievement | ACHIEVEMENT UNLOCKED! | gold |
| letsplay | LET'S PLAY! | orange |
| invite | INVITE A FRIEND | green |
| editprofile | EDIT PROFILE | purple |
| mascot | MAKE YOUR MASCOT | pink |
| bots | BOTS | teal |
| challenge | CHALLENGE | teal |
| findingrival | FINDING A RIVAL | teal |
| matchfound | MATCH FOUND! | teal |
| welcomeback | WELCOME BACK! | purple |
| jointhefun | JOIN THE FUN! | purple |
| resetpassword | RESET PASSWORD | purple |
| makeprofile | MAKE YOUR PROFILE | purple |
| username | PICK A USERNAME | blue |
| yourein | YOU'RE IN! | gold |
| tour-daily | DAILY GAMES | teal |
| tour-score | SCORE BIG | gold |
| tour-streak | KEEP YOUR STREAK | orange |
| tour-together | PLAY TOGETHER | pink |

Tour titles: the web/Android set above wins; iOS (OnboardingView.swift:723) aligns to it when wired.

## Priority 2 — the rest

| Slug | Title | Color |
|---|---|---|
| nudge | NUDGE! | slate |
| invitesent | INVITE SENT! | green |
| newfriends | NEW FRIENDS! | pink |
| giftpro | GIFT A WEEK OF PRO | gold |
| prounlocked | PRO UNLOCKED! | gold |
| invited | YOU'RE INVITED! | green |
| yourepro | YOU'RE PRO | gold |
| welcomepro | WELCOME TO PRO! | gold |
| freeweek | FREE WEEK OF PRO! | gold |
| properk | PRO PERK | gold |
| newpassword | NEW PASSWORD | purple |
| gauntletcleared | GAUNTLET CLEARED! | gold |
| laddercleared | LADDER CLEARED! | gold |
| alreadyplayed | ALREADY PLAYED | teal |
| levelup | LEVEL UP! | gold |
| archetypes | ARCHETYPES | blue |
| h2h | HEAD TO HEAD | pink |
| trophycase | TROPHY CASE | gold |
| podium | PODIUM | orange |
| streakcal | STREAK CALENDAR | purple |
| support | SUPPORT | teal |
| about | ABOUT | purple |
| deleteaccount | DELETE ACCOUNT | slate |
| profile | PROFILE | purple |
| privatematch | PRIVATE MATCH | teal |
| oops | OOPS! | slate |
| notfound | NOT FOUND | orange |
| rotate | ROTATE YOUR PHONE | blue |
| dailychallenge | DAILY CHALLENGE | purple |
| onastreak | ON A STREAK! | gold |

## Quick wins with existing art (wire later, no ChatGPT needed)
- Web Go Pro popup without a reason → `art-title-gopro` (go-pro-popup.tsx:117).
- Welcome modal / onboarding "WELCOME TO WORDOCIOUS!" → `art-title-welcome` (W welcome-modal.tsx:117, first-run-tour.tsx:477; I OnboardingView.swift:267; A Onboarding.kt:501).
- Signed-out Stats / Leaderboard → STATS / LEADERBOARD art above the GuestPitch (W app/stats/page.tsx:393; I ProfileTab.swift:478, LeaderboardTab.swift:280; A ProfileScreen.kt:461, LeaderboardScreen.kt:121).
- Android VS search nav → pass vsbattle art to `VsNavBar` (vs/VSLiveSearch.kt:143).
- Header streak / flawless popups → `art-moment-streak` / `art-moment-flawless` (W streak-popups.tsx:137/:283; I HeaderPopups.swift:147/:299; A AppHeader.kt:438/:639).
- SO CLOSE → `art-moment-soclose` (I PostGameViews.swift:201, A FinishedScreen.kt:285, Gauntlet loss lines).
- Strategy "VS" text → `art-title-vs` (I StrategyKit.swift:310, A StrategyKit.kt:355) — note vs.png was dropped for vsbattle; use vsbattle.

Full per-platform file:line map: see the inventory report in the session transcript (10-03 ~17:30).
