import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { join } from 'node:path';
import { renderSeedFixtures, renderPrefillFixtures, renderBankFixtures, renderSudokuFixtures, renderRegionsFixtures, renderLadderFixtures, renderWordsearchFixtures, renderHubFixtures, renderCryptogramFixtures, renderGroupsFixtures, renderCrosswordFixtures, renderScrambleFixtures, renderHomeBannerFixtures, renderVsLobbyFixtures, renderFriendlyFixtures, renderLeaderboardTitleFixtures, renderShareCaptionFixtures, renderLevelSeasonFixtures, renderPushCopyFixtures, renderAvatarConfigFixtures, renderHeadlineTokenFixtures, renderBubbleTextFixtures, renderAchievementRuleFixtures, renderAvatarResolveFixtures, renderPodiumLayoutFixtures, renderAvatarLayoutFixtures, renderAvatarPoseFixtures, renderAvatarAccessFixtures, renderMusicalCastFixtures, renderFriendCardFixtures, renderPocketHelpFixtures, renderWaitingRoomFixtures, renderAdCopyFixtures, renderPlayerTintFixtures } from '../scripts/gen-parity-fixtures';

// Freshness guard for the cross-platform engine-parity fixtures. The Swift and
// Kotlin ports assert against the committed JSON; this test asserts the
// committed JSON still matches what the TS core produces with the CURRENT
// word lists. If a curation run (or engine change) lands without regenerating,
// this fails here — on the web/TS side — instead of surfacing days later as
// mysterious native test failures (which is exactly what happened when the
// 2026-07 curation left these stale; see gen-parity-fixtures.ts).
const repo = join(__dirname, '..', '..', '..');
const FIXTURE_COPIES = [
  join(repo, 'apps', 'ios', 'Tests', 'Fixtures'),
  join(repo, 'apps', 'android', 'core', 'src', 'test', 'resources', 'fixtures'),
];

describe('engine parity fixtures are fresh and synced', () => {
  const rendered: Array<[string, string]> = [
    ['seed-fixtures.json', JSON.stringify(renderSeedFixtures(), null, 2) + '\n'],
    ['prefill-fixtures.json', JSON.stringify(renderPrefillFixtures(), null, 2) + '\n'],
    ['bank-fixtures.json', JSON.stringify(renderBankFixtures(), null, 2) + '\n'],
    ['sudoku-fixtures.json', JSON.stringify(renderSudokuFixtures(), null, 2) + '\n'],
    ['regions-fixtures.json', JSON.stringify(renderRegionsFixtures(), null, 2) + '\n'],
    ['ladder-fixtures.json', JSON.stringify(renderLadderFixtures(), null, 2) + '\n'],
    ['wordsearch-fixtures.json', JSON.stringify(renderWordsearchFixtures(), null, 2) + '\n'],
    ['hub-fixtures.json', JSON.stringify(renderHubFixtures(), null, 2) + '\n'],
    ['cryptogram-fixtures.json', JSON.stringify(renderCryptogramFixtures(), null, 2) + '\n'],
    ['groups-fixtures.json', JSON.stringify(renderGroupsFixtures(), null, 2) + '\n'],
    ['crossword-fixtures.json', JSON.stringify(renderCrosswordFixtures(), null, 2) + '\n'],
    ['scramble-fixtures.json', JSON.stringify(renderScrambleFixtures(), null, 2) + '\n'],
    ['home-banner-fixtures.json', JSON.stringify(renderHomeBannerFixtures(), null, 2) + '\n'],
    ['vs-lobby-fixtures.json', JSON.stringify(renderVsLobbyFixtures(), null, 2) + '\n'],
    ['friendly-games-fixtures.json', JSON.stringify(renderFriendlyFixtures(), null, 2) + '\n'],
    ['leaderboard-title-fixtures.json', JSON.stringify(renderLeaderboardTitleFixtures(), null, 2) + '\n'],
    ['share-captions-fixtures.json', JSON.stringify(renderShareCaptionFixtures(), null, 2) + '\n'],
    ['level-season-fixtures.json', JSON.stringify(renderLevelSeasonFixtures(), null, 2) + '\n'],
    ['push-copy-fixtures.json', JSON.stringify(renderPushCopyFixtures(), null, 2) + '\n'],
    ['avatar-config-fixtures.json', JSON.stringify(renderAvatarConfigFixtures(), null, 2) + '\n'],
    ['headline-tokens-fixtures.json', JSON.stringify(renderHeadlineTokenFixtures(), null, 2) + '\n'],
    ['achievement-rules-fixtures.json', JSON.stringify(renderAchievementRuleFixtures(), null, 2) + '\n'],
    ['avatar-resolve-fixtures.json', JSON.stringify(renderAvatarResolveFixtures(), null, 2) + '\n'],
    ['podium-layout-fixtures.json', JSON.stringify(renderPodiumLayoutFixtures(), null, 2) + '\n'],
    ['avatar-layout-fixtures.json', JSON.stringify(renderAvatarLayoutFixtures(), null, 2) + '\n'],
    ['avatar-pose-fixtures.json', JSON.stringify(renderAvatarPoseFixtures(), null, 2) + '\n'],
    ['avatar-access-fixtures.json', JSON.stringify(renderAvatarAccessFixtures(), null, 2) + '\n'],
    ['bubble-text-fixtures.json', JSON.stringify(renderBubbleTextFixtures(), null, 2) + '\n'],
    ['musical-cast-fixtures.json', JSON.stringify(renderMusicalCastFixtures(), null, 2) + '\n'],
    ['friend-cards-fixtures.json', JSON.stringify(renderFriendCardFixtures(), null, 2) + '\n'],
    ['pocket-help-fixtures.json', JSON.stringify(renderPocketHelpFixtures(), null, 2) + '\n'],
    ['waiting-room-fixtures.json', JSON.stringify(renderWaitingRoomFixtures(), null, 2) + '\n'],
    ['ad-copy-fixtures.json', JSON.stringify(renderAdCopyFixtures(), null, 2) + '\n'],
    ['player-tint-fixtures.json', JSON.stringify(renderPlayerTintFixtures(), null, 2) + '\n'],
  ];

  for (const [name, expected] of rendered) {
    for (const dir of FIXTURE_COPIES) {
      it(`${name} in ${dir.includes('ios') ? 'iOS' : 'Android'} matches TS core output`, () => {
        const onDisk = fs.readFileSync(join(dir, name), 'utf8');
        expect(onDisk).toBe(expected);
      });
    }
  }
});
