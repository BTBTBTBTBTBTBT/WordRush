You're working on Wordocious, a daily word-game app (iOS, Android, web) for an American, all-ages audience. Start from branch `claude/wordocious-store-text-audit-f32609`, create a NEW branch `cloud/content-audit`, push only there, and open a draft PR into the starting branch when done. Don't change app code or version numbers.

GOAL: audit every puzzle answer and word list so testers stop finding British, obscure or inappropriate words (recent reports: THAVE in Letter Ladder, TOGGLE and WELLIES in Spyglass, British answers in Kindred).

1. Find every bundled puzzle bank / answer list / word list for all games (Classic/Six/Seven answers, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, ProperNoundle, Muddle, Hubbub, Kindred, Crosswordocious clues+answers, Letter Ladder, Codebreaker, Spyglass, Starsweep, Word of the Day, bots, VS). Look under apps/web, packages/core, data/, apps/ios and apps/android resources; note where the three platform copies live.
2. Flag, with the reason: British spellings or British-only words/slang; obscure or archaic words an average American adult wouldn't know; offensive, sexual, violent, drug, slur or otherwise not-all-ages words; proper nouns where they shouldn't be; duplicates; clues that are wrong or confusing.
3. Respect what's already decided: apps/web/scripts/content-american.test.ts, spelling-copy.test.ts, the answer-swap batches and their cutover dates (SOLUTION_SWAP_* constants — never change a past or already-served puzzle; only future dates), CONTENT_RELEASE_DATE in apps/web/scripts/content-release-date.mjs.
4. For FUTURE-dated puzzles only, propose a replacement for each flagged answer that fits the game's rules (length, letters, category) — don't apply them yet.
5. Deliver REPORT-CONTENT-AUDIT.md: counts per game, a table of every flag (game, date/index, word, reason, proposed replacement), and the list of past/already-served items that can't change. Also a machine-readable `content-audit.json`. If an existing guard test could be extended to catch a category automatically (e.g. a British-word list), add it as a proposal file, not wired in.

Finish with a short summary, the branch name and the draft PR link.
