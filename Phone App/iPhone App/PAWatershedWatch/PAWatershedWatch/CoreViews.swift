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
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(name.isEmpty ? "Field Researcher" : name)
                    .font(.title2.bold())
                Text(cachedSiteCount == 0 ? "No sites available yet" : "\(cachedSiteCount) site\(cachedSiteCount == 1 ? "" : "s") available")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct ConnectionBanner: View {
    let connection: ConnectionState

    var body: some View {
        switch connection {
        case .offline:
            Label("Offline", systemImage: "wifi.slash")
                .font(.subheadline.bold())
                .foregroundStyle(FieldTheme.goldenrod)
        case .serverUnavailable:
            Label("Archive Unavailable", systemImage: "exclamationmark.icloud")
                .font(.subheadline.bold())
                .foregroundStyle(.red)
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
                            .font(.title2.bold())
                        Spacer()
                        arrow
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(FieldTheme.m)
            .frame(minHeight: 88)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.hemlock, in: RoundedRectangle(cornerRadius: FieldTheme.radiusL, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Start New Observation")
    }

    private var actionIcon: some View {
        Image(systemName: "plus")
            .font(.title2.bold())
            .frame(width: 48, height: 48)
            .background(Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS))
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
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                FieldSectionHeader(title: "In progress")
                StatusPill(title: "Draft", systemImage: "pencil", color: FieldTheme.water)
            }
            if let site = draft.site {
                Text(site.name)
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Site Not Selected")
                    .font(.body.weight(.semibold))
            }
            HStack {
                Text("Step \(draft.currentStep) of 6")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Resume", action: action)
                    .font(.headline)
                    .frame(minWidth: 88, minHeight: 48)
                    .buttonStyle(.borderedProminent)
            }
            ProgressView(value: Double(draft.currentStep), total: 6)
                .tint(FieldTheme.water)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                .stroke(Color(uiColor: .separator), lineWidth: 0.5)
        }
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
        let items = model.records.filter(Self.needsAttention)
            .sorted { ($0.workflow == .needsCorrection ? 0 : 1) < ($1.workflow == .needsCorrection ? 0 : 1) }
        VStack(alignment: .leading, spacing: 12) {
            FieldSectionHeader(title: "Needs Your Attention")
            ForEach(items.prefix(3)) { record in
                let correction = record.workflow == .needsCorrection
                Button {
                    model.selectedTab = .recent
                    model.recentPath = [.detail(record.id)]
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: correction ? record.workflow.icon : record.sync.icon)
                            .foregroundStyle(correction ? record.workflow.color : record.sync.color)
                            .frame(width: 32, height: 32)
                            .background((correction ? record.workflow.color : record.sync.color).opacity(0.1), in: Circle())
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.site.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(correction ? "Correction requested · Revision \(record.revision)" : String(localized: record.sync.title))
                                .font(.caption)
                                .foregroundStyle(correction ? record.workflow.color : record.sync.color)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.tertiary).accessibilityHidden(true)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 52)
                .accessibilityElement(children: .combine)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct RecentPreview: View {
    let model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                FieldSectionHeader(title: "Recent Observations")
                if !model.records.isEmpty {
                    Button("See All") { model.selectedTab = .recent }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
            if model.records.isEmpty {
                Label("Observations you submit appear here with their review status.", systemImage: "tray")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, FieldTheme.s)
            }
            ForEach(model.records.prefix(2)) { record in
                Button {
                    model.selectedTab = .recent
                    model.recentPath = [.detail(record.id)]
                } label: {
                    ObservationCompactRow(record: record)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct ObservationCompactRow: View {
    let record: ObservationRecord

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 4) {
                Text(record.date, format: .dateTime.day())
                    .font(.title3.bold())
                Text(record.date, format: .dateTime.month(.abbreviated))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .frame(width: 46, height: 50)
            .background(FieldTheme.water.opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(record.site.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
            }
            Spacer(minLength: FieldTheme.xs)
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
                .padding(.top, 15)
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
