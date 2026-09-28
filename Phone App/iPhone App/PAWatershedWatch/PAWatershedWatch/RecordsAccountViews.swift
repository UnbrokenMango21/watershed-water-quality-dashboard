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
                    StatusPill(title: "Cached Records", systemImage: "internaldrive.fill", tone: .info)
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
        .navigationTitle("Observations")
        .toolbar { AccountToolbarButton(model: model) }
        .searchable(text: $searchText, prompt: "Site or county")
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

/// One record: workflow pill top-right (where it stands in review), sync line at the foot (where the
/// data is). At accessibility text sizes the pill moves down beside the sync line.
struct ObservationRecordRow: View {
    let record: ObservationRecord
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: record.testType.icon)
                    .font(.title3)
                    .foregroundStyle(FieldTheme.hemlock)
                    .frame(width: 44, height: 44)
                    .background(FieldTheme.primarySoft, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.site.name)
                        .font(.headline)
                        .foregroundStyle(FieldTheme.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Revision \(record.revision), \(record.date.fieldTimestamp)")
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !dynamicTypeSize.isAccessibilitySize {
                    WorkflowPill(state: record.workflow)
                }
            }
            CardDivider()
            HStack(spacing: 12) {
                if dynamicTypeSize.isAccessibilitySize {
                    WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
                } else {
                    SyncStatusLabel(state: record.sync)
                }
                Spacer(minLength: FieldTheme.xs)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FieldTheme.lineStrong)
                    .accessibilityHidden(true)
            }
        }
        .fieldCard()
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
                if let reason = record.correctionReason, record.workflow == .rejected {
                    NoticeBanner(title: "Rejected by reviewer", verbatimMessage: reason, systemImage: "xmark.octagon.fill", tone: .error)
                }
                if record.sync == .failed {
                    SyncFailurePanel(connection: model.connection) { model.retrySync(recordID: record.id) }
                }
                ObservationLifecycleView(workflow: record.workflow, sync: record.sync)
                    .fieldCard()
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
            .padding(.bottom, FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("Observation Detail")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if record.workflow == .needsCorrection && record.sync == .synced {
                ActionShelf {
                    PrimaryActionButton(title: "Create Correction Revision", systemImage: "doc.badge.plus") {
                        if model.startCorrection(for: record) {
                            model.recentPath.append(.correction(record.id))
                        }
                    }
                    .accessibilityIdentifier("detail.correct")
                    Label("Revision \(record.revision) Retained", systemImage: "lock.fill")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.inkMuted)
                }
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
            HStack(spacing: FieldTheme.s) {
                ValidationCount(label: "Errors", value: summary.errorCount, tone: .error)
                ValidationCount(label: "Warnings", value: summary.warningCount, tone: .warning)
                ValidationCount(label: "Info", value: summary.infoCount, tone: .info)
            }
            if let score = summary.overallQualityScore {
                KeyValueRow(label: "Quality Score", value: score.formatted(.number.precision(.fractionLength(0...1))))
            }
            ForEach(flags) { flag in
                VStack(alignment: .leading, spacing: 6) {
                    StatusPill(
                        verbatimTitle: flag.severity.replacingOccurrences(of: "_", with: " ").localizedCapitalized,
                        tone: flag.severity == "ERROR" ? .error : (flag.severity == "WARNING" ? .warning : .info)
                    )
                    Text(flag.message).font(.subheadline).foregroundStyle(FieldTheme.ink)
                    Text(flag.ruleCode).font(.caption.monospaced()).foregroundStyle(FieldTheme.inkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if flag.id != flags.last?.id { CardDivider() }
            }
        }
        .fieldCard()
    }
}

/// A count tile. Zero stays neutral; a nonzero count takes its severity tone.
struct ValidationCount: View {
    let label: LocalizedStringResource
    let value: Int
    let tone: StatusTone

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value, format: .number)
                .font(.title3.bold())
                .monospacedDigit()
                .foregroundStyle(value > 0 ? tone.foreground : FieldTheme.inkMuted)
            Text(label).font(.caption).foregroundStyle(FieldTheme.inkMuted)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(value > 0 ? tone.background : FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct ObservationDetailHeader: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Text(record.site.name)
                .font(.title2.bold())
            Text("Revision \(record.revision), \(record.date.fieldTimestamp)")
                .font(.subheadline)
                .foregroundStyle(FieldTheme.inkMuted)
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
                .foregroundStyle(FieldTheme.alert)
            Text(reason)
                .font(.body)
                .foregroundStyle(FieldTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FieldTheme.m)
        .padding(.leading, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(StatusTone.error.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: FieldTheme.radiusM, bottomLeadingRadius: FieldTheme.radiusM, style: .continuous)
                .fill(FieldTheme.alert)
                .frame(width: 4)
        }
        .accessibilityElement(children: .combine)
    }
}

struct SyncFailurePanel: View {
    let connection: ConnectionState
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NoticeBanner(title: "Archive Unavailable", message: "Sync failed. Retry available.", systemImage: "exclamationmark.icloud.fill", tone: .error)
            InlineActionButton(title: "Retry Sync", systemImage: "arrow.clockwise", isEnabled: connection == .online, action: retry)
            if connection != .online {
                Text("Offline")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
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
        .fieldCard()
    }

    private var position: String {
        guard let latitude = record.latitude, let longitude = record.longitude, let accuracy = record.accuracyMeters else { return "Position unavailable" }
        return "\(abs(latitude).formatted(.number.precision(.fractionLength(5))))° \(latitude >= 0 ? "N" : "S"), \(abs(longitude).formatted(.number.precision(.fractionLength(5))))° \(longitude >= 0 ? "E" : "W"), ±\(accuracy.formatted(.number.precision(.fractionLength(0)))) m"
    }
}

struct DetailMethodSection: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Method")
            KeyValueRow(label: "Measured with", value: String(localized: record.testType.title))
            if !record.instrument.isEmpty {
                KeyValueRow(label: record.testType.sourceLabel, value: record.instrument)
            }
            KeyValueRow(label: record.testType.methodLabel, value: record.method)
        }
        .fieldCard()
    }
}

struct DetailMeasurementsSection: View {
    let measurements: [MeasurementValue]

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Measurements")
            if measurements.isEmpty {
                Text("No Values Recorded").foregroundStyle(FieldTheme.inkMuted)
            } else {
                VStack(spacing: 0) {
                    ForEach(measurements) { measurement in
                        KeyValueRow(label: measurement.kind.title, value: measurement.displayValue, emphasized: true)
                        if measurement.id != measurements.last?.id { CardDivider() }
                    }
                }
            }
        }
        .fieldCard()
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
        .fieldCard()
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
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(revision.state.tone.foreground)
                        .frame(width: 32, height: 32)
                        .background(revision.state.tone == .neutral ? FieldTheme.surfaceRaised : revision.state.tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Revision \(revision.number)\(revision.number == revisions.map(\.number).max() ? ", current" : "")")
                                .font(.body.bold())
                        }
                        Text("\(String(localized: revision.state.title)), \(revision.date.fieldTimestamp)")
                            .font(.subheadline)
                            .foregroundStyle(FieldTheme.inkMuted)
                            .monospacedDigit()
                        Text(revision.note).font(.subheadline).foregroundStyle(FieldTheme.ink)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
        .fieldCard()
    }
}

struct CorrectionRevisionView: View {
    let model: AppModel
    let recordID: UUID
    @State private var validationMessage: String?
    @State private var confirmResubmit = false
    @FocusState private var focus: MeasurementKind?
    @FocusState private var revisionNoteFocused: Bool
    @State private var keyboardVisible = false

    var body: some View {
        if let draft = model.draft, let record = model.record(id: recordID) {
            ScrollView {
                VStack(alignment: .leading, spacing: FieldTheme.l) {
                    RevisionIdentityHeader(previousRevision: record.revision)
                    CorrectionRequestPanel(reason: draft.correctionReason ?? String(localized: "A reviewer asked you to check this observation against your field sheet."))
                    if !record.validationFlags.isEmpty {
                        ValidationReadbackSection(summary: record.validation ?? ValidationSummary.derived(from: record.validationFlags), flags: record.validationFlags)
                    }
                    if let message = validationMessage ?? model.workflowError {
                        NoticeBanner(title: "Correction Required", verbatimMessage: message, systemImage: "exclamationmark.circle.fill", tone: .error)
                    }
                    OriginalValuePanel(record: record)
                    ForEach(editableKinds(draft: draft, record: record)) { kind in
                        MeasurementEntryRow(kind: kind, isRequired: draft.requiredMeasurements.contains(kind), draft: draft, focused: $focus)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        FieldSectionHeader(title: "What did you check?", detail: "Required. Saved with Revision \(record.revision + 1) for the reviewer.", isRequired: true)
                        @Bindable var draft = draft
                        TextField("Source check and reason for change", text: $draft.revisionNote, axis: .vertical)
                            .lineLimit(5...8)
                            .focused($revisionNoteFocused)
                            .accessibilityIdentifier("correction.note")
                            .padding(12)
                            .fieldInput(focused: revisionNoteFocused, minHeight: 120)
                    }
                    .fieldCard()
                }
                .padding(.horizontal, FieldTheme.m)
                .padding(.bottom, FieldTheme.xl)
            }
            .fieldScreen()
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Correction Revision")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                ActionShelf {
                    if keyboardVisible {
                        KeyboardControlsRow(
                            onNextField: nextFocus(in: editableKinds(draft: draft, record: record), draft: draft).map { next in { focus = next } },
                            onDone: { focus = nil; revisionNoteFocused = false }
                        )
                    } else {
                        Label("Revision \(record.revision) stays in the record unchanged", systemImage: "lock.fill")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(FieldTheme.inkMuted)
                    }
                    PrimaryActionButton(title: "Resubmit as Revision \(record.revision + 1)", systemImage: "paperplane.fill") {
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
                    .accessibilityIdentifier("correction.resubmit")
                }
                .trackingKeyboard($keyboardVisible)
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
            Eyebrow("Correction")
            Text("Creating Revision \(previousRevision + 1)")
                .font(.title.bold())
                .foregroundStyle(FieldTheme.ink)
            Text("Starts from Revision \(previousRevision), which stays in the history exactly as submitted. Edit only what your source check confirms.")
                .font(.subheadline)
                .foregroundStyle(FieldTheme.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct OriginalValuePanel: View {
    let record: ObservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldSectionHeader(title: "Revision \(record.revision) as submitted")
            ForEach(record.measurements) { measurement in
                KeyValueRow(label: measurement.kind.title, value: measurement.displayValue, emphasized: true)
            }
        }
        .fieldCard(fill: FieldTheme.surfaceRaised)
    }
}
