PROMO = "Eight daily word games plus ten More Games, from Muddle's cartoon puns to Sudocious and Crosswordocious. New puzzles every day, free to play."
KEYWORDS = "puzzle,crossword,word search,logic,brain,vocabulary,spelling,cryptogram,anagram,trivia,letters"
PLAY_SHORT = "Eight daily word games and ten More Games. New puzzles every day, free."
CORE = """Wordocious is your daily puzzle habit: eight word games on the home screen and ten More Games behind one tile, all new every day and free to play.

DAILY WORD GAMES
• Classic — one five-letter word, six tries
• QuadWord — four boards, one shared set of guesses
• OctoWord — eight boards, thirteen guesses
• Succession — four words, solved one by one
• Deliverance — four boards already in trouble; finish the rescue
• Six and Seven — longer words, with hints when you need them
• Gauntlet — five escalating stages in a single run
Finish all eight for the Daily Sweep; win all eight for a Flawless Victory.

MORE GAMES
One free daily in each:
• Muddle — unscramble four words, then spell the cartoon's punchline
• Letter Ladder — change one letter at a time, start word to end word
• Spyglass — find the hidden theme words in a letter grid
• Hubbub — seven letters, one hub; make words and climb the ranks
• Crosswordocious — a themed crossword of familiar sayings
• ProperNoundle — guess the famous name, place or title
• Sudocious — the classic number grid, one puzzle a day
• Kindred — sixteen words, four hidden groups
• Codebreaker — crack the coded saying
• Starsweep — one star in every row, column and region
Play all ten for a More Games Sweep.

EVERY SOLVE IS SCORED
• Guesses, speed and a clean finish all count
• Daily leaderboards for every game, plus all-time records
• A new word with every win: the definition lands on your victory card

FRIENDS
• Today's Race and a weekly finish with your friends
• Challenge a friend to VS on the same puzzle
• An activity feed and streak-shield gifting

STATS AND STREAKS
• Your day at a glance and every game's records in one place
• Daily streaks, medals and a trophy shelf
• Level up with XP

WORDOCIOUS PRO
Daily puzzles are always free. Pro adds unlimited replays of every game, VS in every mode, practice bots, streak shields, a Pro badge, extended stats and an ad-free experience. Monthly, yearly, or a one-time 24-hour Day Pass."""
IOS_LEGAL = """

WORDOCIOUS PRO — OPTIONAL SUBSCRIPTION
• Wordocious Pro Monthly — $6.99 per month
• Wordocious Pro Yearly — $59.99 per year
A one-time Day Pass is also available.

Payment is charged to your Apple Account at confirmation of purchase. Subscriptions renew automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours prior to the end of the current period. You can manage or cancel your subscription in your Apple Account settings after purchase.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://wordocious.com/privacy"""
PLAY_LEGAL = """
• Wordocious Pro Monthly and Yearly renew automatically unless canceled in your Google Play subscription settings.
• The Day Pass is a one-time 24-hour purchase and does not renew.

Privacy Policy: https://wordocious.com/privacy
Terms: https://wordocious.com/terms"""
IOS_DESC = CORE + IOS_LEGAL
PLAY_DESC = CORE + "\n" + PLAY_LEGAL
if __name__ == "__main__":
    for n, v, lim in [("PROMO", PROMO, 170), ("KEYWORDS", KEYWORDS, 100), ("PLAY_SHORT", PLAY_SHORT, 80), ("IOS_DESC", IOS_DESC, 4000), ("PLAY_DESC", PLAY_DESC, 4000)]:
        print(n, len(v), "/", lim, "OK" if len(v) <= lim else "OVER")
