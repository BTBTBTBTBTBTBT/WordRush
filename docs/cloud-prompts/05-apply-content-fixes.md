Apply the content-audit fixes from PR #44 (branch cloud/content-audit: REPORT-CONTENT-AUDIT.md, content-audit.json, docs/content-audit/proposals/). Work on a NEW branch `cloud/content-fixes` created from `cloud/content-audit`; push only there and open a draft PR into `claude/wordocious-store-text-audit-f32609`. Never push to main or the working branch. Don't change app code beyond content/guards, and don't change version numbers.

PRIORITY ORDER:
1. HIGH severity first (profanity, slurs, sexual/drug/violent words, offensive clues, political/brand names like TRUMP/VIAGRA) in EVERY bank: Muddle scramble words (incl. FUCKED md-ikz7lk, SHITTY md-9guhqs), Hubbub required words (HOMO, RETARDED, BONER, VIBRATOR, BONDAGE — re-pick valid puzzles if a removed word was the only pangram), Crossword clues/answers ("A chink in the ____", "A cock and bull ____"), Letter Ladder accept list (SEMEN, SPERM, NUDES, BONER, HORNY…), answer pools, Word of the Day, bots/VS lists. Nearest dates first.
2. Then British words/idioms (TOGGLE live in Six, RUBBISH, ENQUIRY, "Pull your socks up", "Mind the…") and obscure words.

RULES:
- Follow the existing swap mechanism exactly (study the SOLUTION_SWAP_* batches, their cutover constants and tests, CONTENT_RELEASE_DATE in apps/web/scripts/content-release-date.mjs). Make this "swap batch 4" for date-dealt pools. Never change a puzzle that has already been served (date < today); only future dates. Pick the cutover date so it is AFTER today and as early as safely possible (the next app builds are expected around 2026-10-12); list any flagged item that would still be served to players on OLD app versions before that date, so the founder knows the exposure.
- For banks that are not date-swap-gated (accept lists, clue text, Muddle/Hubbub puzzle content), replace in place for future puzzles only, keeping each game's rules (length, letters, category, pangram, solvability). Validate every replacement with the game's own validators/tests.
- Keep the iOS, Android and web copies byte-identical (the audit says they are); update all three.
- American spelling and all-ages only (see apps/web/scripts/content-american.test.ts, spelling-copy.test.ts).
- Wire in the proposed guards (docs/content-audit/proposals: brit-words-extended, obscure-words-proposed, content-audit-guards G1–G7) as real tests that run in the web/core test suites, so these words can never come back; the profanity guard must cover Muddle, Hubbub, Crossword clues, Ladder accept lists and every pool.
- Run core vitest + web tsc + web vitest (and Swift/Gradle tests if available; otherwise say so).

DELIVER: REPORT-CONTENT-FIXES.md — every change (game, date/index, old → new, reason), the cutover date chosen, the old-version exposure list, guards added and their results, test results. Finish with a short summary and the draft PR link.
