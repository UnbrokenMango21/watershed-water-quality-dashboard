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

enum FieldTheme {
    static let hemlock = Color(light: 0x0D5C4B, dark: 0x63D3B3)
    static let water = Color(light: 0x167A8B, dark: 0x6BC9D5)
    static let goldenrod = Color(light: 0x955600, dark: 0xF3B65C)
    static let fern = Color(light: 0x2E7D52, dark: 0x66D49A)
    static let limestone = Color(light: 0xF3F1E9, dark: 0x171A18)
    static let ink = Color(light: 0x17211E, dark: 0xF1F5F3)

    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 16
    static let l: CGFloat = 24
    static let xl: CGFloat = 32
    static let radiusS: CGFloat = 12
    static let radiusM: CGFloat = 16
    static let radiusL: CGFloat = 24
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

struct WatershedMark: View {
    var size: CGFloat = 56

    var body: some View {
        Image("BrandIcon")
            .resizable()
            .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
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
            .foregroundStyle(.red)
            .accessibilityLabel("Required")
    }
}

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
            if let detail {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

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
            .foregroundStyle(Color(uiColor: .systemBackground))
            .padding(.horizontal, FieldTheme.m)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(isEnabled ? FieldTheme.hemlock : Color.secondary, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        }
        .buttonStyle(.plain)
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
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                    .stroke(FieldTheme.hemlock.opacity(0.3), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

struct StatusPill: View {
    let title: Text
    let systemImage: String
    let color: Color

    init(title: LocalizedStringResource, systemImage: String, color: Color) {
        self.title = Text(title); self.systemImage = systemImage; self.color = color
    }

    init(verbatimTitle: String, systemImage: String, color: Color) {
        title = Text(verbatim: verbatimTitle); self.systemImage = systemImage; self.color = color
    }

    var body: some View {
        Label { title } icon: { Image(systemName: systemImage) }
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color.opacity(0.12), in: Capsule())
            .accessibilityElement(children: .combine)
    }
}

struct WorkflowSyncLine: View {
    let workflow: WorkflowState
    let sync: SyncState

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: FieldTheme.s) {
                StatusPill(title: workflow.title, systemImage: workflow.icon, color: workflow.color)
                StatusPill(title: sync.title, systemImage: sync.icon, color: sync.color)
            }
            VStack(alignment: .leading, spacing: FieldTheme.s) {
                StatusPill(title: workflow.title, systemImage: workflow.icon, color: workflow.color)
                StatusPill(title: sync.title, systemImage: sync.icon, color: sync.color)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NoticeBanner: View {
    let title: LocalizedStringResource
    let message: Text
    let systemImage: String
    var color = FieldTheme.goldenrod

    init(title: LocalizedStringResource, message: LocalizedStringResource, systemImage: String, color: Color = FieldTheme.goldenrod) {
        self.title = title; self.message = Text(message); self.systemImage = systemImage; self.color = color
    }

    init(title: LocalizedStringResource, verbatimMessage: String, systemImage: String, color: Color = FieldTheme.goldenrod) {
        self.title = title; message = Text(verbatim: verbatimMessage); self.systemImage = systemImage; self.color = color
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(title).font(.headline)
                message.font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(FieldTheme.m)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

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
        VStack(spacing: 8) {
            if keyboardVisible {
                if let onDismissKeyboard {
                    KeyboardControlsRow(onNextField: onNextField, onDone: onDismissKeyboard)
                }
            } else {
                // Progress returns when the keyboard closes. At accessibility sizes the save note is
                // dropped so the bar stays compact; the step count remains.
                HStack {
                    if !dynamicTypeSize.isAccessibilitySize {
                        Label { Text(saveText) } icon: { Image(systemName: "checkmark.circle") }
                            .font(.caption.weight(.medium))
                            .foregroundStyle(FieldTheme.fern)
                    }
                    Spacer()
                    Text("Step \(step) of \(total)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: Double(step), total: Double(total))
                    .tint(FieldTheme.hemlock)
                    .accessibilityLabel("Step \(step) of \(total)")
            }
            PrimaryActionButton(title: actionTitle, action: action)
                .accessibilityIdentifier("flow.next")
        }
        .trackingKeyboard($keyboardVisible)
        .padding(.horizontal, FieldTheme.m)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }
}

struct KeyValueRow: View {
    let label: LocalizedStringResource
    let value: String
    var emphasized = false

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.xs) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(value)
                .font(emphasized ? .title3.bold() : .body)
                .monospacedDigit()
                .multilineTextAlignment(.leading)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, FieldTheme.s)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    func fieldScreen() -> some View {
        scrollContentBackground(.hidden)
            .background(FieldTheme.limestone.ignoresSafeArea())
            .tint(FieldTheme.hemlock)
    }
}
