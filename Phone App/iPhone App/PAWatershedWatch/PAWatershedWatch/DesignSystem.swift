import SwiftUI

enum FieldTheme {
    static let hemlock = Color(light: 0x0D5C4B, dark: 0x63D3B3)
    static let water = Color(light: 0x167A8B, dark: 0x6BC9D5)
    static let goldenrod = Color(light: 0xA76100, dark: 0xF3B65C)
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
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(FieldTheme.hemlock)
            Image(systemName: "water.waves")
                .font(.system(size: size * 0.42, weight: .medium))
                .foregroundStyle(Color(uiColor: .systemBackground))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct FieldSectionHeader: View {
    let title: LocalizedStringResource
    var detail: LocalizedStringResource?

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.xs) {
            Text(title)
                .font(.headline)
                .foregroundStyle(FieldTheme.ink)
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

struct FlowFooter: View {
    let step: Int
    let total: Int
    let actionTitle: LocalizedStringResource
    var saveText: LocalizedStringResource = "Saved"
    let action: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Label(saveText, systemImage: "checkmark.circle")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(FieldTheme.fern)
                Spacer()
                Text("Step \(step) of \(total)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: Double(step), total: Double(total))
                .tint(FieldTheme.hemlock)
            PrimaryActionButton(title: actionTitle, action: action)
        }
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
