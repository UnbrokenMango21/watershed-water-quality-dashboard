import SwiftUI

struct HomeView: View {
    let model: AppModel
    @State private var confirmNewObservation = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.l) {
                HomeFieldHeader(name: model.userDisplayName, cachedSiteCount: model.sites.count)
                if model.connection != .online {
                    ConnectionBanner(connection: model.connection)
                }
                StartObservationPanel {
                    if model.draft == nil {
                        model.startNewObservation()
                    } else {
                        confirmNewObservation = true
                    }
                }
                if let draft = model.draft, model.workflowState == .draft {
                    ResumeDraftPanel(draft: draft, action: model.resumeObservation)
                }
                if model.records.contains(where: AttentionPanel.needsAttention) {
                    AttentionPanel(model: model)
                }
                RecentPreview(model: model)
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.top, FieldTheme.s)
            .padding(.bottom, FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("PA Watershed Watch")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { AccountToolbarButton(model: model) }
        .alert("Start New Observation?", isPresented: $confirmNewObservation) {
            Button("Resume Current Draft") { model.resumeObservation() }
            Button("Discard Draft and Start New", role: .destructive) { model.startNewObservation() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Current draft will be removed from this phone.")
        }
    }
}


struct HomeFieldHeader: View {
    let name: String
    let cachedSiteCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.xs) {
            Text(name.isEmpty ? "Field Researcher" : name)
                .font(.title2.bold())
                .foregroundStyle(FieldTheme.ink)
            Text(cachedSiteCount == 0 ? "No sites available yet" : "\(cachedSiteCount) site\(cachedSiteCount == 1 ? "" : "s") available")
                .font(.subheadline)
                .foregroundStyle(FieldTheme.inkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct ConnectionBanner: View {
    let connection: ConnectionState

    var body: some View {
        switch connection {
        case .offline:
            StatusPill(title: "Offline", systemImage: "wifi.slash", tone: .warning)
        case .serverUnavailable:
            StatusPill(title: "Archive Unavailable", systemImage: "exclamationmark.icloud", tone: .error)
        case .online:
            EmptyView()
        }
    }
}

struct StartObservationPanel: View {
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Button(action: action) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: FieldTheme.m) {
                        HStack {
                            actionIcon
                            Spacer()
                            arrow
                        }
                        Text("Start New Observation")
                            .font(.title.bold())
                    }
                } else {
                    HStack(spacing: FieldTheme.m) {
                        actionIcon
                        Text("Start New Observation")
                            .font(.title3.bold())
                        Spacer()
                        arrow
                    }
                }
            }
            .foregroundStyle(FieldTheme.onPrimary)
            .padding(FieldTheme.m)
            .frame(minHeight: 88)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.hemlock, in: RoundedRectangle(cornerRadius: FieldTheme.radiusL, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: FieldTheme.radiusL, style: .continuous))
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Start New Observation")
    }

    /// The plus sits on a tile with the goldenrod monitoring point from the mark in its corner.
    private var actionIcon: some View {
        Image(systemName: "plus")
            .font(.title2.bold())
            .frame(width: 52, height: 52)
            .background(FieldTheme.onPrimary.opacity(0.14), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            .overlay(alignment: .topTrailing) {
                Circle().fill(FieldTheme.goldGraphic).frame(width: 8, height: 8).offset(x: -6, y: 6)
            }
    }

    private var arrow: some View {
        Image(systemName: "arrow.right")
            .font(.headline)
    }
}

struct ResumeDraftPanel: View {
    let draft: ObservationDraft
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Eyebrow("In progress")
                Spacer()
                WorkflowPill(state: .draft)
            }
            Text(draft.site?.name ?? String(localized: "Site Not Selected"))
                .font(.headline)
                .foregroundStyle(FieldTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
            StepProgressBar(step: draft.currentStep, total: 6)
            HStack {
                Text("Step \(draft.currentStep) of 6")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
                    .monospacedDigit()
                Spacer()
                Button(action: action) {
                    Text("Resume")
                        .font(.headline)
                        .foregroundStyle(FieldTheme.onPrimary)
                        .padding(.horizontal, 20)
                        .frame(minWidth: 96, minHeight: 44)
                        .background(FieldTheme.hemlock, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                }
                .buttonStyle(PressableStyle())
            }
        }
        .fieldCard()
    }
}

/// Observations that need the collector: a reviewer's correction request first, then anything the
/// archive has not confirmed yet.
struct AttentionPanel: View {
    let model: AppModel

    static func needsAttention(_ record: ObservationRecord) -> Bool {
        record.workflow == .needsCorrection || record.sync == .failed || record.sync == .waiting
    }

    var body: some View {
        let items = Array(model.records.filter(Self.needsAttention)
            .sorted { ($0.workflow == .needsCorrection ? 0 : 1) < ($1.workflow == .needsCorrection ? 0 : 1) }
            .prefix(3))
        VStack(alignment: .leading, spacing: 12) {
            FieldSectionHeader(title: "Needs Your Attention")
            VStack(spacing: 0) {
                ForEach(items) { record in
                    let correction = record.workflow == .needsCorrection
                    Button {
                        model.selectedTab = .recent
                        model.recentPath = [.detail(record.id)]
                    } label: {
                        HStack(spacing: 12) {
                            Group {
                                if correction {
                                    Image(systemName: record.workflow.icon)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(record.workflow.tone.foreground)
                                } else {
                                    SyncGlyph(state: record.sync)
                                }
                            }
                            .frame(width: 32, height: 32)
                            .background(correction ? record.workflow.tone.background : FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                            .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.site.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(FieldTheme.ink)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(correction ? "Correction requested for revision \(record.revision)" : String(localized: record.sync.title))
                                    .font(.footnote)
                                    .foregroundStyle(correction ? FieldTheme.alert : FieldTheme.inkMuted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(FieldTheme.lineStrong).accessibilityHidden(true)
                        }
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: 52)
                    .accessibilityElement(children: .combine)
                    if record.id != items.last?.id { CardDivider() }
                }
            }
        }
        .fieldCard()
    }
}

struct RecentPreview: View {
    let model: AppModel

    var body: some View {
        let records = Array(model.records.prefix(2))
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            HStack(alignment: .firstTextBaseline) {
                FieldSectionHeader(title: "Recent Observations")
                if !model.records.isEmpty {
                    Button("See All") { model.selectedTab = .recent }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
            if model.records.isEmpty {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "tray")
                        .font(.title3)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .frame(width: 32)
                        .accessibilityHidden(true)
                    Text("Observations you submit appear here with their review status.")
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .fieldCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(records) { record in
                        Button {
                            model.selectedTab = .recent
                            model.recentPath = [.detail(record.id)]
                        } label: {
                            ObservationCompactRow(record: record)
                        }
                        .buttonStyle(.plain)
                        if record.id != records.last?.id { CardDivider() }
                    }
                }
                .fieldCard(padding: 0)
            }
        }
    }
}

struct ObservationCompactRow: View {
    let record: ObservationRecord

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 2) {
                Text(record.date, format: .dateTime.day())
                    .font(.title3.bold())
                    .monospacedDigit()
                Text(record.date, format: .dateTime.month(.abbreviated))
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(FieldTheme.inkMuted)
            }
            .foregroundStyle(FieldTheme.ink)
            .frame(width: 48, height: 52)
            .background(FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(record.site.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(FieldTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
            }
            Spacer(minLength: FieldTheme.xs)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(FieldTheme.lineStrong)
                .padding(.top, 17)
                .accessibilityHidden(true)
        }
        .padding(FieldTheme.m)
        .contentShape(Rectangle())
    }
}
