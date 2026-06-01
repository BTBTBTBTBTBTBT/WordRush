import Foundation
import SwiftUI
import Supabase

/// One achievement definition — 1:1 with apps/web/lib/achievement-service.ts
/// ACHIEVEMENTS. Display-only on native: unlock detection runs server-side on
/// the web's recordGameResult and lands in the shared `achievements` table;
/// here we read which keys the user has unlocked. (Native-side unlock detection
/// is a deferred follow-up.)
struct AchievementDef: Identifiable {
    let key: String, name: String, description: String, category: String
    var id: String { key }
}

enum AchievementService {
    static let all: [AchievementDef] = [
        .init(key: "first_win", name: "First Win", description: "Win any game", category: "beginner"),
        .init(key: "all_modes", name: "All Modes Played", description: "Play all 9 game modes", category: "beginner"),
        .init(key: "daily_debut", name: "Daily Debut", description: "Complete your first daily challenge", category: "beginner"),
        .init(key: "streak_7", name: "7-Day Warrior", description: "Play 7 consecutive days", category: "consistency"),
        .init(key: "streak_30", name: "30-Day Streak", description: "Play 30 consecutive days", category: "consistency"),
        .init(key: "speed_demon", name: "Speed Demon", description: "Solve Classic in under 30 seconds", category: "skill"),
        .init(key: "perfectionist", name: "Perfectionist", description: "Solve in 1 guess", category: "skill"),
        .init(key: "gauntlet_master", name: "Gauntlet Master", description: "Complete the entire Gauntlet", category: "skill"),
        .init(key: "vs_veteran", name: "VS Veteran", description: "Win 10 VS matches", category: "social"),
        .init(key: "unstoppable", name: "Unstoppable", description: "Achieve a 5-win streak", category: "social"),
        .init(key: "medal_10", name: "Medal Collector", description: "Earn 10 medals", category: "collection"),
        .init(key: "medal_50", name: "Medal Hoarder", description: "Earn 50 medals", category: "collection"),
        .init(key: "golden_touch", name: "Golden Touch", description: "Earn 10 gold medals", category: "collection"),
        .init(key: "daily_sweep", name: "Daily Sweep", description: "Complete all 9 dailies in a single day", category: "skill"),
        .init(key: "flawless_victory", name: "Flawless Victory", description: "Win all 9 dailies in a single day", category: "skill"),
        .init(key: "century_club", name: "Century Club", description: "Win 100 total games", category: "consistency"),
        .init(key: "thousand_words", name: "Thousand Words", description: "Win 1,000 total games", category: "consistency"),
        .init(key: "sweep_streak_7", name: "Sweep Streak", description: "Complete the daily sweep 7 days in a row", category: "consistency"),
        .init(key: "iron_will", name: "Iron Will", description: "Complete the daily sweep 30 days in a row", category: "consistency"),
        .init(key: "quad_king", name: "Quad King", description: "Win 50 QuadWord games", category: "skill"),
        .init(key: "octo_boss", name: "Octo Boss", description: "Win 50 OctoWord games", category: "skill"),
        .init(key: "sequence_ace", name: "Sequence Ace", description: "Win 50 Sequence games", category: "skill"),
        .init(key: "rescue_hero", name: "Rescue Hero", description: "Win 50 Deliverance games", category: "skill"),
        .init(key: "lightning_round", name: "Lightning Round", description: "Complete the daily sweep in under 20 minutes", category: "skill"),
        .init(key: "no_sweat", name: "No Sweat", description: "Win Classic in 2 guesses", category: "skill"),
        .init(key: "untouchable", name: "Untouchable", description: "Achieve a 10-win VS streak", category: "social"),
        .init(key: "gauntlet_god", name: "Gauntlet God", description: "Complete Gauntlet without failing any board", category: "skill"),
        .init(key: "rival", name: "Rival", description: "Play 50 VS matches", category: "social"),
        .init(key: "dominant", name: "Dominant", description: "Win 50 VS matches", category: "social"),
        .init(key: "medal_wall", name: "Medal Wall", description: "Earn 100 medals", category: "collection"),
        .init(key: "six_shooter", name: "Six Shooter", description: "Win 50 Classic Six games", category: "skill"),
        .init(key: "lucky_seven", name: "Lucky Seven", description: "Win 50 Classic Seven games", category: "skill"),
        .init(key: "extended_vocab", name: "Extended Vocabulary", description: "Win both a Six and Seven daily in the same day", category: "beginner"),
        .init(key: "proper_scholar", name: "Proper Scholar", description: "Win 50 Propernoundle games", category: "skill"),
        .init(key: "classic_master", name: "Classic Master", description: "Win 100 Classic games", category: "skill"),
        .init(key: "blitz", name: "Blitz", description: "Win any game in under 15 seconds", category: "skill"),
        .init(key: "speed_sweep", name: "Speed Sweep", description: "Complete the daily sweep in under 15 minutes", category: "skill"),
        .init(key: "dedicated", name: "Dedicated", description: "Play 500 total games", category: "consistency"),
        .init(key: "obsessed", name: "Obsessed", description: "Play 2,000 total games", category: "consistency"),
        .init(key: "daily_devotee", name: "Daily Devotee", description: "Complete 50 daily sweeps", category: "consistency"),
        .init(key: "centurion", name: "Centurion", description: "Complete 100 daily sweeps", category: "consistency"),
        .init(key: "rising_star", name: "Rising Star", description: "Reach level 10", category: "beginner"),
        .init(key: "elite", name: "Elite", description: "Reach level 50", category: "skill"),
        .init(key: "year_one", name: "Year One", description: "Play 365 consecutive days", category: "consistency"),
        .init(key: "flawless_streak", name: "Flawless Streak", description: "Achieve Flawless Victory 3 days in a row", category: "skill"),
        .init(key: "versatile_victor", name: "Versatile Victor", description: "Win VS matches in 5 different game modes", category: "social"),
        .init(key: "triple_threat", name: "Triple Threat", description: "Win 3 VS matches in a single day", category: "social"),
        .init(key: "close_call", name: "Close Call", description: "Win a game on your final guess", category: "skill"),
        .init(key: "hat_trick", name: "Hat Trick", description: "Win 3 daily games in under 60 seconds each in one day", category: "skill"),
        .init(key: "eagle_eye", name: "Eagle Eye", description: "Solve 10 games in 1 guess lifetime", category: "skill"),
        .init(key: "gold_rush", name: "Gold Rush", description: "Earn 50 gold medals", category: "collection"),
        .init(key: "diamond_hands", name: "Diamond Hands", description: "Earn 100 gold medals", category: "collection"),
        .init(key: "unbreakable", name: "Unbreakable", description: "Achieve a 25-win streak", category: "skill"),
        .init(key: "the_natural", name: "The Natural", description: "Win 10 games in under 30 seconds", category: "skill"),
        .init(key: "wordsmith", name: "Wordsmith", description: "Win 500 total games", category: "consistency"),
        .init(key: "endurance", name: "Endurance", description: "Play 1,000 total games", category: "consistency"),
        .init(key: "marathon_runner", name: "Marathon Runner", description: "Accumulate 5 hours of total playtime", category: "consistency"),
        .init(key: "linguist", name: "Linguist", description: "Win Classic, Six, and Seven daily in the same day", category: "beginner"),
        .init(key: "streak_master", name: "Streak Master", description: "Achieve a 50-day login streak", category: "consistency"),
        .init(key: "daily_regular", name: "Daily Regular", description: "Complete dailies on 100 different days", category: "consistency"),
        .init(key: "pure_six_initiate", name: "Pure Six", description: "Win Classic Six without using any hints", category: "skill"),
        .init(key: "pure_six_adept", name: "Pure Six Adept", description: "Win 10 Classic Six games without hints", category: "skill"),
        .init(key: "pure_six_master", name: "Pure Six Master", description: "Win 50 Classic Six games without hints", category: "skill"),
        .init(key: "pure_seven_initiate", name: "Pure Seven", description: "Win Classic Seven without using any hints", category: "skill"),
        .init(key: "pure_seven_adept", name: "Pure Seven Adept", description: "Win 10 Classic Seven games without hints", category: "skill"),
        .init(key: "pure_seven_master", name: "Pure Seven Master", description: "Win 50 Classic Seven games without hints", category: "skill"),
        .init(key: "pure_proper_initiate", name: "Pure Proper", description: "Win ProperNoundle without using any hints", category: "skill"),
        .init(key: "pure_proper_adept", name: "Pure Proper Adept", description: "Win 10 ProperNoundle games without hints", category: "skill"),
        .init(key: "pure_proper_master", name: "Pure Proper Master", description: "Win 50 ProperNoundle games without hints", category: "skill"),
        .init(key: "pure_player", name: "Pure Player", description: "Win 50 hintless games across Six, Seven, and ProperNoundle combined", category: "skill"),
    ]

    static func fetchUnlocked(userId: String) async -> Set<String> {
        struct Row: Decodable { let achievement_key: String }
        let rows: [Row] = (try? await AuthService.shared.client.from("achievements")
            .select("achievement_key")
            .eq("user_id", value: userId)
            .execute().value) ?? []
        return Set(rows.map { $0.achievement_key })
    }
}

/// Reusable collapsible section (title + count badge + chevron) — ports
/// components/profile/collapsible-section.tsx.
struct CollapsibleSection<Content: View>: View {
    let title: String
    var badge: String? = nil
    @State private var open = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { open.toggle() } } label: {
                HStack(spacing: 8) {
                    Text(title).font(Brand.font(11, .heavy)).tracking(0.8).foregroundStyle(Theme.textMuted)
                    if let badge {
                        Text(badge).font(Brand.font(10, .heavy)).foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Capsule().fill(Theme.surfaceAlt))
                    }
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.textMuted).rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())   // whole row tappable, not just the text/chevron
            }.buttonStyle(.plain)
            if open { content.padding(.top, 8) }
        }
    }
}
