@preconcurrency import CoreLocation
@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
import SwiftUI
import UIKit

// MARK: - Request model

/// What a collector can propose. Neither kind edits the site catalog: a reviewer decides in the QC
/// Console, and only an approval changes the authoritative site location.
enum SiteProposalKind: String, CaseIterable, Identifiable, Hashable {
    case newSite = "NEW_SITE", coordinateCorrection = "COORDINATE_CORRECTION"
    var id: Self { self }

    var title: LocalizedStringResource {
        switch self {
        case .newSite: "New site"
        case .coordinateCorrection: "Location correction"
        }
    }

    var icon: String {
        switch self {
        case .newSite: "mappin.and.ellipse"
        case .coordinateCorrection: "arrow.triangle.swap"
        }
    }
}

struct ProposalCoordinate: Hashable {
    let latitude: Double
    let longitude: Double

    var display: String {
        let latitudeText = abs(latitude).formatted(.number.precision(.fractionLength(5)))
        let longitudeText = abs(longitude).formatted(.number.precision(.fractionLength(5)))
        return "\(latitudeText)° \(latitude >= 0 ? "N" : "S"), \(longitudeText)° \(longitude >= 0 ? "E" : "W")"
    }

    func distance(to other: ProposalCoordinate) -> CLLocationDistance {
        CLLocation(latitude: latitude, longitude: longitude).distance(from: CLLocation(latitude: other.latitude, longitude: other.longitude))
    }
}

/// A human-readable reason a proposal cannot be sent yet.
struct SiteProposalProblem: LocalizedError, Equatable {
    let message: String
    var errorDescription: String? { message }
}

/// Text rules mirrored from `profile/coordinate_proposals.mjs`: Unicode NFC, trimmed, internal
/// whitespace (including line breaks) collapsed to one space, lengths counted in code points. The
/// server rejects raw control characters, so line breaks typed in the reason are sent as spaces.
enum SiteProposalText {
    static func normalized(_ raw: String) -> String {
        raw.precomposedStringWithCanonicalMapping
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    static func length(_ value: String) -> Int { value.unicodeScalars.count }

    static func hasControlCharacters(_ value: String) -> Bool {
        value.unicodeScalars.contains { $0.value < 0x20 || $0.value == 0x7f }
    }
}

/// A validated proposal, ready to send. Equality is the retry key: an unchanged proposal resends with
/// the same proposal ID so the server treats the retry as the same request.
struct SiteProposalSubmission: Equatable {
    static let reasonLength = 5...1000
    static let siteNameLength = 2...160
    static let maximumAccuracyMeters = 100_000.0

    let kind: SiteProposalKind
    let siteID: String?
    let proposedSiteName: String?
    let latitude: Double
    let longitude: Double
    /// Nil when the device did not report a usable accuracy; the server accepts unknown.
    let gpsAccuracyMeters: Double?
    let reason: String

    var coordinate: ProposalCoordinate { ProposalCoordinate(latitude: latitude, longitude: longitude) }

    static func make(
        kind: SiteProposalKind, siteID: String?, proposedSiteName: String,
        latitude: Double?, longitude: Double?, accuracyMeters: Double?, reason: String
    ) throws -> SiteProposalSubmission {
        var name: String?
        var site: String?
        switch kind {
        case .newSite:
            let value = SiteProposalText.normalized(proposedSiteName)
            guard !SiteProposalText.hasControlCharacters(value) else { throw SiteProposalProblem(message: "Remove unsupported characters from the proposed site name.") }
            guard siteNameLength.contains(SiteProposalText.length(value)) else { throw SiteProposalProblem(message: "Enter a proposed site name of 2 to 160 characters.") }
            name = value
        case .coordinateCorrection:
            guard let siteID, !siteID.isEmpty else { throw SiteProposalProblem(message: "Choose the site whose location you are correcting.") }
            site = siteID
        }
        guard let latitude, let longitude else { throw SiteProposalProblem(message: "Capture your current GPS position first.") }
        guard latitude.isFinite, longitude.isFinite, (-90...90).contains(latitude), (-180...180).contains(longitude),
              !(latitude == 0 && longitude == 0)
        else { throw SiteProposalProblem(message: "The GPS position is not valid. Reacquire GPS and try again.") }
        // A negative or non-finite accuracy is the device saying it does not know: send unknown, never 0.
        let accuracy = accuracyMeters.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        if let accuracy, accuracy > maximumAccuracyMeters {
            throw SiteProposalProblem(message: "GPS accuracy is too poor to propose a location. Reacquire GPS in an open area.")
        }
        let reasonText = SiteProposalText.normalized(reason)
        guard !SiteProposalText.hasControlCharacters(reasonText) else { throw SiteProposalProblem(message: "Remove unsupported characters from the reason.") }
        guard reasonLength.contains(SiteProposalText.length(reasonText)) else { throw SiteProposalProblem(message: "Explain the proposal in 5 to 1,000 characters.") }
        return SiteProposalSubmission(kind: kind, siteID: site, proposedSiteName: name, latitude: latitude, longitude: longitude, gpsAccuracyMeters: accuracy, reason: reasonText)
    }

    /// The exact `proposeSiteCoordinates` request body. A new site never names a site ID (the server
    /// assigns one); a correction never renames a site. Unknown accuracy is JSON null.
    func payload(proposalID: UUID) -> [String: Any] {
        var value: [String: Any] = [
            "proposalId": proposalID.uuidString.lowercased(), "kind": kind.rawValue,
            "latitude": latitude, "longitude": longitude,
            "gpsAccuracyM": gpsAccuracyMeters.map { $0 as Any } ?? NSNull(), "reason": reason,
        ]
        switch kind {
        case .newSite: value["proposedSiteName"] = proposedSiteName
        case .coordinateCorrection: value["siteId"] = siteID
        }
        return value
    }
}

/// Reuses one proposal ID while the collector retries the same proposal, and issues a new one as soon
/// as anything in it changes, so a retry is idempotent and a different proposal is never refused.
struct SiteProposalRetry {
    private(set) var proposalID: UUID?
    private var attempted: SiteProposalSubmission?

    mutating func identifier(for submission: SiteProposalSubmission) -> UUID {
        if let proposalID, attempted == submission { return proposalID }
        let next = UUID()
        proposalID = next
        attempted = submission
        return next
    }

    mutating func reset() { proposalID = nil; attempted = nil }
}

// MARK: - Read model

enum SiteProposalStatus: String, Hashable {
    case pending = "PENDING", approved = "APPROVED", rejected = "REJECTED"

    var title: LocalizedStringResource {
        switch self {
        case .pending: "Pending review"
        case .approved: "Approved"
        case .rejected: "Rejected"
        }
    }

    var icon: String {
        switch self {
        case .pending: "hourglass"
        case .approved: "checkmark.seal.fill"
        case .rejected: "xmark.octagon.fill"
        }
    }

    var tone: StatusTone {
        switch self {
        case .pending: .warning
        case .approved: .success
        case .rejected: .error
        }
    }
}

struct SiteCoordinateProposal: Identifiable, Hashable {
    let id: String
    let kind: SiteProposalKind
    let siteID: String
    let proposedSiteName: String?
    let proposed: ProposalCoordinate
    /// The approved catalog coordinates when the correction was proposed; nil for a new site.
    let original: ProposalCoordinate?
    let accuracyMeters: Double?
    let reason: String
    let status: SiteProposalStatus
    let decisionReason: String?
    let createdAt: Date?
    let decidedAt: Date?

    /// The approved location to compare against: the live catalog entry when this phone has it,
    /// otherwise the approved coordinates recorded with the proposal. Nil for an unapproved new site.
    func currentApproved(in catalog: [Site]) -> ProposalCoordinate? {
        if let site = catalog.first(where: { $0.id == siteID }) {
            return ProposalCoordinate(latitude: site.latitude, longitude: site.longitude)
        }
        return original
    }

    func title(in catalog: [Site]) -> String {
        if let proposedSiteName, !proposedSiteName.isEmpty { return proposedSiteName }
        return catalog.first(where: { $0.id == siteID })?.name ?? String(localized: "Site \(siteID)")
    }
}

/// Decodes one `siteCoordinateProposals` document the collector owns. Malformed documents are skipped
/// rather than shown with invented values.
enum SiteProposalDecoder {
    static func proposal(documentID: String, data: [String: Any]) -> SiteCoordinateProposal? {
        guard let kind = (data["kind"] as? String).flatMap(SiteProposalKind.init(rawValue:)),
              let status = (data["status"] as? String).flatMap(SiteProposalStatus.init(rawValue:)),
              let siteID = data["site_id"] as? String, !siteID.isEmpty,
              let proposed = coordinate(data["proposed_coordinates"])
        else { return nil }
        return SiteCoordinateProposal(
            id: (data["proposal_id"] as? String) ?? documentID, kind: kind, siteID: siteID,
            proposedSiteName: text(data["proposed_site_name"]), proposed: proposed,
            original: coordinate(data["original_coordinates"]), accuracyMeters: number(data["gps_accuracy_m"]),
            reason: text(data["reason"]) ?? "", status: status, decisionReason: text(data["decision_reason"]),
            createdAt: (data["created_at"] as? Timestamp)?.dateValue(), decidedAt: (data["decided_at"] as? Timestamp)?.dateValue()
        )
    }

    /// Newest first; a proposal still waiting for its server timestamp sorts to the top.
    static func sorted(_ values: [SiteCoordinateProposal]) -> [SiteCoordinateProposal] {
        values.sorted { ($0.createdAt ?? .distantFuture) > ($1.createdAt ?? .distantFuture) }
    }

    private static func coordinate(_ value: Any?) -> ProposalCoordinate? {
        guard let map = value as? [String: Any], let latitude = number(map["latitude"]), let longitude = number(map["longitude"]) else { return nil }
        return ProposalCoordinate(latitude: latitude, longitude: longitude)
    }

    private static func number(_ value: Any?) -> Double? {
        switch value {
        case let value as Double: value.isFinite ? value : nil
        case let value as Int: Double(value)
        case let value as NSNumber: value.doubleValue
        default: nil
        }
    }

    private static func text(_ value: Any?) -> String? {
        guard let value = (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

// MARK: - Service

enum SiteProposalService {
    static let collection = "siteCoordinateProposals"
    /// Collectors may read only their own proposals, so every list query filters on this field.
    static let ownerField = "submitted_by_uid"

    @MainActor static func submit(_ submission: SiteProposalSubmission, proposalID: UUID) async throws {
        guard let user = Auth.auth().currentUser else { throw SiteProposalProblem(message: "Sign in again before sending a proposal.") }
        try await ProfileCallable.call("proposeSiteCoordinates", data: submission.payload(proposalID: proposalID), user: user, timeout: 25)
    }

    static func listen(uid: String, onChange: @escaping @MainActor ([SiteCoordinateProposal]?) -> Void) -> ListenerRegistration {
        Firestore.firestore().collection(collection).whereField(ownerField, isEqualTo: uid).addSnapshotListener { snapshot, error in
            let values = error == nil
                ? SiteProposalDecoder.sorted(snapshot?.documents.compactMap { SiteProposalDecoder.proposal(documentID: $0.documentID, data: $0.data()) } ?? [])
                : nil
            Task { @MainActor in onChange(values) }
        }
    }

    static func failureMessage(_ error: Error) -> String {
        if let failure = error as? CallableFailure { return failure.localizedDescription }
        if let problem = error as? SiteProposalProblem { return problem.message }
        if error is URLError { return "The server could not be reached. Your proposal is still here; send it again when you have a connection." }
        return "The proposal could not be sent. Try again."
    }
}

// MARK: - Views

/// Proposed and current approved locations side by side. Each carries its own icon and written label,
/// so the difference never depends on color.
struct ProposalCoordinateComparison: View {
    let proposed: ProposalCoordinate
    let current: ProposalCoordinate?
    let kind: SiteProposalKind
    var accuracyMeters: Double?
    var showsAccuracy = true

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            tile(label: "Proposed", systemImage: "mappin.and.ellipse", value: proposed.display,
                 detail: showsAccuracy ? accuracyText : nil, tone: .info)
            tile(label: "Current approved", systemImage: "checkmark.seal.fill",
                 value: current?.display ?? String(localized: kind == .newSite ? "None yet. This would be a new site." : "Not available on this phone"),
                 detail: nil, tone: .success)
            if let current {
                Text("The proposed point is \(Site.distanceText(proposed.distance(to: current))) from the current approved location.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var accuracyText: String {
        guard let accuracyMeters else { return String(localized: "GPS accuracy unknown") }
        return String(localized: "GPS accuracy ±\(accuracyMeters.formatted(.number.precision(.fractionLength(0)))) m")
    }

    private func tile(label: LocalizedStringResource, systemImage: String, value: String, detail: String?, tone: StatusTone) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(tone.foreground)
                .frame(width: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Eyebrow(label)
                Text(value)
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(FieldTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(detail).font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.background, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous)
                .strokeBorder(tone.foreground.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: tone == .info ? [4, 3] : []))
        }
        .accessibilityElement(children: .combine)
    }
}

/// The collector's own coordinate proposals and their review outcomes.
struct SiteProposalsView: View {
    let model: AppModel
    @State private var proposals: [SiteCoordinateProposal] = []
    @State private var loading = true
    @State private var failure: String?
    @State private var listener: ListenerRegistration?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.m) {
                Text("Propose a missing monitoring site or a better location for an existing one. A reviewer decides; the site list changes only after approval.")
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                NavigationLink {
                    SiteProposalFormView(model: model)
                } label: {
                    Label("New Site Proposal", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .foregroundStyle(FieldTheme.onPrimary)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(FieldTheme.hemlock, in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                }
                .buttonStyle(PressableStyle())
                .accessibilityIdentifier("proposals.new")
                if model.connection != .online {
                    NoticeBanner(title: "Offline", message: "Showing proposals saved from your last connection. Their status may have changed.", systemImage: "wifi.slash")
                }
                if let failure {
                    NoticeBanner(title: "Proposals Unavailable", verbatimMessage: failure, systemImage: "exclamationmark.triangle.fill", tone: .error)
                }
                if loading {
                    HStack(spacing: FieldTheme.s) {
                        ProgressView()
                        Text("Loading your proposals").font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                    }
                    .frame(minHeight: 44)
                } else if proposals.isEmpty && failure == nil {
                    ContentUnavailableView("No Proposals Yet", systemImage: "mappin.slash", description: Text("Proposals you send appear here with their review status."))
                        .padding(.vertical, FieldTheme.l)
                } else {
                    ForEach(proposals) { proposal in
                        SiteProposalCard(proposal: proposal, catalog: model.sites)
                    }
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.m)
        }
        .fieldScreen()
        .navigationTitle("Site Proposals")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: listen)
        .onDisappear { listener?.remove(); listener = nil }
    }

    private func listen() {
        listener?.remove()
        guard let uid = Auth.auth().currentUser?.uid else {
            loading = false; failure = "Sign in again to see your proposals."; return
        }
        listener = SiteProposalService.listen(uid: uid) { values in
            loading = false
            if let values { proposals = values; failure = nil }
            else { failure = "Your proposals could not be loaded. Check your connection and try again." }
        }
    }
}

struct SiteProposalCard: View {
    let proposal: SiteCoordinateProposal
    let catalog: [Site]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Label { Text(proposal.kind.title) } icon: { Image(systemName: proposal.kind.icon) }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(FieldTheme.inkMuted)
                    Text(proposal.title(in: catalog))
                        .font(.headline)
                        .foregroundStyle(FieldTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let date = proposal.createdAt {
                        Text("Sent \(date.fieldTimestamp)").font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                    }
                }
                Spacer(minLength: FieldTheme.s)
                StatusPill(title: proposal.status.title, systemImage: proposal.status.icon, tone: proposal.status.tone)
            }
            ProposalCoordinateComparison(proposed: proposal.proposed, current: proposal.currentApproved(in: catalog), kind: proposal.kind, accuracyMeters: proposal.accuracyMeters)
            if !proposal.reason.isEmpty {
                KeyValueRow(label: "Your reason", value: proposal.reason)
            }
            if let decision = proposal.decisionReason {
                CardDivider()
                VStack(alignment: .leading, spacing: 4) {
                    Label("Reviewer decision", systemImage: proposal.status.icon)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(proposal.status.tone.foreground)
                    Text(decision).font(.body).foregroundStyle(FieldTheme.ink).fixedSize(horizontal: false, vertical: true)
                    if let date = proposal.decidedAt {
                        Text("Decided \(date.fieldTimestamp)").font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                    }
                }
                .accessibilityElement(children: .combine)
            } else if proposal.status == .pending {
                Text("Waiting for a reviewer. The site list has not changed.")
                    .font(.footnote)
                    .foregroundStyle(FieldTheme.inkMuted)
            }
        }
        .fieldCard()
    }
}

/// Sends a new-site or location-correction proposal from the current GPS fix. Nothing is stored on
/// this phone: the proposal goes straight to reviewers, so it needs a connection.
struct SiteProposalFormView: View {
    let model: AppModel
    var initialKind: SiteProposalKind = .newSite
    var initialSiteID: String?
    var presentedAsSheet = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @StateObject private var locator = LocationPermissionRequester()
    @State private var kind: SiteProposalKind = .newSite
    @State private var siteID = ""
    @State private var siteName = ""
    @State private var reason = ""
    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var accuracy: Double?
    @State private var locating = false
    @State private var sending = false
    @State private var message: String?
    @State private var sent = false
    @State private var retry = SiteProposalRetry()
    @State private var configured = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, reason }

    private var selectedSite: Site? { model.sites.first { $0.id == siteID } }
    private var position: ProposalCoordinate? {
        guard let latitude, let longitude else { return nil }
        return ProposalCoordinate(latitude: latitude, longitude: longitude)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                if sent {
                    NoticeBanner(title: "Proposal Sent", message: "Pending review. A reviewer approves or rejects it; the site list changes only after approval. Follow its status in Account > Site Location Proposals.", systemImage: "checkmark.circle.fill", tone: .success)
                        .accessibilityIdentifier("proposal.sent")
                }
                if model.connection != .online {
                    NoticeBanner(title: "Connection Required", message: "Site proposals go straight to reviewers and are not saved on this phone. Reconnect, then send your proposal.", systemImage: "wifi.slash")
                }
                if let message {
                    NoticeBanner(title: "Proposal Not Sent", verbatimMessage: message, systemImage: "exclamationmark.circle.fill", tone: .error)
                        .accessibilityIdentifier("proposal.error")
                }
                kindCard
                positionCard
                if let position {
                    ProposalCoordinateComparison(
                        proposed: position,
                        current: kind == .coordinateCorrection ? selectedSite.map { ProposalCoordinate(latitude: $0.latitude, longitude: $0.longitude) } : nil,
                        kind: kind, accuracyMeters: accuracy
                    )
                }
                reasonCard
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, FieldTheme.m)
            .disabled(sent)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Propose Site Location")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if presentedAsSheet {
                ToolbarItem(placement: .cancellationAction) {
                    Button(sent ? "Close" : "Cancel") { dismiss() }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            ActionShelf {
                if sent {
                    PrimaryActionButton(title: "Done", systemImage: "checkmark") { dismiss() }
                        .accessibilityIdentifier("proposal.done")
                } else {
                    PrimaryActionButton(title: sending ? "Sending…" : "Send Proposal for Review", systemImage: "paperplane.fill", isEnabled: !sending) {
                        Task { await send() }
                    }
                    .accessibilityIdentifier("proposal.send")
                }
            }
        }
        .onAppear {
            guard !configured else { return }
            configured = true
            kind = initialKind
            siteID = initialSiteID ?? ""
            requestLocation()
        }
        .onChange(of: locator.location) { _, location in
            guard let location else { return }
            locating = false
            latitude = location.coordinate.latitude
            longitude = location.coordinate.longitude
            // CoreLocation reports a negative accuracy when it is unknown; keep that as unknown, never 0.
            accuracy = location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil
        }
        .onChange(of: locator.failureMessage) { _, failure in
            if failure != nil { locating = false }
        }
    }

    private var kindCard: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "What are you proposing?", isRequired: true)
            Picker("Proposal type", selection: $kind) {
                ForEach(SiteProposalKind.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(minHeight: 44)
            .accessibilityIdentifier("proposal.kind")
            switch kind {
            case .newSite:
                VStack(alignment: .leading, spacing: FieldTheme.xs) {
                    Text("Proposed site name").font(.subheadline.weight(.semibold))
                    TextField("For example, Spring Creek below the mill", text: $siteName)
                        .textInputAutocapitalization(.words)
                        .focused($focusedField, equals: .name)
                        .padding(.horizontal, 12)
                        .fieldInput(focused: focusedField == .name, minHeight: 48)
                        .accessibilityLabel("Proposed site name")
                        .accessibilityIdentifier("proposal.siteName")
                    Text("2 to 160 characters. Reviewers assign the official name and code.")
                        .font(.footnote).foregroundStyle(FieldTheme.inkMuted)
                }
            case .coordinateCorrection:
                if model.selectableSites.isEmpty {
                    Text(model.connection == .online ? "Loading the current site list…" : "Connect to load the current site list.")
                        .font(.subheadline).foregroundStyle(FieldTheme.inkMuted)
                } else {
                    Picker("Site to correct", selection: $siteID) {
                        Text("Choose a site").tag("")
                        ForEach(model.selectableSites) { Text($0.name).tag($0.id) }
                    }
                    .pickerStyle(.menu)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("proposal.site")
                }
            }
        }
        .fieldCard()
    }

    private var positionCard: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Your current GPS position", detail: "Stand at the place you are proposing.", isRequired: true)
            if locator.status == .denied || locator.status == .restricted {
                NoticeBanner(title: "Location Access Required", message: "Allow location access in Settings to propose a site location.", systemImage: "location.slash.fill", tone: .error)
                InlineActionButton(title: "Open Settings", systemImage: "gear") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
            } else {
                KeyValueRow(label: "Coordinates", value: position?.display ?? (locating ? String(localized: "Locating…") : (locator.failureMessage ?? String(localized: "Position not captured"))), emphasized: true)
                KeyValueRow(label: "GPS accuracy", value: accuracy.map { "±\($0.formatted(.number.precision(.fractionLength(0)))) m" } ?? String(localized: position == nil ? "Not captured" : "Unknown"))
                InlineActionButton(title: locating ? "Locating" : (position == nil ? "Capture GPS" : "Reacquire GPS"), systemImage: "location.viewfinder", isEnabled: !locating && !sent) {
                    requestLocation()
                }
                .accessibilityIdentifier("proposal.gps")
            }
        }
        .fieldCard()
    }

    private var reasonCard: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            FieldSectionHeader(title: "Reason", detail: "Why is this site needed, or what is wrong with the current location?", isRequired: true)
            TextField("Explain your proposal", text: $reason, axis: .vertical)
                .lineLimit(3...8)
                .focused($focusedField, equals: .reason)
                .padding(12)
                .fieldInput(focused: focusedField == .reason, minHeight: 96)
                .accessibilityLabel("Reason")
                .accessibilityIdentifier("proposal.reason")
            let count = SiteProposalText.length(SiteProposalText.normalized(reason))
            Text("\(count) of 1,000 characters, at least 5")
                .font(.footnote.monospacedDigit())
                .foregroundStyle(count > 1000 ? FieldTheme.alert : FieldTheme.inkMuted)
        }
        .fieldCard()
    }

    private func requestLocation() {
        locating = true
        locator.request()
    }

    private func send() async {
        focusedField = nil
        guard model.connection == .online else {
            message = String(localized: "You are offline. Site proposals need a connection and are not saved on this phone. Reconnect, then send again.")
            return
        }
        let submission: SiteProposalSubmission
        do {
            submission = try SiteProposalSubmission.make(
                kind: kind, siteID: siteID, proposedSiteName: siteName,
                latitude: latitude, longitude: longitude, accuracyMeters: accuracy, reason: reason
            )
        } catch {
            message = SiteProposalService.failureMessage(error)
            return
        }
        let proposalID = retry.identifier(for: submission)
        sending = true; message = nil
        defer { sending = false }
        do {
            try await SiteProposalService.submit(submission, proposalID: proposalID)
            retry.reset()
            sent = true
        } catch {
            message = SiteProposalService.failureMessage(error)
        }
    }
}

/// Opens the proposal form from the site picker: a correction for the highlighted site, otherwise a new site.
struct SiteProposalEntryButton: View {
    let model: AppModel
    var selectedSiteID: String?
    @State private var presenting = false

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Text("Site missing, or its location looks wrong?")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldTheme.ink)
            InlineActionButton(title: "Propose a Site Location", systemImage: "mappin.and.ellipse") { presenting = true }
                .accessibilityIdentifier("site.propose")
        }
        .fieldCard()
        .sheet(isPresented: $presenting) {
            NavigationStack {
                SiteProposalFormView(
                    model: model,
                    initialKind: selectedSiteID == nil ? .newSite : .coordinateCorrection,
                    initialSiteID: selectedSiteID,
                    presentedAsSheet: true
                )
            }
            .tint(FieldTheme.hemlock)
        }
    }
}
