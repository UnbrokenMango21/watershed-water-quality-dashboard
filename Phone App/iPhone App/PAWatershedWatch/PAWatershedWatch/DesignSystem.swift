import Combine
import SwiftUI

// BEGIN GENERATED BRAND TOKENS: GENERATED from config/brand_tokens.json by scripts/brand-tokens.mjs. Do not edit by hand.
enum BrandTokens {
    /// Page / screen background
    static let canvas = Color(light: 0xF6F3EC, dark: 0x0F1A17)
    /// Cards and panels
    static let surface = Color(light: 0xFBFAF6, dark: 0x17261F)
    /// Card header band
    static let surfaceHeader = Color(light: 0xF2EEE5, dark: 0x1B2C25)
    /// Table heads, segmented tracks, selected rows
    static let surfaceRaised = Color(light: 0xEDE8DD, dark: 0x22352D)
    /// Text inputs and map/figure grounds
    static let surfaceField = Color(light: 0xFFFFFF, dark: 0x132019)
    /// Hairline borders (decorative)
    static let line = Color(light: 0xD6CEBF, dark: 0x2F443B)
    /// Row separators inside a card
    static let lineSoft = Color(light: 0xE3DCCF, dark: 0x243830)
    /// Draft pill outline, dividers that must read
    static let lineStrong = Color(light: 0x9AA39F, dark: 0x5B6762)
    /// Form control borders (3:1 non-text)
    static let lineInput = Color(light: 0x7E8984, dark: 0x76827D)
    /// Body text
    static let ink = Color(light: 0x1C2522, dark: 0xECE8DF)
    /// Secondary text, eyebrows
    static let inkMuted = Color(light: 0x4C5854, dark: 0xA9B3AE)
    /// Primary actions, headings, links
    static let primary = Color(light: 0x0D5C4B, dark: 0x6CC3AA)
    /// Text on primary fills
    static let onPrimary = Color(light: 0xF6F3EC, dark: 0x0F1A17)
    /// Primary hover / selected tint
    static let primarySoft = Color(light: 0xE2EDE6, dark: 0x173A31)
    /// Secondary accent, Submitted
    static let water = Color(light: 0x167A8B, dark: 0x6CC2D1)
    /// Monitoring point and graphics only
    static let goldGraphic = Color(light: 0xA76100, dark: 0xE6A941)
    /// In review / warning text
    static let goldText = Color(light: 0x955600, dark: 0xE6A941)
    /// Approved / success
    static let fern = Color(light: 0x2E7D52, dark: 0x7CC79A)
    /// Errors, changes requested, destructive
    static let alert = Color(light: 0xA3342B, dark: 0xF08A7E)

    static let statusNeutralBackground = Color.clear
    static let statusNeutralBorder = Color(light: 0x9AA39F, dark: 0x5B6762)
    static let statusNeutralMark = Color(light: 0x4C5854, dark: 0xA9B3AE)
    static let statusNeutralText = Color(light: 0x1C2522, dark: 0xECE8DF)
    static let statusSubmittedBackground = Color(light: 0xDDEDF0, dark: 0x15333A)
    static let statusSubmittedBorder = Color(light: 0xDDEDF0, dark: 0x15333A)
    static let statusSubmittedMark = Color(light: 0x167A8B, dark: 0x6CC2D1)
    static let statusSubmittedText = Color(light: 0x1C2522, dark: 0xECE8DF)
    static let statusReviewBackground = Color(light: 0xF5EAD9, dark: 0x3A2E17)
    static let statusReviewBorder = Color(light: 0xF5EAD9, dark: 0x3A2E17)
    static let statusReviewMark = Color(light: 0x955600, dark: 0xE6A941)
    static let statusReviewText = Color(light: 0x1C2522, dark: 0xECE8DF)
    static let statusAttentionBackground = Color(light: 0xF6E3E1, dark: 0x3D1F1C)
    static let statusAttentionBorder = Color(light: 0xF6E3E1, dark: 0x3D1F1C)
    static let statusAttentionMark = Color(light: 0xA3342B, dark: 0xF08A7E)
    static let statusAttentionText = Color(light: 0x1C2522, dark: 0xECE8DF)
    static let statusApprovedBackground = Color(light: 0xE0EFE5, dark: 0x1A3526)
    static let statusApprovedBorder = Color(light: 0xE0EFE5, dark: 0x1A3526)
    static let statusApprovedMark = Color(light: 0x2E7D52, dark: 0x7CC79A)
    static let statusApprovedText = Color(light: 0x1C2522, dark: 0xECE8DF)
    static let statusPublishedBackground = Color(light: 0x0D5C4B, dark: 0x6CC3AA)
    static let statusPublishedBorder = Color(light: 0x0D5C4B, dark: 0x6CC3AA)
    static let statusPublishedMark = Color(light: 0xE6A941, dark: 0x0F1A17)
    static let statusPublishedText = Color(light: 0xF6F3EC, dark: 0x0F1A17)

    static let radiusXS: CGFloat = 4
    static let radiusSM: CGFloat = 6
    static let radiusMD: CGFloat = 8
    static let radiusLG: CGFloat = 12
    static let radiusXL: CGFloat = 16

    /// Presentation tone for each canonical workflow state, keyed by `WorkflowState.rawValue`.
    static let workflowTone: [String: StatusTone] = [
        "draft": .neutral,
        "submitted": .submitted,
        "validating": .submitted,
        "resubmitted": .submitted,
        "pendingReview": .review,
        "needsCorrection": .attention,
        "rejected": .attention,
        "publishFailed": .attention,
        "approved": .approved,
        "publishing": .approved,
        "published": .published,
    ]
}

enum StatusTone: String, CaseIterable { case neutral, submitted, review, attention, approved, published }
// END GENERATED BRAND TOKENS

/// App-facing names for the brand tokens above. Screens use these, never raw hex or system colors.
enum FieldTheme {
    static let hemlock = BrandTokens.primary
    static let water = BrandTokens.water
    /// Goldenrod text tone; the brighter graphic gold is `goldGraphic`.
    static let goldenrod = BrandTokens.goldText
    static let goldGraphic = BrandTokens.goldGraphic
    static let fern = BrandTokens.fern
    static let alert = BrandTokens.alert
    static let limestone = BrandTokens.canvas
    static let surface = BrandTokens.surface
    static let surfaceHeader = BrandTokens.surfaceHeader
    static let surfaceRaised = BrandTokens.surfaceRaised
    static let surfaceField = BrandTokens.surfaceField
    static let line = BrandTokens.line
    static let lineSoft = BrandTokens.lineSoft
    static let lineStrong = BrandTokens.lineStrong
    static let lineInput = BrandTokens.lineInput
    static let ink = BrandTokens.ink
    static let inkMuted = BrandTokens.inkMuted
    static let onPrimary = BrandTokens.onPrimary
    static let primarySoft = BrandTokens.primarySoft

    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 16
    static let l: CGFloat = 24
    static let xl: CGFloat = 32
    /// Status pills and chips.
    static let radiusXS: CGFloat = BrandTokens.radiusSM
    /// Inputs, tiles and inline controls.
    static let radiusS: CGFloat = BrandTokens.radiusMD
    /// Cards, panels and primary buttons.
    static let radiusM: CGFloat = BrandTokens.radiusLG
    /// Hero surfaces.
    static let radiusL: CGFloat = BrandTokens.radiusXL
    static let hairline: CGFloat = 1
}

extension Color {
    nonisolated init(light: UInt, dark: UInt) {
        self.init(uiColor: UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((value >> 16) & 0xff) / 255,
                green: CGFloat((value >> 8) & 0xff) / 255,
                blue: CGFloat(value & 0xff) / 255,
                alpha: 1
            )
        })
    }
}

// MARK: - Status tones

/// Colors for the brand's status grammar. The label always carries the meaning; the tone reinforces it.
extension StatusTone {
    /// Tones for signals that are not workflow states (GPS quality, notices, validation severity).
    static let info = StatusTone.submitted
    static let warning = StatusTone.review
    static let error = StatusTone.attention
    static let success = StatusTone.approved

    var background: Color {
        switch self {
        case .neutral: BrandTokens.statusNeutralBackground
        case .submitted: BrandTokens.statusSubmittedBackground
        case .review: BrandTokens.statusReviewBackground
        case .attention: BrandTokens.statusAttentionBackground
        case .approved: BrandTokens.statusApprovedBackground
        case .published: BrandTokens.statusPublishedBackground
        }
    }

    var border: Color {
        switch self {
        case .neutral: BrandTokens.statusNeutralBorder
        case .submitted: BrandTokens.statusSubmittedBorder
        case .review: BrandTokens.statusReviewBorder
        case .attention: BrandTokens.statusAttentionBorder
        case .approved: BrandTokens.statusApprovedBorder
        case .published: BrandTokens.statusPublishedBorder
        }
    }

    /// The small square (or icon) that carries the tone.
    var mark: Color {
        switch self {
        case .neutral: BrandTokens.statusNeutralMark
        case .submitted: BrandTokens.statusSubmittedMark
        case .review: BrandTokens.statusReviewMark
        case .attention: BrandTokens.statusAttentionMark
        case .approved: BrandTokens.statusApprovedMark
        case .published: BrandTokens.statusPublishedMark
        }
    }

    var text: Color {
        switch self {
        case .neutral: BrandTokens.statusNeutralText
        case .submitted: BrandTokens.statusSubmittedText
        case .review: BrandTokens.statusReviewText
        case .attention: BrandTokens.statusAttentionText
        case .approved: BrandTokens.statusApprovedText
        case .published: BrandTokens.statusPublishedText
        }
    }

    /// Foreground for icons and emphasized words set directly on the canvas or a card.
    var foreground: Color {
        switch self {
        case .neutral: FieldTheme.inkMuted
        case .submitted: FieldTheme.water
        case .review: FieldTheme.goldenrod
        case .attention: FieldTheme.alert
        case .approved: FieldTheme.fern
        case .published: FieldTheme.hemlock
        }
    }
}

extension WorkflowState {
    var tone: StatusTone { BrandTokens.workflowTone[rawValue] ?? .neutral }
}

// MARK: - Identity

struct WatershedMark: View {
    var size: CGFloat = 56

    var body: some View {
        Image("BrandIcon")
            .resizable()
            .clipShape(RoundedRectangle(cornerRadius: size * 0.225, style: .continuous))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The one required-field indicator in the app. Applied only to fields that `canonicalSnapshot()`
/// or `requiredMeasurements` already enforce, so the glyph never promises a rule that does not exist.
struct RequiredMark: View {
    var body: some View {
        Text(verbatim: "*")
            .font(.subheadline.weight(.bold))
            .foregroundStyle(FieldTheme.alert)
            .accessibilityLabel("Required")
    }
}

// MARK: - Type

struct FieldSectionHeader: View {
    let title: LocalizedStringResource
    var detail: LocalizedStringResource?
    var isRequired = false

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.xs) {
            HStack(spacing: FieldTheme.xs) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(FieldTheme.ink)
                if isRequired { RequiredMark() }
            }
            .accessibilityAddTraits(.isHeader)
            if let detail {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Small uppercase label above a group of metadata, e.g. "COLLECTED" or "REVISION 2".
struct Eyebrow: View {
    let text: Text

    init(_ title: LocalizedStringResource) { text = Text(title) }
    init(verbatim: String) { text = Text(verbatim: verbatim) }

    var body: some View {
        text
            .font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .tracking(0.6)
            .foregroundStyle(FieldTheme.inkMuted)
    }
}

// MARK: - Surfaces

struct FieldCardModifier: ViewModifier {
    var padding: CGFloat = FieldTheme.m
    var fill: Color = FieldTheme.surface

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                    .strokeBorder(FieldTheme.line, lineWidth: FieldTheme.hairline)
            }
    }
}

extension View {
    /// The one card treatment: warm surface, 12 pt continuous corners, hairline border, no shadow.
    func fieldCard(padding: CGFloat = FieldTheme.m, fill: Color = FieldTheme.surface) -> some View {
        modifier(FieldCardModifier(padding: padding, fill: fill))
    }

    /// Text entry treatment: white field, 3:1 border, hemlock when focused, alert when invalid.
    func fieldInput(focused: Bool = false, invalid: Bool = false, minHeight: CGFloat = 52) -> some View {
        frame(minHeight: minHeight)
            .background(FieldTheme.surfaceField, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous)
                    .strokeBorder(invalid ? FieldTheme.alert : (focused ? FieldTheme.hemlock : FieldTheme.lineInput), lineWidth: focused || invalid ? 2 : FieldTheme.hairline)
            }
    }

    func fieldScreen() -> some View {
        scrollContentBackground(.hidden)
            .background(FieldTheme.limestone.ignoresSafeArea())
            .tint(FieldTheme.hemlock)
    }
}

/// Hairline between rows inside a card.
struct CardDivider: View {
    var body: some View {
        Rectangle().fill(FieldTheme.lineSoft).frame(height: FieldTheme.hairline)
    }
}

/// The persistent action shelf at the foot of every collection screen.
struct ActionShelf<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: FieldTheme.s) { content }
            .padding(.horizontal, FieldTheme.m)
            .padding(.top, 12)
            .padding(.bottom, FieldTheme.s)
            .background(.bar)
            .overlay(alignment: .top) { Rectangle().fill(FieldTheme.line).frame(height: FieldTheme.hairline) }
    }
}

// MARK: - Buttons

struct PrimaryActionButton: View {
    let title: LocalizedStringResource
    var systemImage: String?
    var isEnabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldTheme.s) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                Spacer(minLength: FieldTheme.s)
                Image(systemName: "arrow.right")
            }
            .font(.headline)
            .foregroundStyle(isEnabled ? FieldTheme.onPrimary : FieldTheme.inkMuted)
            .padding(.horizontal, FieldTheme.m)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(isEnabled ? FieldTheme.hemlock : FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        }
        .buttonStyle(PressableStyle())
        .disabled(!isEnabled)
        .accessibilityAddTraits(.isButton)
    }
}

struct SecondaryActionButton: View {
    let title: LocalizedStringResource
    var systemImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldTheme.s) {
                if let systemImage { Image(systemName: systemImage) }
                Text(title)
            }
            .font(.headline)
            .foregroundStyle(FieldTheme.hemlock)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(FieldTheme.surface, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                    .strokeBorder(FieldTheme.hemlock, lineWidth: FieldTheme.hairline)
            }
            .contentShape(RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        }
        .buttonStyle(PressableStyle())
    }
}

/// Compact bordered action used inside cards (Reacquire GPS, Retry Sync, Open Settings).
struct InlineActionButton: View {
    let title: LocalizedStringResource
    var systemImage: String?
    var isEnabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldTheme.s) {
                if let systemImage { Image(systemName: systemImage) }
                Text(title)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(isEnabled ? FieldTheme.hemlock : FieldTheme.inkMuted)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(isEnabled ? FieldTheme.primarySoft : FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        }
        .buttonStyle(PressableStyle())
        .disabled(!isEnabled)
    }
}

/// Native-feeling press feedback without system button chrome.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.78 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Status

/// A tinted chip for signals that are not workflow states (GPS quality, cached records, emulator mode).
struct StatusPill: View {
    let title: Text
    let systemImage: String?
    let tone: StatusTone

    init(title: LocalizedStringResource, systemImage: String? = nil, tone: StatusTone) {
        self.title = Text(title); self.systemImage = systemImage; self.tone = tone
    }

    init(verbatimTitle: String, systemImage: String? = nil, tone: StatusTone) {
        title = Text(verbatimTitle); self.systemImage = systemImage; self.tone = tone
    }

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage {
                Image(systemName: systemImage)
                    .foregroundStyle(tone.mark)
                    .accessibilityHidden(true)
            }
            title.foregroundStyle(tone.text)
        }
        .font(.footnote.weight(.semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusXS, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusXS, style: .continuous)
                .strokeBorder(tone.border, lineWidth: FieldTheme.hairline)
        }
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }
}

/// Where the record stands in human review: a tinted rectangle with a leading square. Never shares a
/// shape with sync status.
struct WorkflowPill: View {
    let state: WorkflowState

    var body: some View {
        let tone = state.tone
        HStack(spacing: FieldTheme.s) {
            Group {
                if tone == .neutral {
                    Rectangle().strokeBorder(tone.mark, lineWidth: 1.5)
                } else {
                    Rectangle().fill(tone.mark)
                }
            }
            .frame(width: 8, height: 8)
            .accessibilityHidden(true)
            Text(state.title)
                .foregroundStyle(tone.text)
        }
        .font(.footnote.weight(.semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusXS, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusXS, style: .continuous)
                .strokeBorder(tone.border, lineWidth: FieldTheme.hairline)
        }
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .combine)
    }
}

/// Where the data physically is: a bare circle glyph and text, no container.
struct SyncStatusLabel: View {
    let state: SyncState

    var body: some View {
        HStack(spacing: FieldTheme.s) {
            SyncGlyph(state: state)
                .accessibilityHidden(true)
            Text(state.title)
                .font(state == .failed ? .footnote.weight(.semibold) : .footnote)
                .foregroundStyle(state == .failed ? FieldTheme.alert : FieldTheme.ink)
        }
        .accessibilityElement(children: .combine)
    }
}

struct SyncGlyph: View {
    let state: SyncState
    @ScaledMetric(relativeTo: .footnote) private var size: CGFloat = 10

    var body: some View {
        Group {
            switch state {
            case .savedLocally:
                Circle().strokeBorder(FieldTheme.inkMuted, lineWidth: 1.5)
            case .waiting:
                Circle().strokeBorder(FieldTheme.water, style: StrokeStyle(lineWidth: 1.5, dash: [2, 2]))
            case .syncing:
                Circle()
                    .fill(LinearGradient(stops: [.init(color: FieldTheme.water, location: 0.5), .init(color: .clear, location: 0.5)], startPoint: .leading, endPoint: .trailing))
                    .overlay { Circle().strokeBorder(FieldTheme.water, lineWidth: 1.5) }
            case .synced:
                Circle().fill(FieldTheme.hemlock)
            case .failed:
                Circle().fill(FieldTheme.alert)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Workflow pill and sync line together; they wrap to two lines at large text sizes.
struct WorkflowSyncLine: View {
    let workflow: WorkflowState
    let sync: SyncState

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) {
                WorkflowPill(state: workflow)
                SyncStatusLabel(state: sync)
            }
            VStack(alignment: .leading, spacing: FieldTheme.s) {
                WorkflowPill(state: workflow)
                SyncStatusLabel(state: sync)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NoticeBanner: View {
    let title: LocalizedStringResource
    let message: Text
    let systemImage: String
    var tone: StatusTone = .warning

    init(title: LocalizedStringResource, message: LocalizedStringResource, systemImage: String, tone: StatusTone = .warning) {
        self.title = title; self.message = Text(message); self.systemImage = systemImage; self.tone = tone
    }

    init(title: LocalizedStringResource, verbatimMessage: String, systemImage: String, tone: StatusTone = .warning) {
        self.title = title; message = Text(verbatim: verbatimMessage); self.systemImage = systemImage; self.tone = tone
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(tone.foreground)
                .frame(width: 24)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(title).font(.headline).foregroundStyle(FieldTheme.ink)
                message.font(.subheadline).foregroundStyle(FieldTheme.ink.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(FieldTheme.m)
        .background(tone == .neutral ? FieldTheme.surfaceRaised : tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: FieldTheme.radiusM, bottomLeadingRadius: FieldTheme.radiusM, style: .continuous)
                .fill(tone.foreground)
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Keyboard

/// Tracks whether the software keyboard is on screen so bottom action bars can compact themselves
/// instead of leaving a tall band between the content and the keyboard.
struct KeyboardVisibilityModifier: ViewModifier {
    @Binding var isVisible: Bool

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in isVisible = true }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in isVisible = false }
    }
}

extension View {
    func trackingKeyboard(_ isVisible: Binding<Bool>) -> some View {
        modifier(KeyboardVisibilityModifier(isVisible: isVisible))
    }
}

/// Keyboard controls that live inside a screen's bottom bar rather than in a floating keyboard toolbar,
/// so the bar sits directly on the keyboard and never overlaps the primary action.
struct KeyboardControlsRow: View {
    var onNextField: (() -> Void)?
    let onDone: () -> Void

    var body: some View {
        HStack {
            if let onNextField {
                Button("Next Field", systemImage: "arrow.down", action: onNextField)
                    .accessibilityIdentifier("keyboard.next")
            }
            Spacer()
            Button("Done", action: onDone)
                .fontWeight(.semibold)
                .accessibilityIdentifier("keyboard.done")
        }
        .font(.subheadline)
        .buttonStyle(.borderless)
        .frame(minHeight: 44)
    }
}

/// Step progress for the six-step collection flow: one segment per step, filled through the current one.
struct StepProgressBar: View {
    let step: Int
    let total: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(1...max(total, 1), id: \.self) { index in
                Capsule()
                    .fill(index <= step ? FieldTheme.hemlock : FieldTheme.line)
                    .frame(height: 4)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Step \(step) of \(total)")
    }
}

struct FlowFooter: View {
    let step: Int
    let total: Int
    let actionTitle: LocalizedStringResource
    var saveText: LocalizedStringResource = "Saved on this phone"
    /// Shown while the keyboard is up; nil hides the keyboard controls for screens without text entry.
    var onDismissKeyboard: (() -> Void)?
    var onNextField: (() -> Void)?
    let action: () -> Void
    @State private var keyboardVisible = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ActionShelf {
            if keyboardVisible {
                if let onDismissKeyboard {
                    KeyboardControlsRow(onNextField: onNextField, onDone: onDismissKeyboard)
                }
            } else {
                // Progress returns when the keyboard closes. At accessibility sizes the save note is
                // dropped so the bar stays compact; the step count remains.
                HStack(spacing: FieldTheme.s) {
                    if !dynamicTypeSize.isAccessibilitySize {
                        HStack(spacing: FieldTheme.s) {
                            SyncGlyph(state: .savedLocally).accessibilityHidden(true)
                            Text(saveText).font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    Spacer()
                    Text("Step \(step) of \(total)")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FieldTheme.inkMuted)
                        .monospacedDigit()
                }
                StepProgressBar(step: step, total: total)
            }
            PrimaryActionButton(title: actionTitle, action: action)
                .accessibilityIdentifier("flow.next")
        }
        .trackingKeyboard($keyboardVisible)
    }
}

struct KeyValueRow: View {
    let label: LocalizedStringResource
    let value: String
    var emphasized = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(FieldTheme.inkMuted)
            Text(value)
                .font(emphasized ? .title3.weight(.semibold) : .body)
                .monospacedDigit()
                .multilineTextAlignment(.leading)
                .foregroundStyle(FieldTheme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, FieldTheme.s)
        .accessibilityElement(children: .combine)
    }
}
