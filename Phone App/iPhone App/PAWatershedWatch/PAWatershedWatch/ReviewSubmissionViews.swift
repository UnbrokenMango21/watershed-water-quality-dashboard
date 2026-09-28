import SwiftUI

// MARK: - Review

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

/// Step 6: a scannable summary in the order the observation was collected, with every blocking issue
/// listed at once and non-blocking warnings kept visually separate.
struct ReviewContent: View {
    let model: AppModel
    let draft: ObservationDraft
    @State private var confirmSubmit = false

    var body: some View {
        let issues = draft.blockingIssues
        let warnings = draft.reviewWarnings
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.m) {
                ReadinessCard(issues: issues, warnings: warnings, onFix: fix)
                if let error = model.workflowError, issues.isEmpty {
                    NoticeBanner(title: "Not Submitted", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", tone: .error)
                }
                ReviewCard(title: "Site", systemImage: "mappin.and.ellipse", edit: { edit(.selectSite, step: 1) }) {
                    if let site = draft.site {
                        Text(site.name).font(.headline)
                        if !site.subtitle.isEmpty || !site.code.isEmpty {
                            Text([site.code, site.subtitle].filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                        }
                    } else {
                        MissingValue("No site selected")
                    }
                }
                ReviewCard(title: "Date and time", systemImage: "calendar", edit: { edit(.visitDetails, step: 2) }) {
                    Text(draft.date.fieldTimestamp).font(.headline).monospacedDigit()
                    Text("Pennsylvania time (Eastern)").font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                }
                ReviewCard(title: "Location", systemImage: "location", edit: { edit(.visitDetails, step: 2) }) {
                    if let latitude = draft.latitude, let longitude = draft.longitude {
                        Text(Self.coordinates(latitude, longitude)).font(.headline).monospacedDigit()
                        HStack(spacing: FieldTheme.s) {
                            if let accuracy = draft.accuracyMeters {
                                Text("±\(Int(accuracy.rounded())) m accuracy")
                            }
                            if let distance = draft.siteDistanceMeters {
                                Text("·")
                                Text("\(Site.distanceText(distance)) from site")
                            }
                        }
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.inkMuted)
                    } else {
                        MissingValue("No GPS position captured")
                    }
                }
                ReviewCard(title: "Method", systemImage: "testtube.2", edit: { edit(.testMethod, step: 3) }) {
                    if let type = draft.testType {
                        Text(type.title).font(.headline)
                        if type == .other && !draft.testTypeOther.isEmpty {
                            Text(verbatim: draft.testTypeOther).font(.subheadline)
                        }
                        ReviewDetailRow(label: type.sourceLabel, value: draft.instrument)
                        ReviewDetailRow(label: type.methodLabel, value: draft.method)
                    } else {
                        MissingValue("Measurement method not chosen")
                    }
                }
                ReviewCard(title: "Measurements", systemImage: "gauge.with.dots.needle.33percent", edit: { edit(.measurements, step: 4) }) {
                    let entered = MeasurementKind.allCases.filter { !draft[valueFor: $0].trimmingCharacters(in: .whitespaces).isEmpty }
                    if entered.isEmpty {
                        MissingValue("No measurements entered")
                    } else {
                        VStack(spacing: 0) {
                            ForEach(entered) { kind in
                                ReviewMeasurementRow(
                                    kind: kind,
                                    value: draft[valueFor: kind],
                                    unit: draft.selectedUnit(for: kind),
                                    conversion: kind == .temperature ? draft.temperatureConversion : nil,
                                    isRequired: draft.requiredMeasurements.contains(kind),
                                    problem: draft.measurementProblem(for: kind)
                                )
                                if kind != entered.last { CardDivider() }
                            }
                        }
                    }
                }
                ReviewCard(title: "Field notes", systemImage: "note.text", edit: { edit(.media, step: 5) }) {
                    if draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("None").foregroundStyle(FieldTheme.inkMuted)
                    } else {
                        Text(verbatim: draft.notes).font(.body)
                    }
                }
                ReviewCard(title: "Collector", systemImage: "person.crop.circle", edit: nil) {
                    Text(verbatim: draft.collector).font(.headline)
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.m)
        }
        .fieldScreen()
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            ActionShelf {
                HStack {
                    Label(issues.isEmpty ? "Ready to submit" : "\(issues.count) item(s) to fix", systemImage: issues.isEmpty ? "checkmark.circle" : "exclamationmark.circle")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(issues.isEmpty ? FieldTheme.fern : FieldTheme.alert)
                    Spacer()
                    Text("Step 6 of 6").font(.footnote.weight(.semibold)).foregroundStyle(FieldTheme.inkMuted).monospacedDigit()
                }
                StepProgressBar(step: 6, total: 6)
                PrimaryActionButton(title: "Submit Observation", systemImage: "paperplane.fill", isEnabled: issues.isEmpty) {
                    confirmSubmit = true
                }
                .accessibilityIdentifier("review.submit")
            }
        }
        .alert("Submit this observation?", isPresented: $confirmSubmit) {
            Button("Submit") { model.submitDraft() }
            Button("Keep Reviewing", role: .cancel) { }
        } message: {
            Text(model.connection == .online
                 ? "Revision \(draft.revisionNumber) will be locked and sent to the archive for validation and review."
                 : "Revision \(draft.revisionNumber) will be locked and saved on this phone. It will sync when you are back online.")
        }
    }

    private func edit(_ route: HomeRoute, step: Int) {
        model.workflowError = nil
        draft.currentStep = step
        model.homePath.append(route)
    }

    private func fix(_ issue: ReviewIssue) {
        if let section = issue.section {
            model.present(.invalid(issue.message, section: section, measurement: issue.measurement))
        } else if issue.id == "site" {
            edit(.selectSite, step: 1)
        }
    }

    static func coordinates(_ latitude: Double, _ longitude: Double) -> String {
        "\(abs(latitude).formatted(.number.precision(.fractionLength(5))))° \(latitude >= 0 ? "N" : "S"), \(abs(longitude).formatted(.number.precision(.fractionLength(5))))° \(longitude >= 0 ? "E" : "W")"
    }
}

/// Summary of submission readiness. Blocking issues and warnings use different icons and wording as
/// well as color, so the distinction never depends on color alone.
private struct ReadinessCard: View {
    let issues: [ReviewIssue]
    let warnings: [ReviewIssue]
    let onFix: (ReviewIssue) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if issues.isEmpty {
                Label("Ready to submit", systemImage: "checkmark.seal.fill")
                    .font(.headline)
                    .foregroundStyle(FieldTheme.fern)
                Text("Check each section below. After you submit, changes are made through a correction revision.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
            } else {
                Label("Must fix before submitting", systemImage: "xmark.octagon.fill")
                    .font(.headline)
                    .foregroundStyle(FieldTheme.alert)
                ForEach(issues) { issue in IssueRow(issue: issue, onFix: onFix) }
            }
            if !warnings.isEmpty {
                CardDivider()
                Label("Worth checking (won't block)", systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FieldTheme.goldenrod)
                ForEach(warnings) { issue in IssueRow(issue: issue, onFix: onFix) }
            }
        }
        .fieldCard(fill: (issues.isEmpty ? StatusTone.success : StatusTone.error).background)
    }
}

private struct IssueRow: View {
    let issue: ReviewIssue
    let onFix: (ReviewIssue) -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: FieldTheme.s) {
            Text(verbatim: issue.message)
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
            if issue.section != nil || issue.id == "site" {
                Button(issue.severity == .blocking ? "Fix" : "Check") { onFix(issue) }
                    .font(.subheadline.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel("\(issue.severity == .blocking ? "Fix" : "Check"): \(issue.message)")
            }
        }
    }
}

struct ReviewCard<Content: View>: View {
    let title: LocalizedStringResource
    let systemImage: String
    let edit: (() -> Void)?
    @ViewBuilder let content: Content

    init(title: LocalizedStringResource, systemImage: String, edit: (() -> Void)?, @ViewBuilder content: () -> Content) {
        self.title = title
        self.systemImage = systemImage
        self.edit = edit
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            HStack {
                Label {
                    Text(title)
                        .font(.footnote.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(0.6)
                        .foregroundStyle(FieldTheme.inkMuted)
                } icon: {
                    Image(systemName: systemImage)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FieldTheme.water)
                }
                .accessibilityAddTraits(.isHeader)
                Spacer()
                if let edit {
                    Button("Edit", action: edit)
                        .font(.subheadline.weight(.semibold))
                        .frame(minWidth: 44, minHeight: 44)
                        .accessibilityLabel(Text("Edit \(String(localized: title))"))
                }
            }
            content
        }
        .padding(.top, -6)
        .fieldCard()
    }
}

private struct ReviewDetailRow: View {
    let label: LocalizedStringResource
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
            Spacer(minLength: FieldTheme.m)
            if value.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("Missing").font(.subheadline.weight(.semibold)).foregroundStyle(FieldTheme.alert)
            } else {
                Text(verbatim: value).font(.subheadline.weight(.semibold)).multilineTextAlignment(.trailing)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ReviewMeasurementRow: View {
    let kind: MeasurementKind
    let value: String
    let unit: MeasurementUnit
    let conversion: String?
    let isRequired: Bool
    let problem: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: FieldTheme.s) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: FieldTheme.xs) {
                    Text(kind.title).font(.subheadline)
                    if isRequired { RequiredMark() }
                }
                if let problem {
                    Label(problem, systemImage: "xmark.octagon.fill").font(.caption.weight(.semibold)).foregroundStyle(FieldTheme.alert)
                }
            }
            Spacer(minLength: FieldTheme.s)
            VStack(alignment: .trailing, spacing: 2) {
                Text(kind == .ph ? value : "\(value) \(unit.inlineSymbol)")
                    .font(.title3.bold().monospacedDigit())
                if let conversion {
                    Text(conversion).font(.caption.monospacedDigit()).foregroundStyle(FieldTheme.inkMuted)
                }
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(String(localized: kind.title)), \(value) \(kind == .ph ? "" : unit.spokenName)\(problem.map { ", error: \($0)" } ?? "")")
    }
}

private struct MissingValue: View {
    let text: LocalizedStringResource
    init(_ text: LocalizedStringResource) { self.text = text }

    var body: some View {
        Label { Text(text) } icon: { Image(systemName: "xmark.octagon.fill") }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(FieldTheme.alert)
    }
}

// MARK: - Status

/// Shown after Submit and after a correction is resubmitted. It follows the record itself, so the
/// words always match what the archive has confirmed.
struct SubmissionStatusView: View {
    let model: AppModel
    let recordID: UUID?
    let fromCorrection: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                if let record = statusRecord {
                    StatusHero(record: record)
                    VStack(alignment: .leading, spacing: FieldTheme.xs) {
                        Text(record.site.name).font(.headline).foregroundStyle(FieldTheme.ink)
                        Text("Revision \(record.revision) · \(record.date.fieldTimestamp)")
                            .font(.subheadline)
                            .foregroundStyle(FieldTheme.inkMuted)
                    }
                    ObservationLifecycleView(workflow: record.workflow, sync: record.sync)
                        .fieldCard()
                    if record.sync == .failed || record.sync == .waiting {
                        PrimaryActionButton(title: "Retry Sync", systemImage: "arrow.clockwise", isEnabled: model.connection == .online) {
                            model.retrySync(recordID: record.id)
                        }
                    }
                } else {
                    ContentUnavailableView("Observation Unavailable", systemImage: "doc.questionmark")
                }
                SecondaryActionButton(title: fromCorrection ? "Back to Observation" : "Done", systemImage: "checkmark") {
                    finish()
                }
                .accessibilityIdentifier("status.done")
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.l)
        }
        .fieldScreen()
        .navigationTitle(fromCorrection ? "Revision Status" : "Submission Status")
        .navigationBarTitleDisplayMode(.inline)
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

private struct StatusHero: View {
    let record: ObservationRecord

    var body: some View {
        HStack(alignment: .top, spacing: FieldTheme.m) {
            Group {
                if record.sync == .syncing {
                    ProgressView()
                } else {
                    Image(systemName: icon).font(.title2.weight(.semibold)).foregroundStyle(color)
                }
            }
            .frame(width: 52, height: 52)
            .background(tileColor, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(title).font(.title2.bold()).foregroundStyle(FieldTheme.ink)
                Text(detail).font(.subheadline).foregroundStyle(FieldTheme.inkMuted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var title: LocalizedStringResource {
        switch record.sync {
        case .savedLocally, .waiting: return "Saved on this phone"
        case .syncing: return "Sending to the archive"
        case .failed: return "Not sent yet"
        case .synced: return record.workflow.title
        }
    }

    private var detail: LocalizedStringResource {
        switch record.sync {
        case .savedLocally, .waiting: return "It is locked and will sync automatically when a connection is available."
        case .syncing: return "Waiting for the archive to confirm receipt."
        case .failed: return "The record is safe on this phone. Retry when you have a connection."
        case .synced:
            switch record.workflow {
            case .submitted, .resubmitted, .validating: return "The archive received this revision. Automated validation runs next."
            case .pendingReview: return "Validation finished. A reviewer on the research team will look at it."
            case .needsCorrection: return "A reviewer asked for a correction. Open the observation to see why."
            case .approved: return "Approved by a reviewer. Approval is not publication; public release happens separately."
            case .rejected: return "A reviewer rejected this revision. It will not be published."
            case .publishing: return "Approved and being published to the public data layer."
            case .publishFailed: return "Approved, but publication did not complete. The program team will retry."
            case .published: return "Published to the public data layer without collector details."
            case .draft: return "Not yet submitted."
            }
        }
    }

    private var icon: String { record.sync == .synced ? record.workflow.icon : record.sync.icon }
    private var color: Color { record.sync == .synced ? record.workflow.color : record.sync.color }
    private var tileColor: Color {
        guard record.sync == .synced else { return record.sync == .failed ? StatusTone.error.background : FieldTheme.surfaceRaised }
        return record.workflow.tone == .neutral ? FieldTheme.surfaceRaised : record.workflow.tone.background
    }
}

/// The path an observation takes, from this phone to public release. Each stage states its own
/// outcome in words; approval and publication are separate stages.
struct ObservationLifecycleView: View {
    let workflow: WorkflowState
    let sync: SyncState

    var body: some View {
        let stages = stages
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(stages.enumerated()), id: \.element.title) { index, stage in
                LifecycleRow(stage: stage, next: index + 1 < stages.count ? stages[index + 1] : nil)
            }
        }
    }

    struct Stage {
        enum State { case done, active, attention, failed, upcoming, skipped }
        let title: String
        let detail: String?
        let state: State
    }

    private var stages: [Stage] {
        let received = sync == .synced
        let validated: Set<WorkflowState> = [.pendingReview, .needsCorrection, .approved, .rejected, .publishing, .publishFailed, .published]
        let reviewed: Set<WorkflowState> = [.approved, .rejected, .publishing, .publishFailed, .published]

        let archiveState: Stage.State = received ? .done : (sync == .failed ? .failed : .active)
        let archiveDetail: String? = sync == .failed ? String(localized: "Sync failed · retry available") : (received ? nil : String(localized: sync.title))

        let validationState: Stage.State = !received ? .upcoming : (validated.contains(workflow) ? .done : .active)

        let reviewDetail: String?
        let reviewState: Stage.State
        switch workflow {
        case .approved, .publishing, .publishFailed, .published: reviewDetail = String(localized: "Approved"); reviewState = .done
        case .rejected: reviewDetail = String(localized: "Rejected"); reviewState = .failed
        case .needsCorrection: reviewDetail = String(localized: "Correction requested"); reviewState = .attention
        case .pendingReview: reviewDetail = String(localized: "Waiting for a reviewer"); reviewState = .active
        default: reviewDetail = nil; reviewState = .upcoming
        }

        let releaseDetail: String?
        let releaseState: Stage.State
        switch workflow {
        case .approved: releaseDetail = String(localized: "Approved, not yet published"); releaseState = .active
        case .publishing: releaseDetail = String(localized: "Publishing"); releaseState = .active
        case .publishFailed: releaseDetail = String(localized: "Publication failed · program team will retry"); releaseState = .failed
        case .published: releaseDetail = String(localized: "Published without collector details"); releaseState = .done
        case .rejected: releaseDetail = String(localized: "Not published"); releaseState = .skipped
        default: releaseDetail = nil; releaseState = .upcoming
        }

        return [
            Stage(title: String(localized: "Saved on this phone"), detail: nil, state: .done),
            Stage(title: String(localized: "Received by the archive"), detail: archiveDetail, state: archiveState),
            Stage(title: String(localized: "Automated validation"), detail: nil, state: validationState),
            Stage(title: String(localized: "QC review"), detail: reviewDetail, state: received ? reviewState : .upcoming),
            Stage(title: String(localized: "Public release"), detail: releaseDetail, state: releaseState),
        ]
    }
}

private struct LifecycleRow: View {
    let stage: ObservationLifecycleView.Stage
    /// The following stage, if any; the connector below this row is drawn solid once that stage has begun.
    let next: ObservationLifecycleView.Stage?
    @ScaledMetric(relativeTo: .title3) private var iconSize: CGFloat = 26

    var body: some View {
        HStack(alignment: .top, spacing: FieldTheme.m) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
                .frame(width: 28, height: iconSize)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(stage.title)
                    .font(.body.weight(stage.state == .upcoming || stage.state == .skipped ? .regular : .semibold))
                    .foregroundStyle(stage.state == .upcoming || stage.state == .skipped ? FieldTheme.inkMuted : FieldTheme.ink)
                if let detail = stage.detail {
                    Text(detail).font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                }
            }
            .padding(.bottom, next == nil ? 0 : 18)
            Spacer(minLength: 0)
        }
        .overlay(alignment: .topLeading) {
            if next != nil {
                Rectangle()
                    .fill(connectorColor)
                    .frame(width: 2)
                    .padding(.top, iconSize + 2)
                    // Runs into the next row so the rail reads as one continuous line.
                    .padding(.bottom, -2)
                    .padding(.leading, 13)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(Text(stateLabel))
    }

    private var icon: String {
        switch stage.state {
        case .done: "checkmark.circle.fill"
        case .active: "circle.dotted.circle"
        case .attention: "exclamationmark.bubble.fill"
        case .failed: "xmark.octagon.fill"
        case .upcoming: "circle"
        case .skipped: "minus.circle"
        }
    }

    private var color: Color {
        switch stage.state {
        case .done: FieldTheme.fern
        case .active: FieldTheme.water
        case .attention: FieldTheme.goldenrod
        case .failed: FieldTheme.alert
        case .upcoming, .skipped: FieldTheme.lineInput
        }
    }

    private var connectorColor: Color {
        guard let next, stage.state == .done else { return FieldTheme.line }
        return next.state == .upcoming || next.state == .skipped ? FieldTheme.line : FieldTheme.fern
    }

    private var stateLabel: LocalizedStringResource {
        switch stage.state {
        case .done: "Complete"
        case .active: "In progress"
        case .attention: "Needs your attention"
        case .failed: "Did not complete"
        case .upcoming: "Not started"
        case .skipped: "Not applicable"
        }
    }
}
