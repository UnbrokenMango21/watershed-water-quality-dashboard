// Watershed Watch identity reveal for SwiftUI (iOS 17+). Drop-in source; not yet wired into the app.
//
// It replays the web reveal exactly: the same original strokes, tracks and cubic-bezier curves, all
// read from WatershedWatchRevealGeometry.swift (generated from brand/motion/source/motion-spec.json).
//
// Use it only after the first app frame (the system launch screen is static) and only while real work
// is still pending. Remove it the moment that work finishes; never wait for the animation. With
// Reduce Motion, or `play: false`, it draws the settled mark, which equals the static logo.
import SwiftUI

public struct WatershedWatchReveal: View {
    public enum Layout { case mark, horizontal, stacked }

    private typealias G = WatershedWatchRevealGeometry
    private let layout: Layout
    private let play: Bool
    private let frozenTime: Double?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startDate: Date?
    @State private var settled = false

    public init(_ layout: Layout = .mark, play: Bool = true) {
        self.layout = layout
        self.play = play
        self.frozenTime = nil
    }

    /// A single frame at `seconds` into the reveal, for previews and snapshot tests.
    public init(_ layout: Layout, frozenAt seconds: Double) {
        self.layout = layout
        self.play = false
        self.frozenTime = seconds
    }

    private var geometry: G.Layout {
        switch layout {
        case .mark: G.mark
        case .horizontal: G.horizontal
        case .stacked: G.stacked
        }
    }

    public var body: some View {
        TimelineView(.animation(paused: settled)) { timeline in
            Canvas { context, size in
                draw(in: context, size: size, t: elapsed(at: timeline.date))
            }
        }
        .aspectRatio(geometry.width / geometry.height, contentMode: .fit)
        .accessibilityHidden(true)
        .onAppear {
            guard play, !reduceMotion, startDate == nil else { settled = true; return }
            startDate = Date()
            let duration = layout == .mark ? G.settledMark : G.settledLockup
            DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.05) { settled = true }
        }
    }

    private func elapsed(at date: Date) -> Double {
        if let frozenTime { return frozenTime }
        guard let startDate, !settled else { return .infinity }
        return date.timeIntervalSince(startDate)
    }

    private func draw(in context: GraphicsContext, size: CGSize, t: Double) {
        let palette = colorScheme == .dark ? G.dark : G.light
        var context = context
        context.scaleBy(x: size.width / geometry.width, y: size.height / geometry.height)

        var mark = context
        mark.translateBy(x: geometry.markOffset.x, y: geometry.markOffset.y)
        for (index, stroke) in G.strokes.enumerated() {
            let track = Self.track(for: stroke.part)
            let linear = Self.fraction(t, track)
            guard linear > 0 else { continue }
            let drawn = Self.stroke.solve(linear)
            var layer = mark
            layer.opacity = Self.stroke.solve(min(1, linear / G.strokeFadeInFraction))
            layer.stroke(
                Self.strokePaths[index].trimmedPath(from: 0, to: drawn),
                with: .color(Color(hex: palette.stream)),
                style: StrokeStyle(lineWidth: stroke.width, lineCap: .round, lineJoin: .round)
            )
        }

        let point = Self.settle.solve(Self.fraction(t, G.monitoringPoint))
        if point > 0 {
            let radius = G.point.r * (G.pointFromScale + (1 - G.pointFromScale) * point)
            var layer = mark
            layer.opacity = point
            layer.fill(
                Path(ellipseIn: CGRect(x: G.point.cx - radius, y: G.point.cy - radius, width: radius * 2, height: radius * 2)),
                with: .color(Color(hex: palette.point))
            )
        }

        guard layout != .mark, let word = Self.wordmarkPaths[layout] else { return }
        let sweep = Self.settle.solve(Self.fraction(t, G.wordmark))
        guard sweep > 0 else { return }
        let geometry = geometry
        context.drawLayer { layer in
            layer.fill(word, with: .color(Color(hex: palette.word)))
            // Feathered left-to-right mask, as in the web reveal; the letters never move.
            layer.blendMode = .destinationIn
            let x = geometry.sweepEndX - geometry.sweepTravel * (1 - sweep)
            let rect = CGRect(x: x, y: 0, width: geometry.sweepWidth, height: geometry.height)
            layer.fill(Path(rect), with: .linearGradient(
                Gradient(stops: [
                    .init(color: .white, location: 0),
                    .init(color: .white, location: 1 - geometry.sweepFeather),
                    .init(color: .white.opacity(0), location: 1),
                ]),
                startPoint: CGPoint(x: rect.minX, y: 0),
                endPoint: CGPoint(x: rect.maxX, y: 0)
            ))
        }
    }

    // MARK: Timeline

    private static let stroke = UnitBezier(G.strokeEasing)
    private static let settle = UnitBezier(G.settleEasing)
    private static let strokePaths = G.strokes.map { SVGPathData.path($0.d) }
    private static let wordmarkPaths: [Layout: Path] = [
        .horizontal: SVGPathData.path(G.horizontal.wordmark),
        .stacked: SVGPathData.path(G.stacked.wordmark),
    ]

    private static func track(for part: String) -> G.Track {
        switch part {
        case "tributary-left": G.tributaryLeft
        case "tributary-right": G.tributaryRight
        case "tributary-middle": G.tributaryMiddle
        default: G.river
        }
    }

    /// Linear progress of a track at time `t` (seconds), clamped to 0...1.
    private static func fraction(_ t: Double, _ track: G.Track) -> Double {
        guard t.isFinite else { return 1 }
        return min(1, max(0, (t - track.delay) / track.duration))
    }
}

/// CSS-compatible cubic-bezier timing (the WebKit UnitBezier solver).
private struct UnitBezier {
    let ax, bx, cx, ay, by, cy: Double

    init(_ p: (Double, Double, Double, Double)) {
        cx = 3 * p.0; bx = 3 * (p.2 - p.0) - cx; ax = 1 - cx - bx
        cy = 3 * p.1; by = 3 * (p.3 - p.1) - cy; ay = 1 - cy - by
    }

    func solve(_ x: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        var t = x
        for _ in 0..<8 {
            let error = ((ax * t + bx) * t + cx) * t - x
            if abs(error) < 1e-7 { return ((ay * t + by) * t + cy) * t }
            let slope = (3 * ax * t + 2 * bx) * t + cx
            if abs(slope) < 1e-7 { break }
            t -= error / slope
        }
        var low = 0.0, high = 1.0
        t = x
        while high - low > 1e-7 {
            let value = ((ax * t + bx) * t + cx) * t
            if value < x { low = t } else { high = t }
            t = (low + high) / 2
        }
        return ((ay * t + by) * t + cy) * t
    }
}

/// Minimal parser for the absolute M, L, C, Q and Z commands used by the logo geometry.
private enum SVGPathData {
    static func path(_ d: String) -> Path {
        var tokens: [String] = []
        var number = ""
        for character in d {
            if character.isLetter {
                if !number.isEmpty { tokens.append(number); number = "" }
                tokens.append(String(character))
            } else if character == " " || character == "," {
                if !number.isEmpty { tokens.append(number); number = "" }
            } else if character == "-", !number.isEmpty {
                tokens.append(number); number = "-"
            } else {
                number.append(character)
            }
        }
        if !number.isEmpty { tokens.append(number) }

        var path = Path()
        var index = 0
        var command = "M"
        func next() -> CGFloat { defer { index += 1 }; return CGFloat(Double(tokens[index]) ?? 0) }
        func point() -> CGPoint { let x = next(); return CGPoint(x: x, y: next()) }
        while index < tokens.count {
            if let first = tokens[index].first, first.isLetter {
                command = tokens[index]
                index += 1
                if command == "Z" { path.closeSubpath(); continue }
            }
            switch command {
            case "M": path.move(to: point()); command = "L"
            case "L": path.addLine(to: point())
            case "Q": let control = point(); path.addQuadCurve(to: point(), control: control)
            case "C": let c1 = point(); let c2 = point(); path.addCurve(to: point(), control1: c1, control2: c2)
            default: index += 1
            }
        }
        return path
    }
}

private extension Color {
    init(hex: Int) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

#Preview("Mark, light and dark") {
    HStack(spacing: 40) {
        WatershedWatchReveal(.mark).frame(width: 64)
        WatershedWatchReveal(.stacked).frame(width: 220).environment(\.colorScheme, .dark).padding().background(Color(hex: WatershedWatchRevealGeometry.dark.canvas))
    }
    .padding()
}
