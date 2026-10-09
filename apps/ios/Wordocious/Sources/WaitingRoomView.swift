import SwiftUI
import WordociousCore

/// The waiting room as a little lobby (FRIDAY-QUEUE item 22, 2.8 wave 3): your living mascot on the
/// stage, an empty seat with a "?" opposite where your opponent will appear, ONE status line in the
/// bubble lettering ("Waiting for your friend..."), a REAL counting timer from the stored start, a
/// quiet idle caption, and a tiny keepy-uppy tile to tap while you wait (no stakes, nothing saved, it
/// stops the moment the match starts). The words and the clock math are WaitingRoom (WordociousCore),
/// pinned to the web by waiting-room-fixtures.json. Web twin: components/vs/lobby-stage.tsx.
struct WaitingRoomStage: View {
    let kind: WaitingKind
    /// The invited friend's name when known.
    var name: String? = nil
    /// When the wait began; the clock counts up from it every second.
    let startedAt: Date
    /// true once the match is starting: the mini-play stops.
    var paused = false

    @Environment(\.accessibilityReduceMotion) private var envReduceMotion
    private var still: Bool { Mascots.reduceMotion(envReduceMotion) }

    var body: some View {
        VStack(spacing: 12) {
            scene
            statusBlock
            MiniKeepyUppy(paused: paused, still: still)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Stage

    private var scene: some View {
        let profile = AuthService.shared.profile
        return ZStack {
            if ArtAsset.exists("art-lobby-stage") {
                Image("art-lobby-stage").resizable().interpolation(.high).scaledToFit()
                    .frame(maxWidth: .infinity).accessibilityHidden(true)
            }
            HStack(alignment: .bottom, spacing: 30) {
                VStack(spacing: 4) {
                    AvatarView(url: profile?.avatarUrl, username: profile?.username ?? "You", size: 116,
                               emoji: profile?.avatarEmoji, userId: profile?.id, stroke: false, living: true)
                    idleCaption
                }
                seat
            }
            .padding(.vertical, 14)
        }
        .frame(maxWidth: 360)
    }

    /// The empty seat: the medallion with a "?" until the opponent walks in.
    private var seat: some View {
        ZStack {
            if ArtAsset.exists("art-lobby-seat-medallion") {
                Image("art-lobby-seat-medallion").resizable().interpolation(.high).scaledToFit()
            } else {
                Circle().fill(VsLobbyKit.ink.vsWash(0.18))
            }
            Text("?").font(Brand.font(46, .black)).foregroundStyle(.white)
                .shadow(color: VsLobbyKit.ink.opacity(0.5), radius: 3, y: 2)
        }
        .frame(width: 96, height: 96)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Empty seat. Your opponent will appear here.")
    }

    /// Your mascot's idle bit ("checks its watch"), shown for the first 3 s of each 6 s window.
    private var idleCaption: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let secs = WaitingRoom.waitedSeconds(since: startedAt, now: ctx.date)
            let bit = WaitingRoom.idleBit(secs)
            let showing = bit != nil && (secs % WaitingRoom.idleEveryS) < 3
            Text(bit.map { "Your mascot \($0)" } ?? " ")
                .font(Brand.font(10.5, .heavy)).foregroundStyle(VsLobbyKit.mutedInk)
                .lineLimit(1).minimumScaleFactor(0.8)
                .opacity(showing ? 1 : 0)
                .animation(still ? nil : .easeInOut(duration: 0.25), value: showing)
                .accessibilityHidden(true)
        }
        .frame(height: 14)
    }

    // MARK: Status + clock

    private var statusBlock: some View {
        let line = WaitingRoom.statusLine(kind: kind, name: name)
        return VStack(spacing: 4) {
            // The bubble atlas has no ellipsis glyph, so the lettering spells it with three periods;
            // VoiceOver reads the real line.
            BubbleTextView(text: line.replacingOccurrences(of: "…", with: "..."), palette: .vs,
                           names: name.map { [$0] } ?? [], maxSize: 28, minSize: 18, animated: !still)
                .frame(maxWidth: .infinity, minHeight: 36)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(line)
                .accessibilityAddTraits(.isHeader)
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                let secs = WaitingRoom.waitedSeconds(since: startedAt, now: ctx.date)
                Text(WaitingRoom.waitClock(Double(secs)))
                    .softNumber(22, color: VsLobbyKit.numberInk)
                    .accessibilityLabel("Waited \(secs) seconds")
            }
        }
    }
}

/// A glossy tile to keep in the air: tap before it lands. The count is shown with the shared
/// WaitingRoom.keepyLine. No stakes, nothing saved; `paused` (the match is starting) stops it.
struct MiniKeepyUppy: View {
    let paused: Bool
    let still: Bool

    @State private var count = 0
    /// The best streak so far this wait (a dropped tile banks the streak).
    @State private var best = 0
    @State private var lift: CGFloat = 0
    @State private var airUntil = Date.distantPast
    private let letters = Array("WORDOCIOUS").map(String.init)

    var body: some View {
        VStack(spacing: 4) {
            Button(action: tap) {
                GlossyTile(face: .typed, letter: letters[count % letters.count], width: 46)
                    .offset(y: lift)
                    .frame(width: 60, height: 100, alignment: .bottom)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.squishCard)
            .disabled(paused)
            .opacity(paused ? 0.4 : 1)
            .accessibilityLabel("Keep the tile bouncing")
            .accessibilityValue(WaitingRoom.keepyLine(count: count, best: best))
            Text(WaitingRoom.keepyLine(count: count, best: best))
                .font(Brand.font(12, .heavy)).monospacedDigit().foregroundStyle(VsLobbyKit.mutedInk)
        }
    }

    private func tap() {
        guard !paused else { return }
        let now = Date()
        if count == 0 || still || now <= airUntil {
            count += 1
        } else {
            // It landed before the tap: bank the streak and start over.
            best = max(best, count)
            count = 1
        }
        Feedback.keyTap()
        guard !still else { return }
        airUntil = now.addingTimeInterval(0.6)
        withAnimation(.easeOut(duration: 0.26)) { lift = -52 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.26) {
            withAnimation(.easeIn(duration: 0.3)) { lift = 0 }
        }
    }
}
