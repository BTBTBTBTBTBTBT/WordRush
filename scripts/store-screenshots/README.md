# App Store screenshots

Founder-taken iPhone screenshots (1290×2796, iPhone 15 Pro Max) become captioned store frames for the two required slots:
6.7-inch (`APP_IPHONE_67`, 1320×2868) and 6.5-inch (`APP_IPHONE_65`, 1284×2778).

1. Drop the phone PNGs in a `store-src/` folder next to `store-compose.py`; edit the `SHOTS` table (file, name, headline, subline) — the order is the store order.
2. `python3 store-compose.py` → `store-out/67/*.png` and `store-out/65/*.png` (Nunito Black headline in the brand purple→pink, muted subline, phone shot with rounded corners on the app's lavender ground).
3. `VER=2.3 ruby asc-shots-list.rb` shows the version's sets; `VER=2.3 ruby asc-shots-upload.rb` deletes the old shots and uploads + orders the new ones (ASC API key C8FRS9T697, .p8 read from disk).
   A version that already sits in a review submission refuses screenshot edits ("Ready For Review"): `ruby asc-unpark.rb` empties the open submission first; the submit script re-adds it.
4. Submit with the session's `asc-submit-*.rb` (VER/BUILD env; creates the version if missing, attaches the VALID build, sets What's New, submits with automatic release).

First used 2026-09-28 for 2.3 (204); bible §313.
