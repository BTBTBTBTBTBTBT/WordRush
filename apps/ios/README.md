# Wordocious iOS (native SwiftUI)

Fully native iOS app for Wordocious. No Capacitor / WebView. Talks to the
same Supabase backend and socket.io server as the web app; the game engine
is a 1:1 Swift port of `packages/core` validated against the TS engine.

## Layout

- `Package.swift` — SwiftPM package `WordociousCore` (the game engine).
- `Sources/Core/` — Swift port of `packages/core` (Types, Evaluator, Dictionary, Seed, Scoring, Prefill, Reducer).
- `Tests/` — `EngineParityTests` + JSON fixtures generated from the live TS engine.
- `Wordocious/` — the SwiftUI app target (sources + bundled word lists).
- `project.yml` — XcodeGen spec. The `.xcodeproj` is generated, not committed.
- `generate-fixtures.mjs` — regenerates parity fixtures from the TS engine.

## Setup (fresh clone)

```sh
brew install xcodegen          # one-time
cd apps/ios
xcodegen generate              # creates Wordocious.xcodeproj
open Wordocious.xcodeproj       # then set your signing team in Xcode
```

## Run the engine parity tests

```sh
cd apps/ios
swift test                     # 16 tests, must all pass
```

## Regenerate parity fixtures (after changing packages/core)

```sh
node apps/ios/generate-fixtures.mjs
```

## Parity contract

`simpleHash` uses Int32 arithmetic to match JavaScript's 32-bit bitwise
behavior exactly. This guarantees a given seed produces the same puzzle
words on iOS and web — required for shared daily challenges and VS matches.
Never change engine logic on one platform without updating the other and
re-running the fixtures.
