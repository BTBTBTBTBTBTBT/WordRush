# Perf harness (FINISH_SPEC BJ3)

A repeatable, measured hitch hunt for every build: the app plays itself through every
major surface and prints a per-surface table. Run it before and after any change that
touches UI, and paste the two tables into the change's notes.

## iOS — the `-perfTour` launch argument

```sh
apps/ios/scripts/perf-tour.sh --build                 # build Perf + run the whole tour
apps/ios/scripts/perf-tour.sh --only octo,quad        # re-run just some surfaces
apps/ios/scripts/perf-tour.sh --loops 2 --label after # cold + warm tables, named report
```

- **Code:** `apps/ios/Wordocious/Sources/PerfTour.swift`, entirely inside `#if DEBUG`.
  Hooks elsewhere are DEBUG-only one-liners: the app delegate boots it
  (`PushRegistration.swift`), `RootTabView` hosts its presenter, `GameViewModel`
  registers the live board, `KeyCaptureView` exposes `perfSend`, and `StrategyView` /
  `WordsView` accept "open item N". A Release build contains none of it.
- **Build:** the `Perf` configuration (project.yml) is Release optimization (`-O`,
  whole module) with `DEBUG` compiled in, so the tour runs on optimized code. It is
  simulator-only and never archived; its intermediates live apart from Debug and
  Release, so a perf build never invalidates anyone else's build (shared DerivedData).
- **Simulator:** headless, on the booted dev simulator (`PERF_UDID=<udid>` picks one).
  The script never creates a device and never opens Simulator.app. A signed-out install
  plays as a guest (nothing records) with the onboarding flag set. The simulator may be
  shared: the app also writes its report straight to the host (`-perfTourOut`), and a
  tour another session cuts off is re-run (up to 3 tries).
- **Safety:** the tour never builds a board before `DictionaryLoader.ensureInitialized()`
  and only starts after the cold-start intro lands; a normal launch (no `-perfTour`)
  never touches any of it.
- **What it does:** cold start + intro → Home idle, scroll top → bottom → top, the
  Daily / Unlimited switch, a fast fling → tabs Leaderboard (scroll, picker changes),
  Friends (scroll), Home → Settings (open, scroll, close), Help, the flawless header
  popup, Word of the Day (archive, a word), Strategy (index, an article, scroll) →
  fresh unlimited boards of Classic / QuadWord / OctoWord (type, submit, a rejected
  word), Gauntlet (a guess, then stage 1 solved → the stage card), Hubbub taps,
  Sudocious taps, Muddle typing, Crossword typing → a VS bot match start → the pocket
  games sheet. Classic and OctoWord are also played to the win (`.finish`: the reveal,
  the win card, and the finished screen built under it), and the Stats tab is scrolled. Games open through the post-game "Keep playing" route (a new seed every
  run) and close through the Home button route. Typing goes through the same
  hardware-key path every board listens to (+ the on-screen key's haptic). Scrolls
  set the page's UIScrollView offset once per display frame and raise the same
  "scrolling" signal a finger does, so idle loops pause exactly as in real use.
- **Measurement:** a CADisplayLink frame monitor (frame gaps over 25 ms and over
  50 ms, the worst gap, hitch time per second) and a main-run-loop observer (main
  thread busy %). Each step is an `os_signpost` interval (subsystem
  `com.wordocious.perf`, Points of Interest) and every stall over 50 ms a signpost
  event, so an Instruments trace of the same run lines up with the table:
  `xcrun xctrace record --template 'Time Profiler' --device <udid> --launch -- <Perf .app> -perfTour -perfTourOnly octo`.
  The script also counts "AttributeGraph: cycle detected" log lines during the run
  (printed under the table). To find a cycle's source, attach lldb to the tour
  (`xcrun simctl launch --wait-for-debugger …`) with a breakpoint on
  `AG::Graph::print_cycle` and read the backtrace (that is how BJ3 found the
  hardware-key catcher resigning first responder inside a graph update).
- **A/B switches:** `--flag <name>` passes `-perfFlag <name>`; a measurement can read
  `PerfTour.flag("name")` inside `#if DEBUG` to switch one suspect off and compare two
  runs of the same build (BJ3 used `noPop` / `noTray`; remove such checks after).
- **Output:** `Documents/perf/perf-tour-latest.md` (+ `.json`, + a timestamped copy)
  in the app container (`xcrun simctl get_app_container <udid> com.wordocious.app
  data`), copied by the script to `apps/ios/build/perf/perf-tour-<label>.md`. The app
  exits itself after writing (no crash dialog). `-perfTourStay` keeps it running.

Reading the table: `first ms` = the first frame after the step's action (a new
element's first appearance: over 25 ms there means art decoded or a big view built on
the presenting frame), `>25ms` = frames that missed at least one vsync, `>50ms` = visible
stalls, `hitch ms/s` = total time over budget per second (Apple's hitch ratio; under
5 is good, over 10 is felt), `main busy %` = share of wall time the main thread was
awake. Simulator numbers run on the Mac's GPU/CPU: compare runs with each other, not
with a device. Loop 1 is the cold pass (first decode of every image / font); loop 2
is warm. Each `.open` step includes the presentation itself (UIKit's sheet / cover
transition costs one ~50–70 ms frame on the simulator on its own).

## Android — `scripts/android-perf-tour.sh`

```sh
(cd apps/android && ./gradlew :app:installBenchmarkRelease)   # optimized, debug-signed
~/Library/Android/sdk/emulator/emulator -avd wordo -no-window -no-audio -no-boot-anim -gpu host &   # headless defaults to SwiftShader: 200-300 ms frames
./scripts/android-perf-tour.sh --label before
ONLY=home,octo ./scripts/android-perf-tour.sh
```

The same surfaces with real adb input (swipes, taps resolved by text through
uiautomator BEFORE the counters reset, hardware-key typing), today's dailies opened
through the widget deep link (`wordocious://daily/<MODE>`; a guest never records).
Each step resets `dumpsys gfxinfo` and reads it after: frames, janky %, p90 / p99 and
the frames over 25 / 50 ms from the histogram. Report:
`apps/android/build/perf/perf-tour-<label>.md`. No app code is involved.

## Web — `scripts/web-perf-tour.mjs`

```sh
node scripts/web-perf-tour.mjs                         # production
node scripts/web-perf-tour.mjs http://localhost:3000   # a local `next start`
```

Dependency-free: its own headless Chrome (temp profile) over the DevTools protocol, a
390 × 844 phone with 4× CPU throttle, guest mode. Per step: rAF frame gaps over 25 /
50 ms, long tasks, layout + style ms, script ms and layout shift. Report:
`apps/web/.perf/perf-tour-<stamp>.md` (git-ignored).

## Results

See FINISH_SPEC BJ3 for the first before / after tables and the fixes they drove.
