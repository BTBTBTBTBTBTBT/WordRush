#!/usr/bin/env python3
"""The PROPOSED mascot access table (docs/cloud-prompts/11; decisions in ../UNLOCKS-AND-SHOP.md).

One run writes:
  docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.json   the proposal (founder approves later)
  docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.md     the same, as a readable table
  packages/core/src/avatar-access.json                  the data core reads (behind itemGating, OFF)
  apps/ios/Wordocious/Resources/avatar-access.json      byte-identical copies (packages/core avatar-access.test.ts)
  apps/android/app/src/main/assets/avatar-access.json

Every option of every maker field gets a rule. A rule is any mix of routes:
  free     everyone (the starter set)          pro      included with Pro
  buy      a direct purchase at a price tier   earn     a condition on existing Stats / achievements
  season   free in its season's window (avatar-parts.json `season`, avatar-season.ts)
  limited  buy / earn only inside a date window, then retired
Keys are "<config field>:<id>"; the three color fields share "color:<id>". "none" / solid / auto / default are
always free and never listed. Edit the tables below and re-run; nothing is hand-edited in the outputs.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), *[".."] * 5))
CORE = os.path.join(ROOT, "packages/core/src")

def ts_list(name):
    src = open(os.path.join(CORE, "avatar-config.ts")).read()
    m = re.search(r"export const %s\b[^=]*=\s*\[(.*?)\]\s*as const" % name, src, re.S)
    return re.findall(r"'([^']+)'", m.group(1))

def colors():
    src = open(os.path.join(CORE, "avatar-config.ts")).read()
    block = src[src.index("export const AVATAR_COLORS"):src.index("export const AVATAR_COLOR_GROUPS")]
    return re.findall(r"\{ id: '([^']+)'", block)

def backdrops():
    src = open(os.path.join(CORE, "avatar-config.ts")).read()
    block = src[src.index("export const AVATAR_BACKDROPS"):src.index("export const AVATAR_BACKDROP_IDS")]
    return re.findall(r"\{ id: '([^']+)'", block)

def poses():
    src = open(os.path.join(CORE, "avatar-pose.ts")).read()
    m = re.search(r"export const AVATAR_POSES = \[(.*?)\]", src, re.S)
    return re.findall(r"'([^']+)'", m.group(1))

FIELDS = {
    "body": ts_list("AVATAR_BODIES"), "color": colors(), "pattern": ts_list("AVATAR_PATTERNS"),
    "eyes": ts_list("AVATAR_EYES"), "brows": ts_list("AVATAR_BROWS"), "nose": ts_list("AVATAR_NOSES"),
    "cheeks": ts_list("AVATAR_CHEEKS"), "mouth": ts_list("AVATAR_MOUTHS"), "extra": ts_list("AVATAR_EXTRAS"),
    "head": ts_list("AVATAR_HEADS"), "face": ts_list("AVATAR_FACES"), "neck": ts_list("AVATAR_NECKS"),
    "held": ts_list("AVATAR_HELD"), "wrap": ts_list("AVATAR_WRAPS"), "feet": ts_list("AVATAR_FEET"),
    "pet": ts_list("AVATAR_PETS"), "frame": ts_list("AVATAR_FRAMES"), "bg": backdrops(), "pose": poses(),
}
ALWAYS_FREE = {"none", "solid", "auto", "default"}

PARTS = json.load(open(os.path.join(CORE, "avatar-parts.json")))
FIELD_KIND = {"eyes": "eyes", "mouth": "mouth", "nose": "nose", "cheeks": "cheeks", "brows": "brows"}
def season_of(field, pid):
    if field == "body":     # 2.8 seasonal bodies (pumpkin, ghost, bat, cone): avatar-parts.json bodies.<id>.season
        return PARTS["bodies"].get(pid, {}).get("season")
    kind = FIELD_KIND.get(field, "acc")
    return PARTS["items"].get(f"{kind}:{pid}", {}).get("season")

TIERS = {"t1": 0.99, "t2": 1.99, "t3": 2.99, "t4": 4.99}

# ── The starter set: free for everyone, forever ─────────────────────────────────────────────────────
# Must include everything the seeded default + the cast presets can produce (defaultAvatar: DEFAULT_BODIES,
# DEFAULT_EYES, DEFAULT_MOUTHS, the first 16 swatches; castPreset: classic + beady + smile), so no player's
# default look is ever locked. Plus a small taste of every tab.
STARTER = {
    "body": ["classic", "tall", "wide", "blob", "bean", "heart", "egg", "gumdrop", "can"],   # + 4 of the 2.8 shapes free
    "color": colors()[:16],
    "pattern": ["twotone", "stripes", "dots"],
    "eyes": ["beady", "happy", "sparkly", "wink", "sleepy"],
    "brows": ["happy"],
    "nose": ["button"],
    "cheeks": ["blush", "freckles"],
    "mouth": ["smile", "grin", "tiny", "cat", "tongue"],
    "extra": [],
    "head": ["party", "beanie", "cap", "bow"],
    "face": ["roundglasses"],
    "neck": ["scarf"],
    "held": ["mug", "book"],
    "wrap": ["bandana"],
    "feet": ["sneakers"],
    "pet": [],
    "frame": [],
    "bg": ["lilac", "bubblegum", "sky", "mint", "lemon", "peach", "cloud"],
    "pose": ["wave"],
}

# ── Earn conditions: each one is tied to data the server already records ───────────────────────────
# achievement = an existing achievement key (the achievements table); stat = a profile column
# (level, current_streak → currentStreak, best_streak → bestStreak, best_daily_login_streak → bestLoginStreak).
def ach(key, label):
    return {"achievement": key, "label": label}
def stat(name, n, label):
    return {"stat": name, "min": n, "label": label}

# Per-item overrides: field -> id -> rule (routes merged onto the field default below).
RULES = {
    "body": {
        "drop": {"pro": True, "buy": "t2"}, "pear": {"pro": True, "buy": "t2"}, "cloud": {"pro": True, "buy": "t2"},
        "mini": {"pro": True, "buy": "t2"}, "chunky": {"pro": True, "buy": "t2"},
        "star": {"pro": True, "buy": "t3", "earn": stat("bestStreak", 30, "Keep a 30-day play streak")},
        "hex": {"pro": True, "buy": "t3", "earn": ach("gauntlet_master", "Complete the entire Gauntlet")},
    },
    "color": {
        # The round-2 swatches: Pro or a cheap buy. The Pro specials keep Pro and add a rare earn route.
        "gold": {"pro": True, "buy": "t3", "earn": ach("golden_touch", "Earn 10 gold medals")},
        "silver": {"pro": True, "buy": "t3", "earn": ach("medal_10", "Earn 10 medals")},
        "rainbow": {"pro": True, "buy": "t3", "earn": ach("flawless_victory", "Win every Daily Sweep game in one day")},
        "holo": {"pro": True, "buy": "t3", "earn": ach("grand_sweep", "Sweep every daily and every Puzzle in one day")},
        "neon": {"pro": True, "buy": "t3", "earn": ach("lightning_round", "Finish the Daily Sweep in under 20 minutes")},
    },
    "pattern": {
        "sparkle": {"pro": True, "buy": "t2", "earn": ach("daily_sweep", "Complete every Daily Sweep game in one day")},
        "galaxy": {"pro": True, "buy": "t3", "earn": ach("night_owl", "Finish a daily between midnight and 4 AM")},
        "tiedye": {"pro": True, "buy": "t2"}, "leopard": {"pro": True, "buy": "t2"},
    },
    "eyes": {
        "stars": {"pro": True, "buy": "t1", "earn": ach("perfectionist", "Solve a game in 1 guess")},
        "hearts": {"pro": True, "buy": "t1", "earn": ach("best_buds", "Add your first friend")},
        "anime": {"pro": True, "buy": "t2"}, "cyclops": {"pro": True, "buy": "t2"},
    },
    "mouth": {
        "braces": {"pro": True, "buy": "t1"}, "fang": {"pro": True, "buy": "t1"},
    },
    "head": {
        # Pro today: crown, halo, tiara (they stay Pro, plus a rare earn + buy)
        "crown": {"pro": True, "buy": "t3", "earn": ach("boss_battle", "Beat Webster, the final boss")},
        "halo": {"pro": True, "buy": "t3", "earn": ach("year_one", "Play 365 days in a row")},
        "tiara": {"pro": True, "buy": "t3", "earn": ach("flawless_streak", "Win a Flawless Victory 3 days in a row")},
        "minicrown": {"pro": True, "buy": "t2", "earn": ach("halfway_hero", "Clear five rungs of the bot ladder")},
        "grad": {"pro": True, "buy": "t2", "earn": ach("century_club", "Win 100 games")},
        "wizard": {"pro": True, "buy": "t2", "earn": ach("pangram_hunter", "Find 10 Hubbub pangrams")},
        "nightcap": {"pro": True, "buy": "t1", "earn": ach("night_owl", "Finish a daily between midnight and 4 AM")},
        "sprout": {"pro": True, "buy": "t1", "earn": ach("daily_debut", "Complete your first daily")},
        "flowercrown": {"pro": True, "buy": "t2", "earn": ach("squad_goals", "Have 10 friends")},
        "propeller": {"pro": True, "buy": "t2", "earn": ach("blitz", "Win any game in under 15 seconds")},
        "viking": {"pro": True, "buy": "t2", "earn": ach("unstoppable", "Win 5 VS matches in a row")},
        "mohawk": {"pro": True, "buy": "t3", "earn": stat("bestStreak", 100, "Keep a 100-day play streak")},
        "astronaut": {"pro": True, "buy": "t3", "earn": stat("level", 50, "Reach level 50")},
        "tophat": {"pro": True, "buy": "t2", "earn": ach("vs_veteran", "Win 10 VS matches")},
        "sweatband": {"pro": True, "buy": "t1", "earn": ach("athlete_free", "")},  # replaced below
    },
    "face": {
        "monocle": {"pro": True, "buy": "t2", "earn": ach("boss_battle", "Beat Webster, the final boss")},
        "starglasses": {"pro": True, "buy": "t2", "earn": ach("hive_mind", "Reach the top rank in Hubbub")},
        "heart-glasses": {"pro": True, "buy": "t1", "earn": ach("cheerleader", "Send 25 reactions")},
    },
    "neck": {
        # Pro today: wings, chain
        "wings": {"pro": True, "buy": "t3", "earn": ach("iron_will", "Complete the Daily Sweep 30 days in a row")},
        "chain": {"pro": True, "buy": "t3", "earn": ach("gold_rush", "Earn 50 gold medals")},
        "medal": {"pro": True, "buy": "t1", "earn": ach("medal_10", "Earn 10 medals")},
        "supercape": {"pro": True, "buy": "t3", "earn": ach("meet_the_cast", "Beat all ten cast bots")},
        "cape": {"pro": True, "buy": "t2", "earn": ach("wake_up_call", "Beat Rip in a VS battle")},
        "fairywings": {"pro": True, "buy": "t3", "earn": stat("bestLoginStreak", 50, "Open Wordocious 50 days in a row")},
        "guitar": {"pro": True, "buy": "t2", "earn": ach("hat_trick", "Win 3 dailies in under 60 seconds each in one day")},
    },
    "held": {
        "wand-star": {"pro": True, "buy": "t3", "earn": ach("puzzle_week", "Sweep the Puzzles 7 days in a row")},
        "trophy": {"pro": True, "buy": "t2", "earn": ach("race_day", "Win today's friends race")},
        "magnifier": {"pro": True, "buy": "t1", "earn": ach("sharp_spotter", "Solve 25 Spyglass word searches")},
        "pencil-big": {"pro": True, "buy": "t1", "earn": ach("kindred_regular", "Solve 25 Kindreds")},
        "mic": {"pro": True, "buy": "t2", "earn": ach("untouchable", "Win 10 VS matches in a row")},
        "flashlight": {"pro": True, "buy": "t1", "earn": ach("code_cracker", "Solve 25 Codebreakers")},
    },
    "wrap": {
        "cape-drape": {"pro": True, "buy": "t3", "earn": ach("grand_sweep", "Sweep every daily and every Puzzle in one day")},
    },
    "feet": {
        "skates": {"pro": True, "buy": "t2", "earn": ach("speed_sweep", "Finish the Daily Sweep in under 15 minutes")},
        "boots": {"pro": True, "buy": "t1", "earn": ach("ladder_climber", "Solve 25 Letter Ladders")},
    },
    "pet": {
        # Buddies are the premium line: never in the starter set; each has a play route.
        "bird": {"pro": True, "buy": "t3", "earn": ach("early_bird", "Finish a daily before 7 AM")},
        "kitten": {"pro": True, "buy": "t3", "earn": stat("bestStreak", 7, "Keep a 7-day play streak")},
        "puppy": {"pro": True, "buy": "t3", "earn": ach("ride_or_die", "Keep a 7-day friend streak")},
        "snail": {"pro": True, "buy": "t3", "earn": ach("dedicated", "Play 500 games")},
    },
    "frame": {
        # Tier frames are earned by level today (FRAME_UNLOCK_LEVEL) and stay earn-only; Pro frames stay Pro.
        "bronze": {"earn": stat("level", 1, "Reach level 1")},
        "silver": {"earn": stat("level", 11, "Reach level 11")},
        "gold": {"earn": stat("level", 26, "Reach level 26")},
        "platinum": {"earn": stat("level", 51, "Reach level 51")},
        "diamond": {"pro": True},
        "pro": {"pro": True},
    },
    "bg": {
        "aurora": {"pro": True, "buy": "t2", "earn": ach("sweep_streak_7", "Complete the Daily Sweep 7 days in a row")},
        "galaxy": {"pro": True, "buy": "t2", "earn": ach("starstruck", "Solve 25 Starsweeps")},
        "starry": {"pro": True, "buy": "t1", "earn": ach("perfect_constellation", "Solve a Starsweep with no wrong stars")},
        "confetti": {"pro": True, "buy": "t1", "earn": ach("first_win", "Win any game")},
    },
    "pose": {
        "cheer": {"pro": True, "buy": "t1", "earn": ach("first_win", "Win any game")},
        "flex": {"pro": True, "buy": "t1", "earn": ach("century_club", "Win 100 games")},
        "jump": {"pro": True, "buy": "t1", "earn": stat("level", 10, "Reach level 10")},
    },
}
RULES["head"]["sweatband"] = {"pro": True, "buy": "t1", "earn": ach("no_sweat", "Win Classic in 2 guesses")}

# The field default for everything not in the starter set and not overridden: Pro or a direct buy.
DEFAULT_TIER = {
    "body": "t2", "color": "t1", "pattern": "t1", "eyes": "t1", "brows": "t1", "nose": "t1", "cheeks": "t1",
    "mouth": "t1", "extra": "t1", "head": "t2", "face": "t1", "neck": "t2", "held": "t2", "wrap": "t1",
    "feet": "t1", "pet": "t3", "frame": "t2", "bg": "t1", "pose": "t1",
}

# Limited: none of today's everyday items. Seasonal items keep the 10-05 rules (free in season, kept if saved);
# the proposal adds a buy route that only opens INSIDE the season window (`limited`), so a player who missed the
# free window can't pick one up out of season (it comes back next year).
SEASON_BUY = "t2"
# Fields whose overrides are the WHOLE rule (not merged onto Pro + buy): the frames keep today's routes exactly.
EXACT_FIELDS = {"frame"}

def rule_for(field, pid):
    season = season_of(field, pid)
    if season and field == "body":     # seasonal bodies never leave: free in season, then Pro or buy
        return {"season": season, "pro": True, "buy": SEASON_BUY}
    if season:
        return {"season": season, "limited": True, "buy": SEASON_BUY}
    if pid in STARTER[field]:
        return {"free": True}
    over = RULES.get(field, {}).get(pid)
    if field in EXACT_FIELDS and over is not None:
        return dict(over)
    r = {"pro": True, "buy": DEFAULT_TIER[field]}
    r.update(over or {})
    return r

def build():
    parts = {}
    for field, ids in FIELDS.items():
        for pid in ids:
            if pid in ALWAYS_FREE:
                continue
            parts[f"{field}:{pid}"] = rule_for(field, pid)
    return parts

def routes_text(r):
    out = []
    if r.get("free"): out.append("free (starter)")
    if r.get("season"): out.append(f"free in {r['season']} season")
    if r.get("pro"): out.append("Pro")
    if r.get("buy"): out.append(f"buy ${TIERS[r['buy']]:.2f}" + (" (in season only)" if r.get("limited") else ""))
    if r.get("earn"):
        e = r["earn"]
        src = f"achievement `{e['achievement']}`" if "achievement" in e else f"`{e['stat']}` ≥ {e['min']}"
        out.append(f"earn: {e['label']} ({src})")
    return " · ".join(out)

def main():
    parts = build()
    table = {
        "version": 1,
        "status": "PROPOSED — founder approval pending (docs/cloud-prompts/11). Read only while itemGating is on (OFF).",
        "tiers": TIERS,
        "stats": ["level", "currentStreak", "bestStreak", "bestLoginStreak"],
        "parts": parts,
    }
    text = json.dumps(table, indent=2) + "\n"
    outs = [
        os.path.join(ROOT, "docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.json"),
        os.path.join(CORE, "avatar-access.json"),
        os.path.join(ROOT, "apps/ios/Wordocious/Resources/avatar-access.json"),
        os.path.join(ROOT, "apps/android/app/src/main/assets/avatar-access.json"),
    ]
    for p in outs:
        open(p, "w").write(text)
        print("wrote", os.path.relpath(p, ROOT))

    # the readable proposal
    counts = {"free": 0, "pro": 0, "buy": 0, "earn": 0, "season": 0}
    for r in parts.values():
        for k in counts:
            if r.get(k): counts[k] += 1
    lines = [
        "# Mascot access table — PROPOSAL (founder approves later)",
        "",
        "Generated by `docs/design/brand/avatar/access/make-access-table.py` (edit its tables and re-run; never hand-edit).",
        "Decisions it follows: `UNLOCKS-AND-SHOP.md` (direct buy or earn, Pro unlocks most, most options gated for free",
        "players except a small starter set, everything try-on-able). The mechanism reads the same data",
        "(`packages/core/src/avatar-access.json`) only while the `itemGating` flag is on — it ships **OFF**.",
        "",
        "## How to read it",
        "- **free (starter)** — everyone, forever. Includes everything the seeded default mascot and the ten cast presets",
        "  can produce (5 bodies, 16 colors, 4 eyes, 4 mouths), so nobody's default look is ever locked.",
        "- **Pro** — included with Pro. Everything Pro-only today stays Pro (no Pro member loses anything).",
        "- **buy $X** — a direct, non-consumable purchase per item (no currency, no random packs). Tiers:",
        "  " + " · ".join(f"`{k}` ${v:.2f}" for k, v in TIERS.items()) + ".",
        "- **earn** — tied to data the server already records: an existing achievement, or a profile stat",
        "  (`level`, `current_streak`, `best_streak`, `best_daily_login_streak`). Once earned it's yours forever.",
        "- **free in season** — the 10-05 seasonal rule (free inside the window, kept if saved). Proposed: a buy route",
        "  that only opens *inside* the window (limited), so out of season they stay retired until next year.",
        "- Not listed (always free): every `none`, the solid pattern, the auto backdrop, the default accessory color.",
        "- A part the player already **saved** is never stripped (grandfathered) even if it's gated later.",
        "",
        f"**Totals** ({len(parts)} options): {counts['free']} starter-free · {counts['pro']} in Pro · {counts['buy']} buyable · "
        f"{counts['earn']} earnable · {counts['season']} seasonal.",
        "",
        "## Recommended free starter set",
        "",
    ]
    for field, ids in STARTER.items():
        if ids:
            lines.append(f"- **{field}**: " + ", ".join(ids))
    lines += ["", "## Founder decisions needed", "",
              "1. Approve / edit the starter set (above).",
              "2. Price tiers ($0.99 / $1.99 / $2.99 / $4.99) and which tier each item sits in.",
              "3. Rares that are earn-or-buy but NOT in Pro? (This draft keeps every gated item in Pro: 'Pro unlocks most'.)",
              "4. Earn-only prestige items: the tier frames (by level) are earn-only today; any others?",
              "5. Seasonal: keep free-in-season, and add the in-season buy route (limited) or not?",
              "6. Gating existing free items: players who *saved* them keep them; anyone else would see them locked.",
              "", "## The table", ""]
    for field, ids in FIELDS.items():
        lines.append(f"### {field}")
        lines.append("")
        lines.append("| id | routes |")
        lines.append("|---|---|")
        for pid in ids:
            if pid in ALWAYS_FREE:
                continue
            lines.append(f"| {pid} | {routes_text(parts[f'{field}:{pid}'])} |")
        lines.append("")
    open(os.path.join(ROOT, "docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.md"), "w").write("\n".join(lines))
    print("wrote docs/design/brand/avatar/ACCESS-TABLE-PROPOSAL.md")

if __name__ == "__main__":
    main()
