import SwiftUI

struct ReviewView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            ReviewContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct ReviewContent: View {
    let model: AppModel
    let draft: ObservationDraft

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.xl) {
                if let error = model.workflowError {
                    NoticeBanner(title: "Observation Not Ready", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", color: .red)
                }
                ReviewSummarySection(title: "Measurements", edit: { model.homePath.append(.measurements) }) {
                    if draft.values.values.allSatisfy({ $0.isEmpty }) && (!draft.includesLab || draft.requestedAnalytes.isEmpty) {
                        Text("No Measurements")
                            .foregroundStyle(.red)
                    } else {
                        ForEach(draft.values.keys.sorted(by: { $0.rawValue < $1.rawValue })) { kind in
                            if let value = draft.values[kind], !value.isEmpty {
                                KeyValueRow(label: kind.title, value: draft.displayValue(for: kind), emphasized: true)
                            }
                        }
                        if draft.includesLab && draft.labResultsPending && !draft.requestedAnalytes.isEmpty {
                            KeyValueRow(label: "Lab Analyses", value: draft.requestedAnalytes.map { String(localized: $0.title) }.sorted().formatted())
                            KeyValueRow(label: "Result Status", value: "Pending Lab")
                        }
                    }
                }
                if let type = draft.testType {
                    ReviewSummarySection(title: "Method", edit: { model.homePath.append(.testMethod) }) {
                        KeyValueRow(label: "Test Type", value: String(localized: type.title))
                        if type == .other { KeyValueRow(label: "Other Test Type", value: draft.testTypeOther) }
                        KeyValueRow(label: "Method", value: draft.method)
                        if !draft.instrument.isEmpty {
                            KeyValueRow(label: "Instrument or Lab", value: draft.instrument)
                        }
                    }
                }
                if let site = draft.site {
                    ReviewSummarySection(title: "Visit", edit: { model.homePath.append(.visitDetails) }) {
                        KeyValueRow(label: "Site", value: site.name)
                        KeyValueRow(label: "Position", value: fieldPosition)
                        KeyValueRow(label: "Collected", value: draft.date.fieldTimestamp)
                        KeyValueRow(label: "Collector", value: draft.collector)
                    }
                }
                ReviewSummarySection(title: "Notes and Media", edit: { model.homePath.append(.media) }) {
                    KeyValueRow(label: "Notes", value: draft.notes.isEmpty ? "None" : draft.notes)
                    KeyValueRow(label: "Photos", value: "\(draft.photoCount)")
                    KeyValueRow(label: "Audio Note", value: draft.hasAudio ? "Recorded" : "None")
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.l)
        }
        .fieldScreen()
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 6, total: 6, actionTitle: "Continue to Submit") {
                // Re-run the check every time so the next remaining problem is found, not a cached one.
                if let failure = validationFailure {
                    model.present(failure)
                    return
                }
                model.workflowError = nil
                model.homePath.append(.submit)
            }
        }
    }

    /// The real canonicalization error, kept instead of discarded, so its message and its section reach the collector.
    private var validationFailure: CanonicalizationError? {
        do {
            _ = try draft.canonicalSnapshot()
            return nil
        } catch let error as CanonicalizationError {
            return error
        } catch {
            return .invalid(error.localizedDescription)
        }
    }

    private var fieldPosition: String {
        guard let latitude = draft.latitude, let longitude = draft.longitude, let accuracy = draft.accuracyMeters else { return "Position unavailable" }
        return "\(abs(latitude).formatted(.number.precision(.fractionLength(5))))° \(latitude >= 0 ? "N" : "S") · \(abs(longitude).formatted(.number.precision(.fractionLength(5))))° \(longitude >= 0 ? "E" : "W") · ±\(accuracy.formatted(.number.precision(.fractionLength(0)))) m"
    }
}

struct ReviewSummarySection<Content: View>: View {
    let title: LocalizedStringResource
    let edit: () -> Void
    @ViewBuilder let content: Content

    init(title: LocalizedStringResource, edit: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.title = title
        self.edit = edit
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            HStack {
                Text(title)
                    .font(.title3.bold())
                Spacer()
                Button("Edit", action: edit)
                    .font(.subheadline.bold())
                    .frame(minWidth: 52, minHeight: 44)
            }
            Divider()
            content
        }
    }
}

struct SubmitView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            ScrollView {
                VStack(alignment: .leading, spacing: FieldTheme.xl) {
                    VStack(alignment: .leading, spacing: FieldTheme.s) {
                        Text(draft.site?.name ?? "Observation")
                            .font(.title2.bold())
                        Text("Revision \(draft.revisionNumber)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    VStack(alignment: .leading, spacing: FieldTheme.l) {
                        KeyValueRow(label: "Record State", value: "Draft", emphasized: true)
                        KeyValueRow(label: "Sync", value: "Not Submitted", emphasized: true)
                    }
                    if let error = model.workflowError {
                        NoticeBanner(title: "Cannot Submit Yet", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", color: .red)
                    }
                    SubmissionConnectionPanel(connection: model.connection)
                    PrimaryActionButton(title: "Submit Observation", systemImage: "paperplane.fill", action: model.submitDraft)
                    Label("Revision \(draft.revisionNumber) will be locked after local submission", systemImage: "lock.fill")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.horizontal, FieldTheme.m)
                .padding(.vertical, FieldTheme.l)
            }
            .fieldScreen()
            .navigationTitle("Submit")
            .navigationBarTitleDisplayMode(.inline)
        } else {
            MissingDraftView()
        }
    }

}

struct SubmissionConnectionPanel: View {
    let connection: ConnectionState

    var body: some View {
        switch connection {
        case .online:
            StatusPill(title: "Archive Available", systemImage: "network", color: FieldTheme.fern)
        case .offline:
            StatusPill(title: "Offline", systemImage: "wifi.slash", color: FieldTheme.goldenrod)
        case .serverUnavailable:
            StatusPill(title: "Archive Unavailable", systemImage: "exclamationmark.icloud", color: .red)
        }
    }
}

struct SubmissionStatusView: View {
    let model: AppModel
    let recordID: UUID?
    let fromCorrection: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.xl) {
                SubmissionStatusHero(sync: model.syncState)
                if let record = statusRecord {
                    SubmissionRecordSummary(record: record)
                }
                SubmissionTruthPanel(workflow: model.workflowState, sync: model.syncState)
                SyncProgressTimeline(sync: model.syncState)
                if model.syncState == .failed || model.syncState == .waiting {
                    PrimaryActionButton(title: "Retry Sync", systemImage: "arrow.clockwise") { model.retrySync(recordID: recordID) }
                }
                SecondaryActionButton(title: fromCorrection ? "Return to Observation" : "Done", systemImage: "checkmark") {
                    finish()
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.l)
        }
        .fieldScreen()
        .navigationTitle(fromCorrection ? "Revision Status" : "Submission Status")
        .navigationBarBackButtonHidden()
    }

    private var statusRecord: ObservationRecord? {
        if let recordID { model.record(id: recordID) } else { model.records.first }
    }

    private func finish() {
        if fromCorrection, let recordID {
            model.draft = nil
            model.recentPath = [.detail(recordID)]
        } else {
            model.finishStatus()
        }
    }
}

struct SubmissionStatusHero: View {
    let sync: SyncState

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            HStack(spacing: FieldTheme.m) {
                if sync == .syncing {
                    ProgressView().controlSize(.large).tint(sync.color)
                } else {
                    Image(systemName: sync.icon)
                        .font(.title2)
                        .foregroundStyle(sync.color)
                }
                Text(statusTitle)
                    .font(.title.bold())
            }
            Text(statusDetail)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var statusTitle: LocalizedStringResource {
        switch sync {
        case .savedLocally, .waiting: "Saved on This Phone"
        case .syncing: "Syncing"
        case .synced: "In the Archive"
        case .failed: "Sync Failed"
        }
    }

    private var statusDetail: String {
        switch sync {
        case .savedLocally: "Saved · \(Date.now.formatted(date: .omitted, time: .shortened))"
        case .waiting: "Waiting to Sync"
        case .syncing: "Sending"
        case .synced: "Confirmed · \(Date.now.formatted(date: .omitted, time: .shortened))"
        case .failed: "Retry Available"
        }
    }
}

struct SubmissionRecordSummary: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Text(record.site.name)
                .font(.headline)
            Text("\(record.date.fieldTimestamp) · \(String(localized: record.testType.title))")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct SubmissionTruthPanel: View {
    let workflow: WorkflowState
    let sync: SyncState

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.l) {
            KeyValueRow(label: "Record State", value: String(localized: workflow.title), emphasized: true)
            KeyValueRow(label: "Archive", value: sync == .synced ? "Confirmed" : "Not Confirmed", emphasized: true)
        }
    }
}

struct SyncProgressTimeline: View {
    let sync: SyncState

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Sync")
            SyncTimelineRow(title: "Saved on This Phone", detail: "Saved", complete: true, active: false)
            SyncTimelineRow(title: "Waiting to Sync", detail: sync == .waiting ? "Queued" : nil, complete: sync != .savedLocally, active: sync == .waiting)
            SyncTimelineRow(title: "Syncing", detail: sync == .syncing ? "Sending" : nil, complete: sync == .synced, active: sync == .syncing)
            SyncTimelineRow(title: "Synced", detail: sync == .synced ? "Confirmed" : nil, complete: sync == .synced, active: false)
            if sync == .failed {
                SyncTimelineRow(title: "Sync Failed", detail: "Retry Available", complete: false, active: true, error: true)
            }
        }
    }
}

struct SyncTimelineRow: View {
    let title: LocalizedStringResource
    let detail: LocalizedStringResource?
    let complete: Bool
    let active: Bool
    var error = false

    var body: some View {
        HStack(spacing: FieldTheme.m) {
            Image(systemName: complete ? "checkmark.circle.fill" : (active ? "circle.inset.filled" : "circle"))
                .foregroundStyle(error ? Color.red : (complete ? FieldTheme.fern : (active ? FieldTheme.water : Color.secondary)))
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(title)
                    .font(.body.weight(active ? .semibold : .regular))
                    .foregroundStyle(error ? .red : .primary)
                if let detail {
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if active && !error { ProgressView().controlSize(.small) }
        }
        .accessibilityElement(children: .combine)
    }
}
