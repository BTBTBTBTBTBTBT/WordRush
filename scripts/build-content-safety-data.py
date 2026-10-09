#!/usr/bin/env python3
"""Builds packages/core/src/content-safety/data/*.json — the word lists every content guard and generator
reads (docs/CONTENT-SAFETY.md). Re-run after editing the curated lists below or the sources it reads.

Sources:
  - frequency.json : wordfreq 3.1.1 (https://github.com/rspeer/wordfreq; code Apache-2.0, word-frequency
                     DATA CC BY-SA 4.0 — attribution in docs/CONTENT-SAFETY.md). English Zipf frequency ×10,
                     bucketed, for every alphabetic word of 3–15 letters with Zipf ≥ 2.0 among the top 150k
                     words and the guess lists (absent = rarer than Zipf 2.0).
  - offensive.json : scripts/data/profanity-exact.generated.txt + offensive-blocklist.txt (exact words),
                     the answer-pool HARD_ROOTS (substrings), explicit terms found by the 2026-10-06 audit,
                     and phrase patterns for clue/caption text.
  - british.json   : spelling-copy.test.ts WORDS (spellings), content-american.test.ts BRIT_WORDS +
                     apps/web/scripts/data/brit-words-extended.txt (vocabulary), BRIT_PHRASES (patterns).
  - obscure.json   : content-american.test.ts OBSCURE_WORDS + apps/web/scripts/data/obscure-words.txt.
  - must-accept.json: the curated everyday-vocabulary list below (+ inflections that wordfreq rates
                     common, Zipf ≥ 3.0) — words every game's accept list must contain where length fits.
  pip install wordfreq==3.1.1 && python3 scripts/build-content-safety-data.py
"""
import base64, json, os, re
# Content-safety policy: no offensive word is ever written in plain text in this repo's own code, tests or
# reports. Offensive literals here are base64 and the offensive data file is written base64-encoded.
def b64(xs): return [base64.b64decode(x).decode() for x in xs]
def enc(xs): return [base64.b64encode(x.encode()).decode() for x in xs]
from wordfreq import zipf_frequency, top_n_list
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'packages', 'core', 'src', 'content-safety', 'data')
WEB = os.path.join(ROOT, 'apps', 'web')
def lines(p): return [l.strip() for l in open(p) if l.strip() and not l.startswith('#')]
def first_col(p): return [l.split()[0].upper() for l in lines(p)]
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w') as f: json.dump(obj, f, indent=1 if name != 'frequency.json' else None, sort_keys=True); f.write('\n')

# ---------------------------------------------------------------- british
spell_src = open(os.path.join(WEB, 'scripts', 'spelling-copy.test.ts')).read()
a = spell_src.index('const WORDS'); spellings = sorted({w.upper() for w in re.findall(r"'([a-z-]+)'", spell_src[a:spell_src.index('];', a)])})
guard = open(os.path.join(WEB, 'scripts', 'content-american.test.ts')).read()
def tpl(name):
    m = re.search(name + r" = new Set\(`(.*?)`", guard, re.S); return m.group(1).split()
brit_words = sorted(set(tpl('BRIT_WORDS')) | set(first_col(os.path.join(WEB, 'scripts', 'data', 'brit-words-extended.txt'))))
phrases = re.findall(r"/\\b(.*?)\\b/i", guard[guard.index('const BRIT_PHRASES'):guard.index('];', guard.index('const BRIT_PHRASES'))])
phrases += ["pull your socks up", "mind the gap", "bob'?s your uncle", "pigs might fly", "storm in a teacup", "ten a penny",
            "chalk and cheese", "stable door", "englishman'?s home", "lollipop man", "lost property", "high street", "go hell for leather",
            "spot of bother", "cup of tea, (?:old|dear)", "a sticky wicket", "beat about the bush", "fine words butter no parsnips",
            "ne'?er cast a clout", "too big for (?:your|his|her) boots", "skeleton in the cupboard", "removal men", "sorting office",
            "model railway", "toy railway", "football pitch", "dressing gown", "dinner jacket", "back garden", "rowing boat"]

# ---------------------------------------------------------------- obscure
obscure = sorted(set(tpl('OBSCURE_WORDS')) | set(first_col(os.path.join(WEB, 'scripts', 'data', 'obscure-words.txt'))))
dump('obscure.json', {'words': obscure, 'zipfThreshold': 2.5,
  'note': 'isObscure(): on this curated list, or wordfreq Zipf below zipfThreshold (a WARNING in content:check, not a failure — rare but fair words exist).'})

# ---------------------------------------------------------------- offensive
exact = set(lines(os.path.join(ROOT, 'scripts', 'data', 'profanity-exact.generated.txt'))) | set(lines(os.path.join(ROOT, 'scripts', 'data', 'offensive-blocklist.txt')))
exact = {w.upper() for w in exact}
explicit = b64(['Qk9ORVI=', 'SE9STlk=', 'U0VNRU4=', 'U1BFUk0=', 'TlVERVM=', 'VklCUkFUT1I=', 'Qk9OREFHRQ==', 'RE9ORw==', 'TFVCRQ==', 'UElNUA==', 'SE9NTw==', 'UkVUQVJERUQ=', 'R0FZRVI=', 'UEVSVkVSVA==', 'UEVSVkVSVEVE', 'UkFQSU5H', 'UkFQRUQ=', 'SE9PS1VQ', 'Rk9ORExF', 'UEFOVElFUw==', 'R1JPUElORw==', 'RkxBU0hFUg==', 'VE9QTEVTUw==', 'UExBWUJPWQ==', 'UkVETkVDSw==', 'SElDS0VZ', 'VklBR1JB', 'UFJJQ0s=', 'U1BBTks=', 'QlVUQ0g=', 'RlVDS0VE', 'RlVDS0VS', 'RlVDS0lORw==', 'U0hJVFRZ', 'QkxPV0pPQg==', 'SEFOREpPQg==', 'T1JHQVNN', 'Q09ORE9N', 'RElMRE8=', 'SEVSUEVT', 'SEVST0lO', 'Q09DQUlORQ==', 'QlJPVEhFTA==', 'R0VOSVRBTA==', 'VkFHSU5BTA==', 'RkVUSVNI', 'Q1JBUA==', 'VFVSRA==', 'Qk9ORw==', 'TlVESVRZ', 'SE9PS0VS', 'U1RPTkVS', 'SlVOS0lF', 'Q1JPVENI', 'TFlOQ0g=', 'TkFaSVM=', 'TlVESVNU', 'U0NST1RVTQ==', 'VkFHSU5B', 'RVJFQ1RJT04=', 'TUFTVFVSQkFURQ=='] + ['UVVFRVI=', 'S0lOS1k=', 'VFdFUks=', 'QlVUVFM=', 'RkFUVFk=', 'T1BJVU0='])
roots = b64(['RlVDSw==', 'U0hJVA==', 'Q1VOVA==', 'QkxPV0pPQg==', 'SEFOREpPQg==', 'V0FOSw==', 'VFdBVA==', 'TklHRw==', 'RkFHRw==', 'U0xVVA==', 'V0hPUkU=', 'UFVTU1k=', 'SklaWg==', 'RElMRE8=', 'UkFQSVNU'])
# Ordinary words that are on an exact list for another purpose (usernames) but fine in a puzzle — never flagged.
allow = b64(['QkFMTFM=', 'Q09DSw==', 'VElU', 'VElUUw==', 'REFNTg==', 'QU5BTA==', 'U0VY', 'U0xBTlQ=', 'Q1JJUFBMRQ==', 'R1lQU1k=', 'TUlER0VU', 'TUlER0VUUw==', 'S1JBVVQ=', 'UE9OQ0U=', 'TklHRVI=', 'REFHTw=='])
offensive_phrases = b64(['Y2hpbmsgaW4gdGhl', 'Y29jayBhbmQgYnVsbA==', 'aGVsbCBmb3IgbGVhdGhlcg==', 'XGJibGFjayA/ZmFjZVxi', 'XGJneXAoPzpwZWQpP1xi', 'XGJzcGF6XGI=', 'XGJ0cmFpbGVyIHRyYXNoXGI='])
# Innocent words that happen to contain a hard root as a substring (a hat brand, a watch, a mushroom…).
root_exempt = ['SWANK', 'SWANKS', 'SWANKY', 'SWANKIER', 'SWANKIEST', 'TWANK', 'WRISTWATCH', 'WRISTWATCHES', 'SHIITAKE', 'SHIITAKES', 'SHITAKE',
  'SCUNTHORPE', 'COCKTAIL']
OFF_EXACT = (exact | set(explicit)) - set(allow)
def is_off(w):
    w = w.upper()
    return w in OFF_EXACT or (w not in root_exempt and any(r in w for r in roots))
# Written base64-encoded (decoded at runtime by safety.mjs) — the list itself never sits in plain text.
dump('offensive.json', {'encoding': 'base64', 'exact': sorted(enc(OFF_EXACT)), 'roots': enc(roots), 'rootExempt': sorted(root_exempt),
  'phrases': enc(offensive_phrases), 'contextual': sorted(enc(allow)),
  'note': 'base64 strings. contextual: on a username blocklist but ordinary in a puzzle; allowed as words, still caught by the phrase patterns.'})
# British vocabulary minus anything offensive (that lives, encoded, in offensive.json only).
dump('british.json', {'spellings': spellings, 'words': [w for w in brit_words if not is_off(w)], 'phrases': sorted(set(phrases))})

# ---------------------------------------------------------------- must-accept (05b)
BASE = """
family: aunt aunts aunty aunties auntie aunties uncle uncles niece nieces nephew nephews cousin cousins granny grannies grandma grandmas
  grandpa grandpas grandson granddaughter grandchild grandchildren grandparent grandparents mother mothers father fathers mom moms
  mommy dad dads daddy sister sisters brother brothers sibling siblings son sons daughter daughters baby babies child children
  parent parents family families wife wives husband husbands bride groom twin twins kid kids nana papa
body: head heads face faces hair hand hands arm arms leg legs foot feet toe toes finger fingers thumb nose ear ears eye eyes
  mouth lip lips tooth teeth tongue neck back chest belly knee knees elbow wrist ankle heel shoulder skin bone bones heart
  brain blood cheek chin brow throat palm nail nails
food: apple apples banana bananas bread butter cheese egg eggs milk juice cake cakes cookie cookies candy pizza pasta salad
  soup rice bean beans corn carrot carrots potato potatoes tomato tomatoes onion onions lemon lemons orange oranges grape grapes
  peach pear pears plum berry berries cherry cherries melon honey jam sugar salt pepper meat beef pork ham bacon chicken turkey
  fish taco tacos burger burgers fries toast cereal muffin pie pies donut donuts bagel waffle pancake sandwich snack snacks
  lunch dinner breakfast dessert gravy sauce syrup pickle pickles nuts peanut popcorn chips
animals: cat cats dog dogs puppy puppies kitten kittens horse horses cow cows pig pigs sheep goat goats duck ducks chicken hen
  bird birds fish frog frogs mouse mice rat rats bear bears lion lions tiger tigers wolf wolves fox foxes deer rabbit rabbits
  bunny snake snakes turtle owl owls eagle whale whales shark sharks bee bees ant ants spider spiders monkey zebra giraffe
  camel moose skunk squirrel otter seal pony lamb calf goose geese turkey crab worm
home: house home room rooms door doors window windows wall walls floor roof bed beds chair chairs table tables couch sofa lamp
  rug sink oven stove fridge shelf desk closet attic garage yard porch kitchen bathroom bedroom towel pillow blanket cup cups
  plate plates bowl bowls fork forks spoon spoons knife knives pot pan mug clock phone key keys box boxes bag bags
clothing: shirt shirts pants dress dresses skirt coat coats jacket hat hats cap caps sock socks shoe shoes boot boots belt glove
  gloves scarf sweater hoodie jeans shorts tie vest robe apron pajamas sneakers sandals mitten mittens
school: school class teacher student students book books pen pens pencil paper desk lesson test quiz math science art music
  recess lunch bus ruler crayon crayons glue tape chalk notebook homework grade grades reading writing spelling
sports: ball bat game games team teams goal goals score race run ran swim skate ski golf tennis soccer hockey baseball
  football basketball coach player players win won lose lost play played playing jump jumped catch throw kick
weather: rain rainy snow snowy wind windy storm storms cloud clouds cloudy sun sunny fog foggy hail heat cold hot warm cool
  ice icy frost thunder lightning breeze weather
colors: red blue green yellow orange purple pink brown black white gray gold silver tan
numbers: one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand first second third
verbs: run runs running walk walks walked walking talk talks talked talking eat eats ate eating drink drinks sleep sleeps slept
  read reads write writes wrote sing sings sang dance dances danced laugh laughs laughed cry cried smile smiled hug hugs hugged
  help helps helped play plays make makes made bake baked cook cooked clean cleaned wash washed open opened close closed
  give gave take took bring brought come came go went see saw look looked find found keep kept want wanted like liked love loved
  hope hoped wish wished think thought know knew sit sat stand stood wait waited fly flew swim swam drive drove ride rode
adjectives: big small tall short long happy sad mad glad kind nice good bad new old young fast slow hard soft loud quiet
  clean dirty wet dry full empty funny silly pretty ugly brave scary cute sweet sour salty spicy fresh tired busy rich poor
  bright dark light heavy easy early late cozy fancy lucky safe sick well
"""
words = set()
for line in BASE.strip().split('\n'):
    body = line.split(':', 1)[1] if ':' in line else line
    words.update(w.upper() for w in body.split())
# Common inflections the wordfreq data rates common (no bogus forms).
def infl(w):
    # Regular forms only (-es after s/x/z/ch/sh/o) — JAM+ES or HARD+ING would invent surnames (JAMES, HARDING).
    w = w.lower(); out = {w + 's', w + 'ed', w + 'ing'}
    if w.endswith(('s', 'x', 'z', 'ch', 'sh', 'o')): out.add(w + 'es')
    if w.endswith('y') and len(w) > 2 and w[-2] not in 'aeiou': out |= {w[:-1] + 'ies', w[:-1] + 'ied'}
    if w.endswith('e'): out |= {w + 'd', w + 's', w[:-1] + 'ing'}
    return out
NOT_FORMS = {'BALLS', 'HARDING', 'JAMES', 'BATES', 'WELLS', 'BOWLES', 'COATES', 'MATHER', 'WELLER', 'PARKS', 'MILLS', 'BANKS', 'WARDS'}
extra = {f.upper() for w in list(words) for f in infl(w) if zipf_frequency(f, 'en') >= 3.0 and f.isalpha()} - NOT_FORMS
# Never British-only (MATH+S would add MATHS): the accept lists welcome them, but must-accept is the American core.
must = sorted(w for w in words | extra if w.isalpha() and 3 <= len(w) <= 15 and not is_off(w) and w not in set(brit_words) | set(spellings))
dump('must-accept.json', {'words': must, 'note': 'Everyday American vocabulary (family, body, food, animals, home, clothing, school, sports, weather, colors, numbers, common verbs/adjectives) + inflections wordfreq rates common. Every accept list must contain the ones that fit its game (length, letters).'})

# ---------------------------------------------------------------- frequency
cand = {w for w in top_n_list('en', 150000) if w.isalpha() and w.isascii() and 3 <= len(w) <= 15}
D = os.path.join(WEB, 'data')
for f in os.listdir(D):
    if f.startswith(('allowed', 'solutions', 'ladder-words')) and f.endswith('.json'):
        cand |= {w.lower() for w in json.load(open(os.path.join(D, f)))}
cand |= {w.lower() for w in must}
# Only Zipf ≥ 2.0 is stored (anything absent is rarer than that, i.e. obscure by any threshold we use),
# bucketed as { "zipf×10": "WORD WORD …" } to keep the file small.
buckets = {}
for w in cand:
    z = round(zipf_frequency(w, 'en') * 10)
    if (z >= 20 or w.upper() in must) and not is_off(w): buckets.setdefault(str(z), []).append(w.upper())
freq = {k: ' '.join(sorted(v)) for k, v in buckets.items()}
dump('frequency.json', freq)
print(len(spellings), len(brit_words), len(obscure), len(must), sum(len(v) for v in buckets.values()))
