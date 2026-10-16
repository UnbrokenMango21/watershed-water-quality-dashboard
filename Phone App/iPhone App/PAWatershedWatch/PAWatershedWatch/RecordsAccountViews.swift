import SwiftUI
@preconcurrency import FirebaseAuth
import FirebaseCore
@preconcurrency import FirebaseFirestore

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
                if record.sync == .synced {
                    SubmissionDiscussionSection(model: model, record: record)
                }
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

/// The message kinds a collector can see. Each has its own icon and written label, so the kinds never
/// differ by color alone. Administrative notes live in reviewer-only `internalNotes` and never appear.
enum DiscussionKind: String, CaseIterable {
    case collectorComment = "COLLECTOR_COMMENT"
    case reviewerQuestion = "REVIEWER_QUESTION"
    case correctionRequest = "CORRECTION_REQUEST"
    case reviewDecision = "REVIEW_DECISION"
    case unknown = "UNKNOWN"

    init(raw: String) { self = DiscussionKind(rawValue: raw) ?? .unknown }

    var title: String {
        switch self {
        case .collectorComment: String(localized: "Collector comment")
        case .reviewerQuestion: String(localized: "Reviewer question")
        case .correctionRequest: String(localized: "Request for correction")
        case .reviewDecision: String(localized: "Review decision")
        case .unknown: String(localized: "Message")
        }
    }

    var icon: String {
        switch self {
        case .collectorComment: "person.crop.circle"
        case .reviewerQuestion: "questionmark.bubble.fill"
        case .correctionRequest: "exclamationmark.bubble.fill"
        case .reviewDecision: "seal.fill"
        case .unknown: "bubble.left"
        }
    }

    var tone: StatusTone {
        switch self {
        case .collectorComment, .unknown: .neutral
        case .reviewerQuestion: .info
        case .correctionRequest: .error
        case .reviewDecision: .warning
        }
    }
}

enum DiscussionPresentation {
    static func role(_ raw: String) -> String {
        switch raw {
        case "COLLECTOR": String(localized: "Collector")
        case "QC_REVIEWER": String(localized: "QC reviewer")
        case "ADMIN": String(localized: "Administrator")
        default: String(localized: "Program participant")
        }
    }

    static func decision(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        if let state = WorkflowState.backend(raw) { return String(localized: state.title) }
        return raw.replacingOccurrences(of: "_", with: " ").localizedCapitalized
    }

    /// Which revision a message concerns, as the collector knows it ("Revision 2, current").
    static func revision(_ revisionID: String, revisions: [RevisionSummary], currentRevisionID: UUID) -> String {
        guard let summary = revisions.first(where: { $0.id.uuidString.lowercased() == revisionID.lowercased() }) else {
            return String(localized: "About a revision not stored on this phone")
        }
        return summary.id == currentRevisionID
            ? String(localized: "About Revision \(summary.number), current")
            : String(localized: "About Revision \(summary.number), earlier")
    }
}

/// The `sendSubmissionMessage` request a collector may make, mirroring `profile/discussion.mjs`.
enum DiscussionMessageRequest {
    static let maximumLength = 4000

    static func problem(_ text: String) -> String? {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { return String(localized: "Write a message before sending.") }
        // The server counts JavaScript string length (UTF-16 code units).
        if value.utf16.count > maximumLength { return String(localized: "Keep your message to 4,000 characters or fewer.") }
        if value.unicodeScalars.contains(where: { ($0.value < 0x20 && ![0x09, 0x0a, 0x0d].contains($0.value)) }) {
            return String(localized: "Remove unsupported characters from your message.")
        }
        return nil
    }

    static func payload(submissionID: UUID, revisionID: UUID, messageID: UUID, text: String) -> [String: Any] {
        [
            "submissionId": submissionID.uuidString.lowercased(), "revisionId": revisionID.uuidString.lowercased(),
            "messageId": messageID.uuidString.lowercased(), "kind": DiscussionKind.collectorComment.rawValue,
            "text": text.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
    }
}

private struct DiscussionEntry: Identifiable, Sendable {
    let id: String
    let name: String
    let role: String
    let kind: String
    let text: String
    let revision: String
    let decision: String?
    let date: Date?
}

/// The same private, server-owned conversation used by the QC console and collector website.
/// Messages never edit submitted science or review state. Administrative notes are not queried.
struct SubmissionDiscussionSection: View {
    let model: AppModel
    let record: ObservationRecord
    @State private var entries: [DiscussionEntry] = []
    @State private var listener: ListenerRegistration?
    @State private var loading = true
    @State private var text = ""
    @State private var loadFailure: String?
    @State private var sendFailure: String?
    @State private var sending = false
    @State private var sentNotice = false
    @State private var retryID: UUID?
    @State private var retryText = ""
    @FocusState private var messageFocused: Bool

    private var canStartCorrection: Bool { record.workflow == .needsCorrection && record.sync == .synced }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Discussion and Corrections", detail: "Messages stay with this sampling record. Scientific corrections create a new revision; earlier revisions never change.")
            if loading {
                HStack(spacing: FieldTheme.s) {
                    ProgressView()
                    Text("Loading discussion").font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                }
                .frame(minHeight: 44)
            }
            if let loadFailure {
                NoticeBanner(title: "Discussion Unavailable", verbatimMessage: loadFailure, systemImage: "exclamationmark.triangle.fill", tone: .error)
            }
            if !loading && entries.isEmpty && loadFailure == nil {
                Text("No messages yet. Reviewer questions and correction requests appear here.")
                    .font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
            }
            ForEach(entries) { entry in row(for: entry) }
            CardDivider()
            replyComposer
        }
        .fieldCard()
        .onAppear { listen() }
        .onDisappear { listener?.remove(); listener = nil }
    }

    private var replyComposer: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Text("Reply to reviewers").font(.subheadline.weight(.semibold)).accessibilityHidden(true)
            TextField("Your message about Revision \(record.revision)", text: $text, axis: .vertical)
                .lineLimit(3...8)
                .focused($messageFocused)
                .padding(12)
                .fieldInput(focused: messageFocused, invalid: text.utf16.count > DiscussionMessageRequest.maximumLength, minHeight: 88)
                .accessibilityLabel("Reply to reviewers")
                .accessibilityIdentifier("discussion.message")
            if text.utf16.count > DiscussionMessageRequest.maximumLength {
                Text("Keep your message to 4,000 characters or fewer.").font(.footnote).foregroundStyle(FieldTheme.alert)
            }
            if model.connection != .online {
                Text("Sending needs a connection. Your text stays here until you can send it.")
                    .font(.footnote).foregroundStyle(FieldTheme.inkMuted)
            }
            if let sendFailure {
                NoticeBanner(title: "Message Not Sent", verbatimMessage: sendFailure, systemImage: "exclamationmark.circle.fill", tone: .error)
            } else if sentNotice {
                Label("Message sent", systemImage: "checkmark.circle.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(FieldTheme.fern)
            }
            InlineActionButton(
                title: sending ? "Sending…" : "Send Message", systemImage: "paperplane.fill",
                isEnabled: !sending && model.connection == .online && DiscussionMessageRequest.problem(text) == nil
            ) { Task { await send() } }
            .accessibilityIdentifier("discussion.send")
            Text("Messages do not change your submitted values. To change data, create a correction revision when a reviewer requests one.")
                .font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func row(for entry: DiscussionEntry) -> DiscussionMessageRow {
        let kind = DiscussionKind(raw: entry.kind)
        let isCurrent = entry.revision.lowercased() == record.currentRevisionID.uuidString.lowercased()
        var action: (() -> Void)?
        if kind == .correctionRequest && isCurrent && canStartCorrection {
            action = { startCorrection() }
        }
        return DiscussionMessageRow(
            kind: kind, name: entry.name, role: DiscussionPresentation.role(entry.role),
            text: entry.text, decision: DiscussionPresentation.decision(entry.decision), date: entry.date,
            revision: DiscussionPresentation.revision(entry.revision, revisions: record.revisions, currentRevisionID: record.currentRevisionID),
            onStartCorrection: action
        )
    }

    private func startCorrection() {
        if model.startCorrection(for: record) {
            model.recentPath.append(.correction(record.id))
        }
    }

    private func listen() {
        listener?.remove()
        listener = Firestore.firestore().collection("submissions").document(record.id.uuidString.lowercased())
            .collection("messages").addSnapshotListener { snapshot, error in
                var values: [DiscussionEntry] = []
                for document in snapshot?.documents ?? [] {
                    let data = document.data()
                    values.append(DiscussionEntry(
                        id: document.documentID,
                        name: (data["sender_display_name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? String(localized: "Program participant"),
                        role: data["sender_role"] as? String ?? "", kind: data["kind"] as? String ?? "",
                        text: data["text"] as? String ?? "", revision: data["revision_id"] as? String ?? "",
                        decision: data["decision"] as? String, date: (data["created_at"] as? Timestamp)?.dateValue()
                    ))
                }
                // Oldest first, as the conversation happened; a message still awaiting its server time goes last.
                let loaded = values.sorted { ($0.date ?? .distantFuture) < ($1.date ?? .distantFuture) }
                let unavailable = error != nil
                Task { @MainActor in
                    loading = false
                    if unavailable { loadFailure = String(localized: "Discussion is unavailable. Check your connection and account access.") }
                    else { entries = loaded; loadFailure = nil }
                }
            }
    }

    @MainActor private func send() async {
        if let problem = DiscussionMessageRequest.problem(text) { sendFailure = problem; return }
        guard model.connection == .online else {
            sendFailure = String(localized: "You are offline. Your message is kept here; send it when you have a connection.")
            return
        }
        guard let user = Auth.auth().currentUser else { sendFailure = String(localized: "Sign in again before sending a message."); return }
        sending = true; sendFailure = nil; sentNotice = false
        defer { sending = false }
        // The same message ID is reused while the text is unchanged, so a retry never posts twice.
        if retryID == nil || retryText != text { retryID = UUID(); retryText = text }
        guard let messageID = retryID else { return }
        do {
            try await ProfileCallable.call(
                "sendSubmissionMessage",
                data: DiscussionMessageRequest.payload(submissionID: record.id, revisionID: record.currentRevisionID, messageID: messageID, text: text),
                user: user, timeout: 25
            )
            text = ""; retryID = nil; retryText = ""; sentNotice = true; messageFocused = false
        } catch let failure as CallableFailure {
            sendFailure = failure.localizedDescription
        } catch {
            sendFailure = String(localized: "The message could not be sent. Check your connection and retry; your text is preserved.")
        }
    }
}

/// One message. The kind leads with an icon and written label; a correction request is set apart with
/// an alert bar and, when it concerns the current revision, the button that starts revision N+1.
struct DiscussionMessageRow: View {
    let kind: DiscussionKind
    let name: String
    let role: String
    let text: String
    let decision: String?
    let date: Date?
    let revision: String
    var onStartCorrection: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            VStack(alignment: .leading, spacing: FieldTheme.s) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: kind.icon)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(kind.tone.foreground)
                        .frame(width: 32, height: 32)
                        .background(kind.tone == .neutral ? FieldTheme.surface : kind.tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(kind.title)
                            .font(kind == .correctionRequest ? .headline : .subheadline.weight(.bold))
                            .foregroundStyle(FieldTheme.ink)
                        Text("\(name), \(role)").font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                        if let date {
                            Text(date.fieldTimestamp).font(.footnote).monospacedDigit().foregroundStyle(FieldTheme.inkMuted)
                        }
                    }
                    Spacer(minLength: 0)
                }
                if let decision {
                    Text("Decision: \(decision)").font(.subheadline.weight(.semibold)).foregroundStyle(FieldTheme.ink)
                }
                Text(text)
                    .font(.body)
                    .foregroundStyle(FieldTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                Label(revision, systemImage: "doc.text")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.inkMuted)
            }
            .accessibilityElement(children: .combine)
            if let onStartCorrection {
                PrimaryActionButton(title: "Create Correction Revision", systemImage: "doc.badge.plus", action: onStartCorrection)
                    .accessibilityIdentifier("discussion.correct")
            }
        }
        .padding(12)
        .padding(.leading, kind == .correctionRequest ? 4 : 0)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(kind == .correctionRequest ? StatusTone.error.background : FieldTheme.surfaceRaised, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        .overlay(alignment: .leading) {
            if kind == .correctionRequest {
                UnevenRoundedRectangle(topLeadingRadius: FieldTheme.radiusS, bottomLeadingRadius: FieldTheme.radiusS, style: .continuous)
                    .fill(FieldTheme.alert)
                    .frame(width: 4)
            }
        }
    }
}

private extension String {
    var nilIfBlank: String? { isEmpty ? nil : self }
}
