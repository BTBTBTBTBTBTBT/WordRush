# Block 2 (Mon Nov 30 -> Sun Dec 27, 2026): the post data. build-block2.py turns this into the JSON, SQL, queue, manifest stubs and the calendar doc.
# Every caption: American spelling, no emoji, no answers for live puzzles, exact prices only.
HT_X = ['wordgames', 'dailypuzzle', 'wordocious']
HT_F = ['wordgames', 'dailypuzzle', 'puzzlegames', 'wordocious']
def ht(base, *extra): return list(base) + list(extra)

# WOTD quiz days (verified against wordOfDay(); none is a puzzle answer that day). answer = the right choice letter (never in a caption).
WOTD = {
 '2026-12-03': ('CHILI', 'noun', ['A frozen dessert on a stick', 'The spicy fruit of a pepper plant', 'A narrow pass between mountains'], 'b'),
 '2026-12-08': ('HONOR', 'noun', ['A small, sharp pain', 'A thick, low fog', 'Respect or recognition for someone\'s worth'], 'c'),
 '2026-12-10': ('VOTED', 'adjective', ['Chosen or decided by ballots or a show of hands', 'Covered in fine dust', 'Too tired to continue'], 'a'),
 '2026-12-15': ('BLEAK', 'adjective', ['Bright and cheerful', 'Bare and cold, without comfort', 'Quick to anger'], 'b'),
 '2026-12-17': ('EXTRA', 'adjective', ['More than is usual or needed', 'Out of sight', 'Slightly damaged'], 'a'),
 '2026-12-24': ('HASTE', 'noun', ['A small cottage by the sea', 'A feeling of regret', 'Speed or hurry in doing something'], 'c'),
}
def wotd_caption(date, platform):
    w, pos, opts, _ = WOTD[date]
    body = f'Word of the Day: {w} ({pos})\n\n(a) {opts[0]}\n(b) {opts[1]}\n(c) {opts[2]}\n\n'
    if platform == 'x': return body + 'No lookups. Answer tonight. Hubbub today: seven letters, one pangram.' if date in TEASE else body + 'No lookups. Answer tonight.'
    return body + ('No lookups. Answer in the replies tonight.\n\nAnd today\'s Hubbub has seven letters and a pangram that uses them all. Find it.' if date in TEASE else 'No lookups. Answer in the replies tonight.')
TEASE = {'2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24'}

P = []   # list of dicts
def add(date, time, slot, kind, title, series, season, size, tags, link, targets, headline=None, sub=None, cast=(), setting='', layout='', hint='hint: none', note=None, paused=False, content=None, holiday=None, asset='', beat=''):
    P.append(dict(date=date, time=time, slot=slot, kind=kind, title=title, series=series, season=season, size=size, hashtags=tags, link_target=link,
                  targets=targets, headline=headline, sub=sub, cast=list(cast), setting=setting, layout=layout, hint=hint, note=note, paused=paused,
                  content=content, holiday=holiday, asset_hint=asset, beat=beat))
H = 'https://wordocious.com/'
PRO = 'https://wordocious.com/pro'

# ============================================================ WEEK 1 (Nov 30 - Dec 6)
add('2026-11-30', '08:00', 'x', 'ritual', 'Monday Masters: race reset', 'monday', 'standard', 'landscape', HT_X, H,
    {'x': 'MONDAY MASTERS.\n\nNew week. Zero points. The crown is open, and the leftovers do not count. Last week\'s champion is on the Leaderboard. Come take it.',
     'threads': 'MONDAY MASTERS.\n\nNew week. Zero points. The weekly race just reset and everyone starts level, even the cousin who won the turkey argument. Last week\'s champion is on the Leaderboard tab. Come take the crown.'},
    'MONDAY MASTERS', 'THE CROWN IS OPEN.', ['u', 's', 'r'], 'plain lilac-to-pink kit sky (standard look, Thanksgiving is over), soft bokeh, the three standing in a relaxed row',
    beat='Monday review #8; Thanksgiving is over, standard look', asset='mon-masters title art')
add('2026-11-30', '11:30', 'feed', 'post', 'Thanksgiving is over: who did the dishes? (and tomorrow)', 'thanks-recap', 'standard', 'portrait', HT_F, H,
    {'instagram': 'The turkey is gone. The dishes are done (by somebody). The family league has a winner.\n\nWho lost at your table? Tell us below, then get your rematch started.\n\nSomething is changing in the app tomorrow. Look closely at the cast.\n\nPlay free: link in bio.',
     'facebook': 'The turkey is gone, the dishes are done by somebody, and the family league has a winner. Who lost at your table? Tell us in the comments and start the rematch. Something is changing in the app tomorrow: look closely at the cast.',
     'threads': 'The turkey is gone and the dishes are done by somebody. Who lost your family league? Rematch starts today. Something changes in the app tomorrow.'},
    'DISHES ARE DONE', 'REMATCH STARTS NOW.', ['w', 'd', 'o1'], 'a kitchen-counter scene after the feast: a tidy stack of plates and a dish towel, the cast relaxed; ONE tiny snowflake drifting at the very edge of a window (the subtle hint for tomorrow)',
    hint='hint: a single snowflake at the edge (subtle nod to tomorrow\'s winter season, not a giveaway)', beat='Thanksgiving recap + one-day tease', asset='cast art')

add('2026-12-01', '08:00', 'x', 'season', 'Winter reveal: the app put on a coat', 'winter', 'winter', 'landscape', ht(HT_X, 'winter'), H,
    {'x': 'WINTER IS HERE.\n\nThe cast got dressed again: Christmas, Hanukkah and Kwanzaa, plus snow on every screen. Open the app and see who is wearing what.',
     'threads': 'WINTER IS HERE.\n\nThe cast got dressed again. Christmas, Hanukkah and Kwanzaa are all in the closet this time, and every screen has snow on it. Open the app and see who is wearing what.'},
    'WINTER IS HERE', 'THE WHOLE APP PUT ON A COAT.', ['w', 'd', 'u', 'o1'], 'snowy winter-night home wall with warm string lights, a lit window glow, the four standing in a group, soft snowfall',
    note='Tied to the winter build going live Dec 1 (core SEASON_WINDOWS must have the winter-holidays row, ready: true, and the store build approved). If the build slips, move to the ship date and keep it paused until then.',
    paused=True, beat='WINTER SEASON ON (Dec 1-26): the social reveal of a look players already have', asset='screen recording of season flip')
add('2026-12-01', '11:30', 'feed', 'season', 'Winter reveal: wallpaper and costumes', 'winter', 'winter', 'portrait', ht(HT_F, 'winter'), H,
    {'instagram': 'WINTER IS HERE.\n\nSnow on every screen, warm lights on the home wall, and the whole cast in costume: Christmas hats, a Hanukkah sweater, a Kwanzaa wrap and more.\n\nThe daily games are the same. The outfits are not. Play free: link in bio.',
     'facebook': 'WINTER IS HERE. The whole Wordocious app dressed for the season: snow on every screen, warm lights and a cast in Christmas, Hanukkah and Kwanzaa costumes. The daily games are the same; the outfits are not.',
     'threads': 'WINTER IS HERE. Snow on every screen and the whole cast in costume. Same daily games, new outfits.'},
    'WINTER IS HERE', 'SNOW ON EVERY SCREEN.', ['r', 'c', 's', 'o3', 'i'], 'a cozy snow-globe feel: frosted window frame, string lights, five cast members standing in a relaxed arc',
    note='Same release gate as the X reveal.', paused=True, beat='Winter season reveal', asset='season flip stills')
add('2026-12-01', '18:00', 'video', 'video', '[Needs capture] Winter transformation reveal', 'winter', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'The app got dressed again.\n\nSnow, lights, and a cast in Christmas, Hanukkah and Kwanzaa costumes. Open Wordocious and look.\n\nPlay free: link in bio.',
     'instagram': 'The app got dressed again.\n\nSnow, lights, and a cast in Christmas, Hanukkah and Kwanzaa costumes. Open Wordocious and look.\n\nPlay free: link in bio.'},
    note='Capture the season flip in the iPhone simulator demo mode; paused until captured and the build is live.', paused=True, asset='season flip recording', beat='Winter reveal')

add('2026-12-02', '08:00', 'x', 'muddle', 'Muddle Wednesday', 'muddle', 'winter', 'landscape', HT_X, H,
    {'x': 'MUDDLE WEDNESDAY.\n\nYesterday\'s Muddle: four words, one punchline, one cartoon. Caption it before you scroll.',
     'threads': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today\'s Muddle.'},
    'MUDDLE WEDNESDAY', 'FOUR WORDS. ONE PUNCHLINE.', ['o2', 'i'], 'two mascots standing low at the far left and far right, cozy snowy wall, calm empty center for the cartoon',
    layout='only TWO mascots, far left and far right, low; leave the center (about 30 percent of the width, sub line down to the floor) empty for a cartoon added in code',
    content='cartoon|<yesterday Muddle cartoon file>|520', hint='hint: none (yesterday\'s, already-played cartoon; caption and answer not shown)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')
add('2026-12-02', '11:30', 'feed', 'muddle', 'Muddle Wednesday: caption this', 'muddle', 'winter', 'portrait', HT_F, H,
    {'instagram': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll.\n\nToday\'s Muddle is live. Play free: link in bio.',
     'facebook': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today\'s Muddle is live.',
     'threads': 'MUDDLE WEDNESDAY. Yesterday\'s cartoon is up. Caption it before you scroll.'},
    'MUDDLE WEDNESDAY', 'CAPTION THIS.', ['d', 's'], 'two mascots standing low under a calm empty rectangle (70% width x 28% height) for the cartoon, frosty wall',
    layout='calm empty rectangle ~70% x 28% between the sub line and the mascots\' heads, mascots standing low (heads below 68% of the height), headline in the top 33%',
    content='cartoon|<yesterday Muddle cartoon file>|700', hint='hint: none (yesterday\'s, already-played cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')

add('2026-12-03', '08:00', 'x', 'wotd', 'WOTD quiz CHILI + Hubbub pangram tease', 'wotd', 'winter', 'landscape', HT_X, H,
    {'x': wotd_caption('2026-12-03', 'x'), 'threads': wotd_caption('2026-12-03', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['c', 'o3'], 'two mascots low and small at the sides, cocoa-steam and snow, calm empty band (28% of height / center 30% of width) for the word tiles',
    layout='leave a completely empty calm band (about 20 percent of the height, nothing in it) directly under the headline for the word card added in code; heads no higher than 62 percent of the height',
    content='wotd|CHILI|WORD OF THE DAY|1.2', hint='hint: the word card shows the day\'s Word of the Day only (not a puzzle answer)', asset='WOTD card / Hubbub', beat='WOTD + Hubbub pangram tease')
for n, (hd, sb, cast, kind_, link_, cap, setting_) in enumerate([
    ('HOW TO PLAY SPYGLASS', 'A NEW PUZZLE EVERY DAY.', ['u', 'r'], 'explainer', 'https://wordocious.com/guides/spyglass',
     'How to play Spyglass, the daily word search on Wordocious: ten themed words hide in a 10 by 10 grid, the word list starts hidden too, and you find them from the theme alone. Words run across, down and diagonal, always forwards. A free daily puzzle for pattern spotters.',
     'a winter-night scene with a magnifying lens motif and a frosted grid of letter tiles at the edge (decor only)'),
    ('BLISS', 'WORD OF THE DAY', ['o2'], 'word', 'https://wordocious.com/word/2026-10-19',
     'Word of the Day: BLISS (noun). Perfect happiness. A new word every morning on Wordocious, with the archive of every past word.', 'cocoa steam and soft snow, one mascot centered'),
    ('MEET OPAL.', 'BRING YOUR FAMILY.', ['o2'], 'cast', H,
     'Meet Opal, the dramatic O in the Wordocious cast, rung four on the VS bot ladder. Every win is a standing ovation and every loss is a tragedy. Ten letter characters host every corner of the free daily puzzle app.',
     'Opal in her winter cape and muff, glowing string lights')]):
    add('2026-12-03', ['13:00', '15:00', '17:00'][n], 'pin', 'pin', f'Pin: {["How to play Spyglass", "Word card, BLISS", "Cast art, Opal"][n]}', 'pin-' + kind_, 'winter', 'pin', HT_F, link_,
        {'pinterest': cap}, hd, sb, cast, setting_, hint='hint: none' + (' (BLISS was the Oct 19 Word of the Day: a past word)' if kind_ == 'word' else ''), asset='evergreen', beat='WOTD + pangram tease; pins day')
add('2026-12-03', '18:00', 'video', 'video', '[Needs capture] 18 Days ep.15: ProperNoundle', '18days', 'winter', 'portrait', HT_F, H,
    {'tiktok': '18 Days of Wordocious, episode 15: ProperNoundle.\n\nA daily name-guessing puzzle: places, people and things, and every guess teaches you something.\n\nFree daily: link in bio.',
     'instagram': '18 Days of Wordocious, episode 15: ProperNoundle.\n\nA daily name-guessing puzzle: places, people and things, and every guess teaches you something.\n\nFree daily: link in bio.'},
    note='Check the one-line description against the live ProperNoundle rules before capture.', paused=True, asset='storeShot capture', beat='18 Days')

add('2026-12-04', '07:00', 'holiday', 'season', 'Happy Hanukkah (morning greeting)', 'holiday-hanukkah', 'winter', 'portrait', ['hanukkah', 'wordocious'], H,
    {'x': 'Happy Hanukkah from the whole cast.\n\nThe first candle is lit tonight. Wishing you light, latkes and a little friendly competition.',
     'threads': 'Happy Hanukkah from the whole cast.\n\nThe first candle is lit tonight. Wishing you light, latkes, gelt and a little friendly competition around the table.',
     'instagram': 'Happy Hanukkah from the whole cast.\n\nThe first candle is lit tonight. Wishing you eight nights of light, latkes, gelt and a little friendly competition around the table.\n\nPlay free: link in bio.',
     'facebook': 'Happy Hanukkah from the whole Wordocious cast. The first candle is lit tonight. Wishing you and your family eight nights of light, latkes and a little friendly competition around the table.'},
    'HAPPY HANUKKAH', 'LIGHT UP THE NIGHT.', ['d', 'c', 'r'], 'a warm blue-and-silver winter evening: a hanukkiah (nine holders: four, the raised center shamash, four) with night one set (shamash plus ONE candle at the far right, both lit, the other seven holders empty), a dreidel (nun, gimel), gelt, a plate of latkes, soft snow',
    holiday='hanukkah', note='Greeting at 7 AM CT on Dec 4: Hanukkah begins at sundown tonight, so a morning-of post lets people see it before lighting. Themed puzzles in the app are on Dec 5 (data/holiday-days.json), so do NOT say "today\'s themed puzzles".',
    paused=True, beat='HANUKKAH begins at sundown (Dec 4-12)', asset='holiday greeting art (own image)')
add('2026-12-04', '08:00', 'x', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'landscape', HT_X, H,
    {'x': 'FRIDAY\'S FINEST.\n\nThe best board of the week. Think yours beats it? Post it and make your case.',
     'threads': 'FRIDAY\'S FINEST.\n\nThe best board of the week goes here. Think yours beats it? Share your board in the replies and make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['s', 'w'], 'a podium-free scene: two mascots in winter costume with a gold ribbon rosette between them, string lights',
    asset='share cards', beat='FRIDAY\'S FINEST')
add('2026-12-04', '11:30', 'feed', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'portrait', HT_F, H,
    {'instagram': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.\n\nPlay today\'s puzzles free: link in bio.',
     'facebook': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.',
     'threads': 'FRIDAY\'S FINEST. The best board of the week. Think yours beats it? Make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['o1', 'u', 'i'], 'three mascots cheering around a small gold trophy, snowy window behind', asset='share cards', beat='FRIDAY\'S FINEST')
add('2026-12-04', '18:00', 'video', 'video', '[Needs capture] Hanukkah night one: cast clip', 'cast', 'winter', 'portrait', ht(HT_F, 'hanukkah'), H,
    {'tiktok': 'Night one.\n\nThe cast is lighting up the daily board. Happy Hanukkah.\n\nPlay free: link in bio.',
     'instagram': 'Night one.\n\nThe cast is lighting up the daily board. Happy Hanukkah.\n\nPlay free: link in bio.'},
    note='Cast-led clip (cast-scene.py): D and C with the dreidel and gelt. Paused until captured.', paused=True, asset='cast art', beat='Hanukkah night one')

add('2026-12-05', '08:00', 'x', 'cast', 'Cast Saturday: Dewey studies every letter', 'cast', 'winter', 'landscape', ht(HT_X, 'hanukkah'), H,
    {'x': 'Meet Dewey, rung eight on the bot ladder.\n\nHe studies every letter. Today\'s themed puzzles are live for Hanukkah. Beat him if you can.',
     'threads': 'Meet Dewey, rung eight on the bot ladder.\n\nHe studies every letter and wears the Hanukkah sweater well. Today\'s themed puzzles are live. Beat Dewey, then tell us which rung is next.'},
    'DEWEY STUDIES EVERY LETTER', 'CAST SATURDAY', ['d'], 'D alone in the Hanukkah dreidel sweater and beanie holding gelt, blue and silver night, snow, one hanukkiah glowing softly behind',
    note='Themed puzzles: Dec 5 is the app\'s Hanukkah day. Verify the live app before approving.', asset='cast art', beat='CAST SATURDAY')
add('2026-12-05', '18:00', 'video', 'video', '[Needs capture] Cast Saturday video: Dewey', 'cast', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'Meet Dewey, rung eight on the bot ladder.\n\nHe studies every letter. Beat him if you can.\n\nPlay free: link in bio.',
     'instagram': 'Meet Dewey, rung eight on the bot ladder.\n\nHe studies every letter. Beat him if you can.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='CAST SATURDAY')

add('2026-12-06', '08:00', 'x', 'ritual', 'Sweep Sunday', 'sweep', 'winter', 'landscape', HT_X, H,
    {'x': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post yours.',
     'threads': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['r'], 'R alone in the quilt wrap and striped nightcap holding a cocoa mug, soft snow, midnight-indigo glow', asset='sweep share card', beat='SWEEP SUNDAY')
add('2026-12-06', '11:30', 'fb', 'ritual', 'Sweep Sunday (Facebook)', 'sweep', 'winter', 'portrait', HT_F, H,
    {'facebook': 'SWEEP SUNDAY.\n\nCan you sweep all 18 dailies today? Hanukkah is on and the cold is in, so there is no better afternoon for it. Share your sweep board in the comments.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['c', 'o1', 'w'], 'three mascots with a tall stack of colorful game tiles and a mug of cocoa, snowy window', asset='sweep share card', beat='SWEEP SUNDAY')

# ============================================================ WEEK 2 (Dec 7 - 13)
add('2026-12-07', '08:00', 'x', 'ritual', 'Monday Masters: race reset', 'monday', 'winter', 'landscape', HT_X, H,
    {'x': 'MONDAY MASTERS.\n\nNew week. Zero points. The crown is open. Last week\'s champion is on the Leaderboard. Come take it.',
     'threads': 'MONDAY MASTERS.\n\nNew week. Zero points. The weekly race just reset and everyone starts level. Last week\'s champion is on the Leaderboard tab. Come take the crown.'},
    'MONDAY MASTERS', 'THE CROWN IS OPEN.', ['o3', 'i', 'd'], 'frosty blue-silver night, a gold crown resting on a snowdrift in the middle distance', asset='mon-masters title art', beat='MONDAY MASTERS')
add('2026-12-08', '08:00', 'x', 'wotd', 'Word of the Day quiz: HONOR', 'wotd', 'winter', 'landscape', HT_X, H,
    {'x': wotd_caption('2026-12-08', 'x'), 'threads': wotd_caption('2026-12-08', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['u', 'w'], 'two mascots low at the sides, pine branches and snow, calm empty band for the word card',
    layout='leave a completely empty calm band (about 20 percent of the height) directly under the headline for the word card added in code',
    content='wotd|HONOR|WORD OF THE DAY|1.2', hint='hint: word card shows the day\'s Word of the Day only', asset='WOTD card', beat='WOTD quiz')
add('2026-12-08', '18:00', 'video', 'video', '[Needs capture] 18 Days ep.16: Classic Six', '18days', 'winter', 'portrait', HT_F, H,
    {'tiktok': '18 Days of Wordocious, episode 16: Classic Six.\n\nThe same daily word puzzle with a six-letter word. One more letter changes everything.\n\nFree daily: link in bio.',
     'instagram': '18 Days of Wordocious, episode 16: Classic Six.\n\nThe same daily word puzzle with a six-letter word. One more letter changes everything.\n\nFree daily: link in bio.'},
    paused=True, asset='storeShot capture', beat='18 Days')

add('2026-12-09', '08:00', 'x', 'muddle', 'Muddle Wednesday', 'muddle', 'winter', 'landscape', HT_X, H,
    {'x': 'MUDDLE WEDNESDAY.\n\nYesterday\'s Muddle is up: four scrambled words and one punchline. Caption the cartoon before you scroll.',
     'threads': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today\'s Muddle.'},
    'MUDDLE WEDNESDAY', 'FOUR WORDS. ONE PUNCHLINE.', ['c', 'o1'], 'two mascots far left and far right, low, with a calm empty center',
    layout='only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code',
    content='cartoon|<yesterday Muddle cartoon file>|520', hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')
add('2026-12-09', '11:30', 'feed', 'muddle', 'Muddle Wednesday: caption this', 'muddle', 'winter', 'portrait', HT_F, H,
    {'instagram': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up. Four scrambled words, one punchline, and you have until you scroll to caption it.\n\nToday\'s Muddle is live. Play free: link in bio.',
     'facebook': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up: four scrambled words and one punchline. Caption it in the comments before you scroll. Today\'s Muddle is live.',
     'threads': 'MUDDLE WEDNESDAY. Yesterday\'s cartoon is up. Caption it before you scroll.'},
    'MUDDLE WEDNESDAY', 'CAPTION THIS.', ['r', 'u'], 'two mascots low under a calm empty rectangle for the cartoon, cozy snow-lit wall',
    layout='calm empty rectangle ~70% x 28% between the sub line and the mascots\' heads; mascots low', content='cartoon|<yesterday Muddle cartoon file>|700',
    hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')

add('2026-12-10', '08:00', 'x', 'wotd', 'WOTD quiz VOTED + Hubbub pangram tease', 'wotd', 'winter', 'landscape', HT_X, H,
    {'x': wotd_caption('2026-12-10', 'x'), 'threads': wotd_caption('2026-12-10', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['r', 'd'], 'two mascots low at the sides, string lights across the top, snow, calm empty band for the word card',
    layout='completely empty calm band (about 20 percent of the height) under the headline for the word card added in code',
    content='wotd|VOTED|WORD OF THE DAY|1.2', hint='hint: Word of the Day on the card only', asset='WOTD card / Hubbub', beat='WOTD + Hubbub pangram tease')
for n, (hd, sb, cast, kind_, link_, cap, setting_) in enumerate([
    ('HOW TO PLAY SUDOCIOUS', 'A NEW PUZZLE EVERY DAY.', ['d', 'i'], 'explainer', 'https://wordocious.com/guides/sudocious',
     'How to play Sudocious, the daily number grid on Wordocious: one Medium puzzle a day on a 9 by 9 board, pencil notes to keep track, and the third mistake ends the game. A free daily puzzle for logic fans.', 'frosty winter study, a few glossy number tiles floating at the edges (decor only, no solved grid)'),
    ('SCORE', 'WORD OF THE DAY', ['o3', 'c'], 'word', 'https://wordocious.com/word/2026-11-26',
     'Word of the Day: SCORE (noun). The total number of goals, points, runs, etc. earned by a participant in a game. A new word every morning on Wordocious, with the archive of every past word.', 'snow and gold confetti sparkle'),
    ('MEET W.', 'BRING YOUR FAMILY.', ['w'], 'cast', H,
     'Meet W, the leader of the Wordocious cast, in a Santa hat for the season. Ten letter characters spell WORDOCIOUS, and each one hosts a corner of the free daily puzzle app. W is Webster, rung ten on the VS bot ladder, and runs Classic.', 'W alone in the Santa hat, belt and mittens, snowy village glow')]):
    add('2026-12-10', ['13:00', '15:00', '17:00'][n], 'pin', 'pin', f'Pin: {["How to play Sudocious", "Word card, SCORE", "Cast art, W (Santa)"][n]}', 'pin-' + kind_, 'winter', 'pin', HT_F, link_,
        {'pinterest': cap}, hd, sb, cast, setting_, hint='hint: none' + (' (SCORE was the Nov 26 Word of the Day)' if kind_ == 'word' else ''), asset='evergreen', beat='pins day')
add('2026-12-10', '18:00', 'video', 'video', '[Needs capture] 18 Days ep.17: Classic Seven', '18days', 'winter', 'portrait', HT_F, H,
    {'tiktok': '18 Days of Wordocious, episode 17: Classic Seven.\n\nSeven letters, one daily word, and a lot of second-guessing.\n\nFree daily: link in bio.',
     'instagram': '18 Days of Wordocious, episode 17: Classic Seven.\n\nSeven letters, one daily word, and a lot of second-guessing.\n\nFree daily: link in bio.'},
    paused=True, asset='storeShot capture', beat='18 Days')

add('2026-12-11', '08:00', 'x', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'landscape', ht(HT_X, 'hanukkah'), H,
    {'x': 'FRIDAY\'S FINEST.\n\nThe best board of the week. The last Hanukkah candle is tonight, so bring your best. Post yours and make your case.',
     'threads': 'FRIDAY\'S FINEST.\n\nThe best board of the week goes here. The last Hanukkah candle is lit tonight, so bring your best board. Share it in the replies and make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['i', 'o2', 'c'], 'three mascots in a row with a gold ribbon rosette, warm window light, snow', asset='share cards', beat='FRIDAY\'S FINEST (last night of Hanukkah)')
add('2026-12-11', '11:30', 'feed', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'portrait', HT_F, H,
    {'instagram': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.\n\nPlay today\'s puzzles free: link in bio.',
     'facebook': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.',
     'threads': 'FRIDAY\'S FINEST. The best board of the week. Think yours beats it? Make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['s'], 'S alone with a determined look in the Kwanzaa kente sash, holding the corn baton like a trophy, snow', asset='share cards', beat='FRIDAY\'S FINEST')
add('2026-12-11', '18:00', 'video', 'video', '[Needs capture] Winter boards montage', 'friday', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'Winter boards, wall to wall.\n\nSnow on every screen and 18 daily games underneath it. Pick one.\n\nPlay free: link in bio.',
     'instagram': 'Winter boards, wall to wall.\n\nSnow on every screen and 18 daily games underneath it. Pick one.\n\nPlay free: link in bio.'},
    paused=True, asset='in-app montage', beat='FRIDAY video')

add('2026-12-12', '08:00', 'x', 'cast', 'Cast Saturday: Ozzy guesses tricky', 'cast', 'winter', 'landscape', HT_X, H,
    {'x': 'Meet Ozzy, rung seven on the bot ladder.\n\nTricky guesses and an ugly sweater he is proud of. Beat him anyway.',
     'threads': 'Meet Ozzy, rung seven on the bot ladder.\n\nTricky guesses, an ugly sweater he is very proud of, and zero fear. Beat Ozzy and the boss is only three rungs up.'},
    'OZZY GUESSES TRICKY', 'CAST SATURDAY', ['o3'], 'O3 alone in the knit ugly sweater and pom beanie with red mittens, warm string lights, snow', asset='cast art', beat='CAST SATURDAY')
add('2026-12-12', '18:00', 'video', 'video', '[Needs capture] Cast Saturday video: Ollie the reindeer', 'cast', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'Ollie cheers every guess. Even the wrong ones.\n\nNow with antlers.\n\nPlay free: link in bio.',
     'instagram': 'Ollie cheers every guess. Even the wrong ones.\n\nNow with antlers.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='CAST SATURDAY')

add('2026-12-13', '08:00', 'x', 'ritual', 'Sweep Sunday', 'sweep', 'winter', 'landscape', HT_X, H,
    {'x': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post yours.',
     'threads': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['o1', 'c'], 'two mascots, one on a sled-like sweep motif of colored tiles, snowy hill, midnight-indigo glow', asset='sweep share card', beat='SWEEP SUNDAY')
add('2026-12-13', '11:30', 'fb', 'ritual', 'Sweep Sunday (Facebook)', 'sweep', 'winter', 'portrait', HT_F, H,
    {'facebook': 'SWEEP SUNDAY.\n\nCan you sweep all 18 dailies today? Twelve days to Christmas is plenty of time to settle the family bragging rights. Share your sweep board in the comments.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['w', 'i', 'r'], 'three mascots around a glowing hearth-colored tile board, snowy window', asset='sweep share card', beat='SWEEP SUNDAY')

# ============================================================ WEEK 3 (Dec 14 - 20)
add('2026-12-14', '08:00', 'x', 'ritual', 'Monday Masters: race reset', 'monday', 'winter', 'landscape', HT_X, H,
    {'x': 'MONDAY MASTERS.\n\nNew week. Zero points. The crown is open. Last week\'s champion is on the Leaderboard. Come take it.',
     'threads': 'MONDAY MASTERS.\n\nNew week. Zero points. The weekly race just reset and everyone starts level. Last week\'s champion is on the Leaderboard tab. Come take the crown.'},
    'MONDAY MASTERS', 'THE CROWN IS OPEN.', ['s', 'o2'], 'icy blue night, snow-capped gold crown on a pedestal of snow, two mascots at the sides', asset='mon-masters title art', beat='MONDAY MASTERS')
add('2026-12-15', '08:00', 'x', 'wotd', 'Word of the Day quiz: BLEAK', 'wotd', 'winter', 'landscape', HT_X, H,
    {'x': wotd_caption('2026-12-15', 'x'), 'threads': wotd_caption('2026-12-15', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['i', 'o1'], 'two mascots low at the sides, evergreen branches, soft snow, calm empty band for the word card',
    layout='completely empty calm band (about 20 percent of the height) under the headline for the word card added in code',
    content='wotd|BLEAK|WORD OF THE DAY|1.2', hint='hint: Word of the Day on the card only', asset='WOTD card', beat='WOTD quiz')
add('2026-12-15', '18:00', 'video', 'video', '[Needs capture] 18 Days ep.18: Classic', '18days', 'winter', 'portrait', HT_F, H,
    {'tiktok': '18 Days of Wordocious, episode 18: Classic.\n\nWhere it started. One five-letter word, six guesses, and a cast that has opinions about all of them.\n\nFree daily: link in bio.',
     'instagram': '18 Days of Wordocious, episode 18: Classic.\n\nWhere it started. One five-letter word, six guesses, and a cast that has opinions about all of them.\n\nFree daily: link in bio.'},
    note='Series finale: show all 18 title cards at the end.', paused=True, asset='storeShot capture', beat='18 Days finale')

add('2026-12-16', '08:00', 'x', 'muddle', 'Muddle Wednesday', 'muddle', 'winter', 'landscape', HT_X, H,
    {'x': 'MUDDLE WEDNESDAY.\n\nYesterday\'s Muddle: four words, one punchline, one cartoon. Caption it before you scroll.',
     'threads': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today\'s Muddle.'},
    'MUDDLE WEDNESDAY', 'FOUR WORDS. ONE PUNCHLINE.', ['o3', 'w'], 'two mascots far left and far right, low, frosty wall, calm empty center',
    layout='only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code',
    content='cartoon|<yesterday Muddle cartoon file>|520', hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')
add('2026-12-16', '11:30', 'feed', 'muddle', 'Muddle Wednesday: caption this', 'muddle', 'winter', 'portrait', HT_F, H,
    {'instagram': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll.\n\nToday\'s Muddle is live. Play free: link in bio.',
     'facebook': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today\'s Muddle is live.',
     'threads': 'MUDDLE WEDNESDAY. Yesterday\'s cartoon is up. Caption it before you scroll.'},
    'MUDDLE WEDNESDAY', 'CAPTION THIS.', ['u', 'c'], 'two mascots low under a calm empty rectangle for the cartoon, warm lights on a frosted wall',
    layout='calm empty rectangle ~70% x 28% between the sub line and the mascots\' heads; mascots low', content='cartoon|<yesterday Muddle cartoon file>|700',
    hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')

add('2026-12-17', '08:00', 'x', 'wotd', 'WOTD quiz EXTRA + Hubbub pangram tease', 'wotd', 'winter', 'landscape', HT_X, H,
    {'x': wotd_caption('2026-12-17', 'x'), 'threads': wotd_caption('2026-12-17', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['s', 'o2'], 'two mascots low at the sides, gift boxes and ribbon at the edges, calm empty band for the word card',
    layout='completely empty calm band (about 20 percent of the height) under the headline for the word card added in code',
    content='wotd|EXTRA|WORD OF THE DAY|1.2', hint='hint: Word of the Day on the card only', asset='WOTD card / Hubbub', beat='WOTD + Hubbub pangram tease')
for n, (hd, sb, cast, kind_, link_, cap, setting_) in enumerate([
    ('HOW TO PLAY QUADWORD', 'A NEW PUZZLE EVERY DAY.', ['o1', 'u'], 'explainer', 'https://wordocious.com/guides/quadword',
     'How to play QuadWord, the four-board daily word puzzle on Wordocious: every word you type lands on all four boards at once, and nine guesses are shared across them. A free daily brain workout for multitaskers.', 'four frosted board-shaped windows glowing at the edges (decor only, no letters)'),
    ('NOBLE', 'WORD OF THE DAY', ['r'], 'word', 'https://wordocious.com/word/2026-11-08',
     'Word of the Day: NOBLE (noun). An aristocrat; one of aristocratic blood. A new word every morning on Wordocious, with the archive of every past word.', 'soft snow and a gold crown sparkle'),
    ('MEET OLLIE.', 'BRING YOUR FAMILY.', ['o1'], 'cast', H,
     'Meet Ollie, the cheerful O in the Wordocious cast, now with reindeer antlers. Ollie hosts QuadWord and Hubbub, cheers every guess and is the third rung on the bot ladder in VS Battle. Ten letter characters, one free daily puzzle app.', 'Ollie alone in the reindeer antlers and bell collar, string lights, snow')]):
    add('2026-12-17', ['13:00', '15:00', '17:00'][n], 'pin', 'pin', f'Pin: {["How to play QuadWord", "Word card, NOBLE", "Cast art, Ollie (reindeer)"][n]}', 'pin-' + kind_, 'winter', 'pin', HT_F, link_,
        {'pinterest': cap}, hd, sb, cast, setting_, hint='hint: none' + (' (NOBLE was the Nov 8 Word of the Day)' if kind_ == 'word' else ''), asset='evergreen', beat='pins day')
add('2026-12-17', '18:00', 'video', 'video', '[Needs capture] Time of day: the app changes color with the sun', 'winter', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'The app changes with the time of day.\n\nMorning, day, evening and night each get their own wall. Open Wordocious at different hours and watch.\n\nPlay free: link in bio.',
     'instagram': 'The app changes with the time of day.\n\nMorning, day, evening and night each get their own wall. Open Wordocious at different hours and watch.\n\nPlay free: link in bio.'},
    note='2.9 feature (time-of-day walls). Confirm 2.9 is live in both stores and the winter walls have the time-of-day variants before capture.', paused=True, asset='screen recording', beat='2.9 time-of-day tease')

add('2026-12-18', '08:00', 'x', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'landscape', HT_X, H,
    {'x': 'FRIDAY\'S FINEST.\n\nThe best board of the week. One week to Christmas and you still have time to earn the title. Post yours.',
     'threads': 'FRIDAY\'S FINEST.\n\nThe best board of the week goes here. One week to Christmas, so there is still time to earn the title. Share your board in the replies and make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['d', 'o3'], 'two mascots with a gold ribbon rosette between them, wrapped gifts at the edge', asset='share cards', beat='FRIDAY\'S FINEST')
add('2026-12-18', '11:30', 'feed', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'portrait', HT_F, H,
    {'instagram': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.\n\nPlay today\'s puzzles free: link in bio.',
     'facebook': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.',
     'threads': 'FRIDAY\'S FINEST. The best board of the week. Think yours beats it? Make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['r', 'u', 'w'], 'three mascots cheering with a small gold trophy, twinkling lights, snow', asset='share cards', beat='FRIDAY\'S FINEST')

add('2026-12-19', '08:00', 'x', 'cast', 'Cast Saturday: Ivy is shy but steady', 'cast', 'winter', 'landscape', HT_X, H,
    {'x': 'Meet Ivy, rung two on the bot ladder.\n\nShy, steady and wrapped in a very long scarf. Do not underestimate her.',
     'threads': 'Meet Ivy, rung two on the bot ladder.\n\nShy but steady, and wrapped in a very long scarf and earmuffs. Do not underestimate her. Beat Ivy, then climb.'},
    'IVY IS SHY BUT STEADY', 'CAST SATURDAY', ['i'], 'I alone in the striped scarf, earmuffs and white mittens, soft snow, warm string lights', asset='cast art', beat='CAST SATURDAY')
add('2026-12-19', '18:00', 'video', 'video', '[Needs capture] Cast Saturday video: the gift swap', 'cast', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'Gift swap, cast edition.\n\nSomeone gets a streak shield. Someone gets a rematch. Nobody gets the last word.\n\nPlay free: link in bio.',
     'instagram': 'Gift swap, cast edition.\n\nSomeone gets a streak shield. Someone gets a rematch. Nobody gets the last word.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='CAST SATURDAY')

add('2026-12-20', '08:00', 'x', 'ritual', 'Sweep Sunday', 'sweep', 'winter', 'landscape', HT_X, H,
    {'x': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post yours.',
     'threads': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Post your sweep board and see who in the family cracks first.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['u', 'd', 'o2'], 'three mascots with colored game tiles tumbling like snowflakes, midnight-indigo glow', asset='sweep share card', beat='SWEEP SUNDAY')
add('2026-12-20', '11:30', 'fb', 'ritual', 'Sweep Sunday (Facebook)', 'sweep', 'winter', 'portrait', HT_F, H,
    {'facebook': 'SWEEP SUNDAY.\n\nCan you sweep all 18 dailies today? It is the last Sunday before Christmas, so the family is probably already under one roof. Share your sweep board in the comments.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['s', 'c', 'i'], 'three mascots on a cozy rug with a stack of glossy tiles and a mug of cocoa', asset='sweep share card', beat='SWEEP SUNDAY')

# ============================================================ WEEK 4 (Dec 21 - 27)
add('2026-12-21', '08:00', 'x', 'ritual', 'Monday Masters: the longest night', 'monday', 'winter', 'landscape', ht(HT_X, 'winter'), H,
    {'x': 'MONDAY MASTERS.\n\nThe longest night of the year is a fine night for a long streak. New week, zero points, crown open. Come take it.',
     'threads': 'MONDAY MASTERS.\n\nThe longest night of the year is a fine night for a long streak. The weekly race just reset and everyone starts level. Last week\'s champion is on the Leaderboard tab. Come take the crown.'},
    'MONDAY MASTERS', 'THE CROWN IS OPEN.', ['w', 'o1', 'r'], 'deep midnight-blue sky full of stars and a low glowing horizon, snow, three mascots in a relaxed row',
    note='Winter solstice nod only. Not a holiday greeting: the greeting rule covers real holidays, and the solstice is an astronomical observance with no themed puzzle day.', asset='mon-masters title art', beat='MONDAY MASTERS (solstice nod)')
add('2026-12-22', '08:00', 'x', 'post', 'Last-minute gift: a streak shield', 'gift', 'winter', 'landscape', HT_X, H,
    {'x': 'Still need a gift for the cousin who always forgets?\n\nGift a streak shield, then beat them anyway. Invites are one link.',
     'threads': 'Still need a gift for the cousin who always forgets their streak?\n\nGift a streak shield, then beat them anyway. Add your family as friends and race the same daily puzzles. Invites are one link.'},
    'GIFT A SHIELD', 'THEN BEAT THEM ANYWAY.', ['d', 'c', 's'], 'a gift box with a glowing shield emblem on the ribbon, three mascots around it, ribbons and snow', asset='storeShot capture', beat='Gift a shield (job: share/invite)')
add('2026-12-22', '11:30', 'feed', 'post', 'Gift a streak shield', 'gift', 'winter', 'portrait', HT_F, H,
    {'instagram': 'Still shopping for the cousin who always forgets?\n\nGift a streak shield, then beat them anyway. Add your family as friends, race the same daily puzzles and let the scoreboard settle it. Invites are one link.\n\nPlay free: link in bio.',
     'facebook': 'Still shopping for the cousin who always forgets their streak? Gift a streak shield, then beat them anyway. Add your family as friends, race the same daily puzzles and let the scoreboard settle it.',
     'threads': 'Gift a streak shield to the cousin who always forgets, then beat them anyway. Invites are one link.'},
    'GIFT A SHIELD', 'THEN BEAT THEM ANYWAY.', ['o3', 'w'], 'two mascots holding a big wrapped gift together, glowing shield emblem on the ribbon', asset='storeShot capture', beat='Gift a shield')
add('2026-12-22', '18:00', 'video', 'video', '[Needs capture] How to gift a streak shield', 'gift', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'How to gift a streak shield in 10 seconds.\n\nAdd a friend, open their card, send it. Done.\n\nPlay free: link in bio.',
     'instagram': 'How to gift a streak shield in 10 seconds.\n\nAdd a friend, open their card, send it. Done.\n\nPlay free: link in bio.'},
    note='Verify the actual gifting flow in the live app before capture; fix the steps in the caption if they differ.', paused=True, asset='storeShot capture', beat='Gift a shield')

add('2026-12-23', '08:00', 'x', 'muddle', 'Muddle Wednesday', 'muddle', 'winter', 'landscape', HT_X, H,
    {'x': 'MUDDLE WEDNESDAY.\n\nYesterday\'s Muddle: four words, one punchline, one cartoon. Caption it between the wrapping and the baking.',
     'threads': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon is up. Four scrambled words, one punchline. Caption it in the replies, then go solve today\'s Muddle.'},
    'MUDDLE WEDNESDAY', 'FOUR WORDS. ONE PUNCHLINE.', ['r', 'o2'], 'two mascots far left and far right, low, with a calm empty center, ribbon and snow',
    layout='only TWO mascots, far left and far right, low; the center 30 percent of the width empty for a cartoon added in code',
    content='cartoon|<yesterday Muddle cartoon file>|520', hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')
add('2026-12-23', '11:30', 'feed', 'muddle', 'Muddle Wednesday: caption this', 'muddle', 'winter', 'portrait', HT_F, H,
    {'instagram': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll.\n\nToday\'s Muddle is live. Play free: link in bio.',
     'facebook': 'MUDDLE WEDNESDAY.\n\nYesterday\'s cartoon, four scrambled words and one punchline. Caption it in the comments before you scroll. Today\'s Muddle is live.',
     'threads': 'MUDDLE WEDNESDAY. Yesterday\'s cartoon is up. Caption it before you scroll.'},
    'MUDDLE WEDNESDAY', 'CAPTION THIS.', ['i', 'o1'], 'two mascots low under a calm empty rectangle for the cartoon, string lights on a frosted wall',
    layout='calm empty rectangle ~70% x 28% between the sub line and the mascots\' heads; mascots low', content='cartoon|<yesterday Muddle cartoon file>|700',
    hint='hint: none (yesterday\'s cartoon)', asset='Muddle cartoon bank', beat='MUDDLE WEDNESDAY')

add('2026-12-24', '08:00', 'x', 'wotd', 'WOTD quiz HASTE + Hubbub pangram tease', 'wotd', 'winter', 'landscape', ht(HT_X, 'christmas'), H,
    {'x': wotd_caption('2026-12-24', 'x'), 'threads': wotd_caption('2026-12-24', 'threads')},
    'WORD OF THE DAY QUIZ', None, ['w', 'r'], 'two mascots low at the sides, stockings and string lights, soft snow, calm empty band for the word card',
    layout='completely empty calm band (about 20 percent of the height) under the headline for the word card added in code',
    content='wotd|HASTE|WORD OF THE DAY|1.2', hint='hint: Word of the Day on the card only', note='Christmas Eve themed puzzles are live in the app (data/holiday-days.json); an optional extra sentence is fine, but the quiz stays the lead.',
    asset='WOTD card / Hubbub', beat='WOTD + Hubbub pangram tease (Christmas Eve)')
for n, (hd, sb, cast, kind_, link_, cap, setting_) in enumerate([
    ('HOW TO PLAY CROSSWORDOCIOUS', 'A NEW PUZZLE EVERY DAY.', ['d', 'o3'], 'explainer', 'https://wordocious.com/guides/crosswordocious',
     'How to play Crosswordocious, the daily sayings crossword on Wordocious: every clue is a familiar saying with one word missing, most answers fit the day\'s title, and letters are free to change. A free daily puzzle for word lovers.', 'cozy winter library with frosted crossword-shaped windows (decor only, no letters in the cells)'),
    ('SKIES', 'WORD OF THE DAY', ['o1', 'c'], 'word', 'https://wordocious.com/word/2026-10-23',
     'Word of the Day: SKIES (noun). Plural of sky: the heavens, the firmament, the atmosphere. A new word every morning on Wordocious, with the archive of every past word.', 'night sky, stars and gentle snowfall'),
    ('HAPPY HOLIDAYS', 'FROM THE WHOLE CAST.', ['w', 'd', 'u', 'o1', 'r'], 'cast', H,
     'Happy holidays from the Wordocious cast. Christmas, Hanukkah and Kwanzaa costumes, ten letter characters, and one free daily puzzle app that hosts them all. Bring your family.', 'five cast members together under string lights, a mix of costumes, snow')]):
    add('2026-12-24', ['13:00', '15:00', '17:00'][n], 'pin', 'pin', f'Pin: {["How to play Crosswordocious", "Word card, SKIES", "Cast art, happy holidays"][n]}', 'pin-' + kind_, 'winter', 'pin', HT_F, link_,
        {'pinterest': cap}, hd, sb, cast, setting_, hint='hint: none' + (' (SKIES was the Oct 23 Word of the Day)' if kind_ == 'word' else ''), asset='evergreen', beat='pins day')
add('2026-12-24', '18:00', 'video', 'video', '[Needs capture] Christmas Eve cast gag: one more round', 'cast', 'winter', 'portrait', ht(HT_F, 'christmas'), H,
    {'tiktok': 'Christmas Eve, 11 PM. Nobody is asleep.\n\nOne more round.\n\nPlay free: link in bio.',
     'instagram': 'Christmas Eve, 11 PM. Nobody is asleep.\n\nOne more round.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='Christmas Eve gag')

add('2026-12-25', '07:00', 'holiday', 'season', 'Merry Christmas (morning greeting)', 'holiday-christmas', 'winter', 'portrait', ['christmas', 'wordocious'], H,
    {'x': 'Merry Christmas from the whole cast.\n\nWishing you a warm table, a full house and one more round after dessert.',
     'threads': 'Merry Christmas from the whole cast.\n\nWishing you a warm table, a full house, great company and one more round after dessert. Today\'s themed puzzles are live whenever you are ready.',
     'instagram': 'Merry Christmas from the whole cast.\n\nWishing you a warm table, a full house and one more round after dessert. Today\'s themed puzzles are live.\n\nPlay free: link in bio.',
     'facebook': 'Merry Christmas from the whole Wordocious cast. Wishing you and your family a warm table and one more round after dessert. Today\'s themed puzzles are live in the daily games.'},
    'MERRY CHRISTMAS', 'FROM THE WHOLE CAST.', ['w', 'o1', 'o3', 'r', 'i'], 'a warm living-room scene: a decorated tree with glowing ornaments, wrapped gifts, stockings, string lights, snow in the window, the cast together',
    holiday='christmas', note='7 AM CT. Themed puzzles are live Dec 24-26 per data/holiday-days.json. Cast: Santa W, reindeer Ollie, ugly sweater Ozzy, R cocoa, Ivy scarf; no one else.', paused=True, beat='CHRISTMAS (Dec 25)', asset='holiday greeting art (own image)')
add('2026-12-25', '08:00', 'x', 'ritual', 'Friday\'s Finest: Christmas edition', 'friday', 'winter', 'landscape', ht(HT_X, 'christmas'), H,
    {'x': 'FRIDAY\'S FINEST.\n\nThe best board of the week, now with wrapping paper. Open the presents, then open your daily. Post yours.',
     'threads': 'FRIDAY\'S FINEST.\n\nThe best board of the week, now with wrapping paper everywhere. Open the presents, then open your daily, and share your board in the replies.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['c', 's'], 'two mascots with a gold ribbon rosette, a few wrapped gifts and a glowing window', asset='share cards', beat='FRIDAY\'S FINEST (Christmas)')
add('2026-12-25', '11:30', 'feed', 'ritual', 'Friday\'s Finest', 'friday', 'winter', 'portrait', ht(HT_F, 'christmas'), H,
    {'instagram': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.\n\nPlay today\'s puzzles free: link in bio.',
     'facebook': 'FRIDAY\'S FINEST.\n\nThe best board of the week, and one very smug player behind it. Think yours beats it? Share your board in the comments.',
     'threads': 'FRIDAY\'S FINEST. The best board of the week. Think yours beats it? Make your case.'},
    'FRIDAY\'S FINEST', 'BEST BOARD OF THE WEEK.', ['u', 'd'], 'two mascots with a small gold trophy among gift boxes, warm light', asset='share cards', beat='FRIDAY\'S FINEST')
add('2026-12-25', '18:00', 'video', 'video', '[Needs capture] Christmas cast clip', 'cast', 'winter', 'portrait', ht(HT_F, 'christmas'), H,
    {'tiktok': 'Merry Christmas from the cast.\n\nGifts are open. The board is not.\n\nPlay free: link in bio.',
     'instagram': 'Merry Christmas from the cast.\n\nGifts are open. The board is not.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='Christmas clip')

add('2026-12-26', '07:00', 'holiday', 'season', 'Happy Kwanzaa (morning greeting)', 'holiday-kwanzaa', 'winter', 'portrait', ['kwanzaa', 'wordocious'], H,
    {'x': 'Happy Kwanzaa from all of us at Wordocious.\n\nToday is Umoja: unity. Wishing you family, community and a little friendly competition.',
     'threads': 'Happy Kwanzaa from all of us at Wordocious.\n\nThe first day is Umoja, unity. Wishing you family, community and a little friendly competition around the table.',
     'instagram': 'Happy Kwanzaa from all of us at Wordocious.\n\nThe first day is Umoja, unity. Wishing you family, community and a little friendly competition around the table.\n\nPlay free: link in bio.',
     'facebook': 'Happy Kwanzaa from all of us at Wordocious. The first day is Umoja, unity. Wishing you and your family a week of community, reflection and a little friendly competition.'},
    'HAPPY KWANZAA', 'UMOJA. UNITY.', ['u', 's'], 'a warm table scene in red, black and green: a kinara with SEVEN candle positions (three red left, one black center, three green right) with only the black center candle lit for day one, a woven mkeka mat, ears of corn (muhindi), the unity cup (kikombe), kente-inspired trim, soft snow',
    holiday='kwanzaa', note='7 AM CT, Dec 26 = the first day (Umoja). The app\'s Kwanzaa themed-puzzle day is Dec 27, so do NOT say "today\'s themed puzzles" (see lead notes). Respect: objects, light, color only; no religious garments; cast wearing the kente wrap (U) and sash (S).',
    paused=True, beat='KWANZAA begins (Dec 26)', asset='holiday greeting art (own image)')
add('2026-12-26', '08:00', 'x', 'cast', 'Cast Saturday: Rip takes it easy', 'cast', 'winter', 'landscape', HT_X, H,
    {'x': 'Meet Rip, rung one on the bot ladder.\n\nEasygoing, cozy and wrapped in a quilt. The perfect place to start. Beat Rip, then climb.',
     'threads': 'Meet Rip, rung one on the bot ladder.\n\nEasygoing, cozy and wrapped in a quilt with a mug of cocoa. The perfect place to start. Beat Rip, then climb all ten rungs.'},
    'RIP TAKES IT EASY', 'CAST SATURDAY', ['r'], 'R alone in the patchwork quilt wrap, striped nightcap with holly and a cocoa mug, soft snow, warm window glow', asset='cast art', beat='CAST SATURDAY')
add('2026-12-26', '18:00', 'video', 'video', '[Needs capture] Cast Saturday video: Rip', 'cast', 'winter', 'portrait', HT_F, H,
    {'tiktok': 'Meet Rip, rung one on the bot ladder.\n\nEasygoing and cozy. Beat Rip, then climb.\n\nPlay free: link in bio.',
     'instagram': 'Meet Rip, rung one on the bot ladder.\n\nEasygoing and cozy. Beat Rip, then climb.\n\nPlay free: link in bio.'},
    paused=True, asset='cast art', beat='CAST SATURDAY')

add('2026-12-27', '08:00', 'x', 'ritual', 'Sweep Sunday + Kwanzaa themed puzzles', 'sweep', 'winter', 'landscape', ht(HT_X, 'kwanzaa'), H,
    {'x': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Kwanzaa themed puzzles are live too. Post yours.',
     'threads': 'SWEEP SUNDAY.\n\nCan you sweep all 18? One day, every daily, one board to prove it. Kwanzaa themed puzzles are live today. Post your sweep board and see who in the family cracks first.'},
    'SWEEP SUNDAY', 'ALL 18 DAILIES. ONE DAY.', ['s', 'u', 'i'], 'three mascots with colored game tiles drifting like snow, red-black-green accents in the trim, midnight-indigo glow',
    note='Kwanzaa themed puzzles per data/holiday-days.json: Dec 27. Verify in the live app.', asset='sweep share card', beat='SWEEP SUNDAY')
add('2026-12-27', '11:30', 'feed', 'season', 'Your year in Wordocious: coming soon (founder call)', 'wrapped', 'newyear', 'portrait', ht(HT_F, 'newyear'), H,
    {'instagram': 'Your year in Wordocious is almost here.\n\nThe streaks you saved, the games you could not stop playing, the boards you bragged about. We are counting them up.\n\nCheck back before New Year\'s Eve. Play free: link in bio.',
     'facebook': 'Your year in Wordocious is almost here: the streaks you saved, the games you could not stop playing, the boards you bragged about. Check back before New Year\'s Eve.',
     'threads': 'Your year in Wordocious is almost here. Streaks, favorite games, best days. Check back before New Year\'s Eve.'},
    'YOUR YEAR IN WORDS', 'COMING SOON.', ['w', 'o2', 'c', 'u'], 'a midnight-blue sky with gold confetti and a softly glowing countdown clock face that shows no readable time, the four together, snow melting into sparkle',
    hint='hint: none (teaser only, no stats)',
    note='FOUNDER CALL: only approve if a year-in-review feature really ships (or this stays a pure teaser with no feature claim). No real user data anywhere. New Year season art (Dec 27-Jan 2) is not built yet, so the scene uses the winter cast with gold confetti. Paused until decided.',
    paused=True, beat='New Year teaser + Wrapped tease', asset='cast art')
add('2026-12-27', '18:00', 'video', 'video', '[Needs capture] New Year teaser', 'wrapped', 'newyear', 'portrait', ht(HT_F, 'newyear'), H,
    {'tiktok': 'Four more days.\n\nThe cast is counting down. Your year in Wordocious is coming.\n\nPlay free: link in bio.',
     'instagram': 'Four more days.\n\nThe cast is counting down. Your year in Wordocious is coming.\n\nPlay free: link in bio.'},
    note='Same founder call as the Wrapped feed post. Paused.', paused=True, asset='cast art', beat='New Year teaser')
