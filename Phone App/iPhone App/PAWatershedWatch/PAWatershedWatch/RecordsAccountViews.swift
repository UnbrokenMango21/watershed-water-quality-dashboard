import SwiftUI

struct RecentObservationsView: View {
    let model: AppModel
    @State private var filter: ObservationFilter = .all
    @State private var searchText = ""

    var body: some View {
        let visibleRecords = model.records.filter { record in
            let matchesFilter = switch filter {
            case .all: true
            case .attention: record.workflow == .needsCorrection || record.sync == .failed
            case .onDevice: record.sync != .synced
            }
            let matchesSearch = searchText.isEmpty || record.site.name.localizedStandardContains(searchText) || record.site.county.localizedStandardContains(searchText)
            return matchesFilter && matchesSearch
        }
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.m) {
                if model.connection == .offline {
                    StatusPill(title: "Cached Records", systemImage: "internaldrive.fill", color: FieldTheme.water)
                }
                ObservationFilterControl(filter: $filter)
                if visibleRecords.isEmpty {
                    ContentUnavailableView {
                        Label("No Observations", systemImage: "drop.circle")
                    } description: {
                        Text(filter == .all ? "Start a field observation from Home." : "No records match this filter.")
                    }
                    .padding(.vertical, 64)
                } else {
                    ForEach(visibleRecords) { record in
                        Button { model.recentPath.append(.detail(record.id)) } label: {
                            ObservationRecordRow(record: record)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.top, FieldTheme.s)
            .padding(.bottom, FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("Recent Observations")
        .searchable(text: $searchText, prompt: "Site or County")
        .refreshable {
            guard model.connection == .online else { return }
            try? await Task.sleep(for: .milliseconds(700))
        }
    }
}

enum ObservationFilter: String, CaseIterable, Identifiable {
    case all = "All", attention = "Attention", onDevice = "On Device"
    var id: Self { self }
}

struct ObservationFilterControl: View {
    @Binding var filter: ObservationFilter

    var body: some View {
        Picker("Observation Filter", selection: $filter) {
            ForEach(ObservationFilter.allCases) { filter in Text(filter.rawValue).tag(filter) }
        }
        .pickerStyle(.segmented)
    }
}

struct ObservationRecordRow: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: record.testType.icon)
                    .font(.title3)
                    .foregroundStyle(FieldTheme.hemlock)
                    .frame(width: 44, height: 44)
                    .background(FieldTheme.hemlock.opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.site.name)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(record.date.fieldTimestamp)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: FieldTheme.xs)
                Image(systemName: "chevron.right").foregroundStyle(.tertiary).padding(.top, 12)
            }
            WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .contentShape(Rectangle())
    }
}

struct ObservationDetailView: View {
    let model: AppModel
    let recordID: UUID

    var body: some View {
        if let record = model.record(id: recordID) {
            ObservationDetailContent(model: model, record: record)
        } else {
            ContentUnavailableView("Observation Unavailable", systemImage: "doc.questionmark")
        }
    }
}

struct ObservationDetailContent: View {
    let model: AppModel
    let record: ObservationRecord

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.xl) {
                ObservationDetailHeader(record: record)
                if let reason = record.correctionReason, record.workflow == .needsCorrection {
                    CorrectionRequestPanel(reason: reason)
                }
                if record.sync == .failed {
                    SyncFailurePanel(connection: model.connection) { model.retrySync(recordID: record.id) }
                }
                if let validation = record.validation {
                    ValidationReadbackSection(summary: validation, flags: record.validationFlags)
                }
                DetailMeasurementsSection(measurements: record.measurements)
                DetailMethodSection(record: record)
                DetailVisitSection(record: record)
                DetailNotesMediaSection(notes: record.notes, attachments: record.attachments)
                RevisionHistorySection(revisions: record.revisions)
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.top, FieldTheme.s)
            .padding(.bottom, record.workflow == .needsCorrection ? 112 : FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("Observation Detail")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if record.workflow == .needsCorrection && record.sync == .synced {
                VStack(spacing: 8) {
                    PrimaryActionButton(title: "Create Correction Revision", systemImage: "doc.badge.plus") {
                        if model.startCorrection(for: record) {
                            model.recentPath.append(.correction(record.id))
                        }
                    }
                    Text("Revision \(record.revision) Retained")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, FieldTheme.m)
                .padding(.vertical, 8)
                .background(.bar)
                .overlay(alignment: .top) { Divider() }
            }
        }
    }
}

struct ValidationReadbackSection: View {
    let summary: ValidationSummary
    let flags: [ValidationFlag]

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Server Validation")
            HStack(spacing: FieldTheme.l) {
                ValidationCount(label: "Errors", value: summary.errorCount, color: summary.errorCount > 0 ? .red : FieldTheme.fern)
                ValidationCount(label: "Warnings", value: summary.warningCount, color: FieldTheme.goldenrod)
                ValidationCount(label: "Info", value: summary.infoCount, color: FieldTheme.water)
            }
            if let score = summary.overallQualityScore {
                KeyValueRow(label: "Quality Score", value: score.formatted(.number.precision(.fractionLength(0...1))))
            }
            ForEach(flags) { flag in
                VStack(alignment: .leading, spacing: 4) {
                    Text(flag.severity.replacingOccurrences(of: "_", with: " ").localizedCapitalized)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(flag.severity == "ERROR" ? Color.red : FieldTheme.goldenrod)
                    Text(flag.message).font(.subheadline)
                    Text(flag.ruleCode).font(.caption.monospaced()).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if flag.id != flags.last?.id { Divider() }
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct ValidationCount: View {
    let label: LocalizedStringResource
    let value: Int
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value, format: .number).font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ObservationDetailHeader: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Text(record.site.name)
                .font(.title2.bold())
            Text("Revision \(record.revision) · \(record.date.fieldTimestamp)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
        }
    }
}

struct CorrectionRequestPanel: View {
    let reason: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Correction Requested", systemImage: "exclamationmark.bubble.fill")
                .font(.headline)
                .foregroundStyle(FieldTheme.goldenrod)
            Text(reason)
                .font(.body)
        }
        .padding(FieldTheme.m)
        .background(FieldTheme.goldenrod.opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct SyncFailurePanel: View {
    let connection: ConnectionState
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NoticeBanner(title: "Archive Unavailable", message: "Sync failed. Retry available.", systemImage: "exclamationmark.icloud.fill", color: .red)
            Button("Retry Sync", action: retry)
                .font(.headline)
                .buttonStyle(.borderedProminent)
                .frame(minHeight: 48)
                .disabled(connection != .online)
            if connection != .online {
                Text("Offline")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct DetailVisitSection: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Visit")
            KeyValueRow(label: "Position", value: position)
            KeyValueRow(label: "Collected", value: record.date.fieldTimestamp)
            KeyValueRow(label: "Collector", value: record.collector)
        }
    }

    private var position: String {
        guard let latitude = record.latitude, let longitude = record.longitude, let accuracy = record.accuracyMeters else { return "Position unavailable" }
        return "\(abs(latitude).formatted(.number.precision(.fractionLength(5))))° \(latitude >= 0 ? "N" : "S") · \(abs(longitude).formatted(.number.precision(.fractionLength(5))))° \(longitude >= 0 ? "E" : "W") · ±\(accuracy.formatted(.number.precision(.fractionLength(0)))) m"
    }
}

struct DetailMethodSection: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Method")
            KeyValueRow(label: "Test Type", value: String(localized: record.testType.title))
            KeyValueRow(label: "Method", value: record.method)
            if !record.instrument.isEmpty {
                KeyValueRow(label: "Instrument or Lab", value: record.instrument)
            }
        }
    }
}

struct DetailMeasurementsSection: View {
    let measurements: [MeasurementValue]

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Measurements")
            if measurements.isEmpty {
                Text("No Values Recorded").foregroundStyle(.secondary)
            } else {
                ForEach(measurements) { measurement in
                    KeyValueRow(label: measurement.kind.title, value: measurement.displayValue, emphasized: true)
                }
            }
        }
    }
}

struct DetailNotesMediaSection: View {
    let notes: String
    let attachments: [AttachmentRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Notes")
            KeyValueRow(label: "Field Notes", value: notes.isEmpty ? "None" : notes)
            KeyValueRow(label: "Photos", value: attachments.count(where: \.isPhoto).formatted())
            KeyValueRow(label: "Audio Note", value: attachments.contains(where: \.isAudio) ? "Attached" : "None")
        }
    }
}

struct RevisionHistorySection: View {
    let revisions: [RevisionSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            FieldSectionHeader(title: "Revision History")
            ForEach(revisions.reversed()) { revision in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: revision.state.icon)
                        .foregroundStyle(revision.state.color)
                        .frame(width: 30, height: 30)
                        .background(revision.state.color.opacity(0.1), in: Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Revision \(revision.number)\(revision.number == revisions.map(\.number).max() ? " · Current" : "")")
                                .font(.body.bold())
                        }
                        Text("\(revision.date.fieldTimestamp) · \(String(localized: revision.state.title))")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                        Text(revision.note).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

struct CorrectionRevisionView: View {
    let model: AppModel
    let recordID: UUID
    @State private var validationMessage: String?
    @State private var confirmResubmit = false
    @FocusState private var focus: MeasurementKind?
    @FocusState private var revisionNoteFocused: Bool

    var body: some View {
        if let draft = model.draft, let record = model.record(id: recordID) {
            ScrollView {
                VStack(alignment: .leading, spacing: FieldTheme.l) {
                    RevisionIdentityHeader(previousRevision: record.revision)
                    if let reason = draft.correctionReason {
                        CorrectionRequestPanel(reason: reason)
                    }
                    if let message = validationMessage ?? model.workflowError {
                        NoticeBanner(title: "Correction Required", verbatimMessage: message, systemImage: "exclamationmark.circle.fill", color: .red)
                    }
                    OriginalValuePanel(record: record)
                    ForEach(editableKinds(draft: draft, record: record)) { kind in
                        MeasurementEntryRow(kind: kind, isRequired: draft.requiredMeasurements.contains(kind), draft: draft, focused: $focus)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        FieldSectionHeader(title: "Revision Note")
                        @Bindable var draft = draft
                        TextField("Source check and reason for change", text: $draft.revisionNote, axis: .vertical)
                            .lineLimit(5...8)
                            .focused($revisionNoteFocused)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                    }
                    .padding(FieldTheme.m)
                    .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                    PrimaryActionButton(title: "Resubmit Revision \(record.revision + 1)", systemImage: "paperplane.fill") {
                        guard !draft.revisionNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                            validationMessage = "Document what you checked before resubmitting."
                            revisionNoteFocused = true
                            return
                        }
                        do {
                            _ = try draft.canonicalSnapshot()
                        } catch {
                            validationMessage = error.localizedDescription
                            focus = (error as? CanonicalizationError)?.measurement
                                ?? editableKinds(draft: draft, record: record).first { Double(draft[valueFor: $0]) == nil }
                            return
                        }
                        validationMessage = nil
                        confirmResubmit = true
                    }
                    Label("Revision \(record.revision) Retained", systemImage: "lock.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.horizontal, FieldTheme.m)
                .padding(.bottom, FieldTheme.xl)
            }
            .fieldScreen()
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Correction Revision")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    if let next = nextFocus(in: editableKinds(draft: draft, record: record), draft: draft) {
                        Button("Next") { focus = next }
                    }
                    Button("Done") {
                        focus = nil
                        revisionNoteFocused = false
                    }
                }
            }
            .task { await claimPendingFocus() }
            .onChange(of: model.pendingMeasurementFocus) { _, _ in
                Task { await claimPendingFocus() }
            }
            .alert("Resubmit New Revision?", isPresented: $confirmResubmit) {
                Button("Resubmit Revision \(record.revision + 1)") { model.resubmitCorrection(recordID: recordID) }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Revision \(record.revision) remains in the record history.")
            }
        } else {
            MissingDraftView()
        }
    }

    private func editableKinds(draft: ObservationDraft, record: ObservationRecord) -> [MeasurementKind] {
        MeasurementKind.allCases.filter { kind in
            kind.productionSpec.support == .fullySupported && (draft.requiredMeasurements.contains(kind) || record.measurements.contains { $0.kind == kind })
        }
    }

    /// The next editable value still needing an entry, or nil at the last one so only Done remains.
    private func nextFocus(in kinds: [MeasurementKind], draft: ObservationDraft) -> MeasurementKind? {
        guard let current = focus, let index = kinds.firstIndex(of: current) else { return nil }
        return kinds[(index + 1)...].first { Double(draft[valueFor: $0]) == nil }
    }

    /// Opens the keyboard on the field a failed resubmission named.
    private func claimPendingFocus() async {
        guard let kind = model.pendingMeasurementFocus else { return }
        model.pendingMeasurementFocus = nil
        await Task.yield()
        focus = kind
    }
}

struct RevisionIdentityHeader: View {
    let previousRevision: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Correction Revision")
                .font(.headline)
                .foregroundStyle(FieldTheme.water)
            Text("Revision \(previousRevision + 1)")
                .font(.title.bold())
            Text("Based on Revision \(previousRevision)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct OriginalValuePanel: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldSectionHeader(title: "Submitted Revision")
            ForEach(record.measurements) { measurement in
                KeyValueRow(label: measurement.kind.title, value: measurement.displayValue, emphasized: true)
            }
            Label("Revision \(record.revision) Retained", systemImage: "lock.fill")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct AccountView: View {
    let model: AppModel
    @State private var showSignOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    AccountIdentityRow(name: model.userDisplayName, detail: model.userEmail)
                }
                Section("Field Connectivity") {
                    LabeledContent {
                        StatusPill(title: model.connection == .online ? "Online" : "Offline", systemImage: model.connection == .online ? "wifi" : "wifi.slash", color: model.connection == .online ? FieldTheme.fern : FieldTheme.goldenrod)
                    } label: {
                        Label("Connection", systemImage: "antenna.radiowaves.left.and.right")
                    }
                    LabeledContent("Cached Sites", value: model.sites.count.formatted())
                    Text("Drafts and submitted records remain available offline. Sync resumes automatically when a connection returns.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Sync and Storage") {
                    LabeledContent {
                        Text(model.records.filter { $0.sync != .synced }.count, format: .number)
                    } label: {
                        Label("On-Device Queue", systemImage: "internaldrive")
                    }
                    Button {
                        model.retrySync()
                    } label: {
                        Label("Retry Pending Sync", systemImage: "arrow.clockwise")
                    }
                    .disabled(model.connection != .online)
                }
                Section("Field Permissions") {
                    LabeledContent("Location", value: "Asked at Visit Details")
                }
                Section("About") {
                    LabeledContent("App", value: "PA Watershed Watch")
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                }
                Section {
                    Button("Sign Out", role: .destructive) { showSignOut = true }
                }
            }
            .navigationTitle("Account")
            .tint(FieldTheme.hemlock)
            .alert("Sign Out of PA Watershed Watch?", isPresented: $showSignOut) {
                Button("Sign Out", role: .destructive) {
                    model.signOut()
                    model.selectedTab = .home
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Current drafts remain on this phone.")
            }
        }
    }
}

struct AccountIdentityRow: View {
    let name: String
    let detail: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(FieldTheme.hemlock)
            VStack(alignment: .leading, spacing: 4) {
                Text(name.isEmpty ? "Field Researcher" : name).font(.headline)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, FieldTheme.s)
    }
}
