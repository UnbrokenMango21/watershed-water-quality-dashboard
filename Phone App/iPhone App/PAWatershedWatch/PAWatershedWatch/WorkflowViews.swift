@preconcurrency import CoreLocation
import SwiftUI
import UIKit

@MainActor
final class LocationPermissionRequester: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var status: CLAuthorizationStatus
    @Published private(set) var location: CLLocation?
    @Published private(set) var failureMessage: String?
    @Published private(set) var isApproximate = false
    private let manager = CLLocationManager()
    private var requestID: UUID?

    override init() {
        status = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func request() {
        status = manager.authorizationStatus
        switch status {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: acquire()
        case .denied, .restricted: failureMessage = "Location access is denied."
        @unknown default: failureMessage = "Location is unavailable."
        }
    }

    // CLLocationManagerDelegate's requirements are nonisolated in CoreLocation (callbacks can
    // arrive off the main thread), so a @MainActor conformance cannot satisfy them directly -
    // each method must itself be nonisolated and hop back to the main actor to touch @Published
    // state.
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        let isApproximate = manager.accuracyAuthorization == .reducedAccuracy
        Task { @MainActor in
            self.status = status
            self.isApproximate = isApproximate
            if status == .authorizedAlways || status == .authorizedWhenInUse { self.acquire() }
            if status == .denied || status == .restricted { self.failureMessage = "Location access is denied." }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let value = locations.last, value.horizontalAccuracy >= 0,
              abs(value.timestamp.timeIntervalSinceNow) <= 30
        else {
            Task { @MainActor in self.failureMessage = "The location reading was stale. Reacquire GPS." }
            return
        }
        Task { @MainActor in
            self.requestID = nil; self.failureMessage = nil; self.location = value
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let message = (error as? CLError)?.code == .locationUnknown
            ? "A field position is not available yet. Reacquire GPS in an open area."
            : "The device could not acquire a field position."
        Task { @MainActor in
            self.requestID = nil
            self.failureMessage = message
        }
    }

    private func acquire() {
        guard CLLocationManager.locationServicesEnabled() else { failureMessage = "Location Services are turned off."; return }
        let id = UUID(); requestID = id; failureMessage = nil; location = nil
        manager.requestLocation()
        Task {
            try? await Task.sleep(for: .seconds(15))
            if requestID == id { requestID = nil; failureMessage = "GPS timed out. Move to an open area and try again." }
        }
    }
}

struct VisitDetailsView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            VisitDetailsContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct VisitDetailsContent: View {
    let model: AppModel
    let draft: ObservationDraft
    @State private var showLocationValidation = false

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                if let error = model.workflowError {
                    NoticeBanner(title: "Fix This to Continue", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", color: .red)
                }
                if let site = draft.site {
                    SelectedSiteHeader(site: site)
                }
                VStack(alignment: .leading, spacing: 12) {
                    FieldSectionHeader(title: "Collected", detail: "Pennsylvania time")
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                        .frame(minHeight: 48)
                    Divider()
                    DatePicker("Time", selection: $draft.date, displayedComponents: .hourAndMinute)
                        .frame(minHeight: 48)
                }
                .padding(FieldTheme.m)
                .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                GPSQualityPanel(draft: draft)
                SiteDistanceNote(draft: draft)
                if showLocationValidation && (draft.latitude == nil || draft.longitude == nil || draft.accuracyMeters == nil) {
                    NoticeBanner(title: "Field Position Required", message: "Capture a current device GPS reading before continuing.", systemImage: "location.slash.fill", color: .red)
                }
                CollectorPanel(name: draft.collector)
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .navigationTitle("Visit Details")
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.timeZone, EasternTime.zone)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 2, total: 6, actionTitle: "Choose Method") {
                guard draft.latitude != nil, draft.longitude != nil, draft.accuracyMeters != nil else {
                    showLocationValidation = true
                    return
                }
                model.advance(to: .testMethod, step: 3)
            }
        }
    }
}

/// Distance from the captured position to the authoritative site. Informational only: the collector
/// cannot move the site, and server validation makes the scored proximity judgment.
struct SiteDistanceNote: View {
    let draft: ObservationDraft

    var body: some View {
        if let distance = draft.siteDistanceMeters {
            let beyond = draft.site?.toleranceMeters.map { distance > $0 } ?? false
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: beyond ? "exclamationmark.triangle.fill" : "scope")
                    .foregroundStyle(beyond ? FieldTheme.goldenrod : FieldTheme.water)
                    .frame(width: 24)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(Site.distanceText(distance)) from the site location")
                        .font(.subheadline.weight(.semibold))
                    if beyond, let tolerance = draft.site?.toleranceMeters {
                        Text("Beyond this site's expected ±\(Int(tolerance)) m. Confirm you are at the selected site, then reacquire GPS if needed.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(FieldTheme.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background((beyond ? FieldTheme.goldenrod : FieldTheme.water).opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .accessibilityElement(children: .combine)
        }
    }
}

struct SelectedSiteHeader: View {
    let site: Site

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            Label("Selected Site", systemImage: "checkmark.circle.fill")
                .font(.subheadline.bold())
                .foregroundStyle(FieldTheme.fern)
            Text(site.name)
                .font(.title3.bold())
            if !site.subtitle.isEmpty {
                Text(site.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct GPSQualityPanel: View {
    let draft: ObservationDraft
    @StateObject private var locationPermission = LocationPermissionRequester()
    @Environment(\.openURL) private var openURL

    var body: some View {
        @Bindable var draft = draft
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                FieldSectionHeader(title: "Position", isRequired: true)
                StatusPill(verbatimTitle: gpsTitle, systemImage: draft.gpsState.icon, color: draft.gpsState.color)
                    .accessibilityLabel("Location quality: \(gpsTitle)")
            }
            if draft.gpsState == .denied {
                NoticeBanner(title: "Location Access Required", message: "Open Settings to capture the field position. Site coordinates cannot replace the observed GPS reading.", systemImage: "location.slash.fill", color: .red)
                Button("Open Settings") { openSettings() }
                    .buttonStyle(.borderedProminent)
                    .frame(minHeight: 48)
            } else {
                KeyValueRow(
                    label: "Coordinates",
                    value: coordinateText,
                    emphasized: true
                )
                Button {
                    requestLocation()
                } label: {
                    Label(draft.gpsState == .locating ? "Reacquiring" : "Reacquire GPS", systemImage: "location.viewfinder")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                .disabled(draft.gpsState == .locating)
            }
            if draft.gpsState == .poor {
                Text(locationPermission.isApproximate ? "Approximate Location is enabled · target ±20 m" : "Target Accuracy · ±20 m")
                    .font(.subheadline.bold())
                    .foregroundStyle(FieldTheme.goldenrod)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .onChange(of: locationPermission.status) { _, status in
            switch status {
            case .authorizedAlways, .authorizedWhenInUse: break
            case .denied, .restricted: draft.gpsState = .denied
            case .notDetermined: break
            @unknown default: draft.gpsState = .unavailable
            }
        }
        .onChange(of: locationPermission.location) { _, location in
            guard let location else { return }
            draft.latitude = location.coordinate.latitude
            draft.longitude = location.coordinate.longitude
            draft.accuracyMeters = location.horizontalAccuracy
            draft.gpsState = location.horizontalAccuracy <= 20 && !locationPermission.isApproximate ? .good : .poor
        }
        .onChange(of: locationPermission.failureMessage) { _, message in
            if message != nil && draft.gpsState != .denied { draft.gpsState = .unavailable }
        }
        .task { if draft.latitude == nil { requestLocation() } }
    }

    private func requestLocation() {
        switch locationPermission.status {
        case .authorizedAlways, .authorizedWhenInUse: reacquire()
        case .notDetermined:
            draft.gpsState = .locating
            locationPermission.request()
        case .denied, .restricted: draft.gpsState = .denied
        @unknown default: draft.gpsState = .denied
        }
    }

    private func reacquire() {
        draft.gpsState = .locating
        locationPermission.request()
    }

    private var gpsTitle: String {
        if let accuracy = draft.accuracyMeters { return "±\(accuracy.formatted(.number.precision(.fractionLength(0)))) m" }
        return String(localized: draft.gpsState.title)
    }

    private var coordinateText: String {
        guard let latitude = draft.latitude, let longitude = draft.longitude else { return locationPermission.failureMessage ?? "Position unavailable" }
        let latitudeText = abs(latitude).formatted(.number.precision(.fractionLength(5)))
        let longitudeText = abs(longitude).formatted(.number.precision(.fractionLength(5)))
        return "\(latitudeText)° \(latitude >= 0 ? "N" : "S") · \(longitudeText)° \(longitude >= 0 ? "E" : "W")"
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
        }
    }
}

struct CollectorPanel: View {
    let name: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldSectionHeader(title: "Collector", detail: "From your account. Change it in Account → Full name.")
            Label(name, systemImage: "person.crop.circle.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(FieldTheme.ink)
                .frame(minHeight: 44)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct TestMethodView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            TestMethodContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct TestMethodContent: View {
    let model: AppModel
    let draft: ObservationDraft
    @State private var showValidation = false
    @FocusState private var focusedField: MethodField?

    enum MethodField: Hashable { case other, method, source }

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                VStack(alignment: .leading, spacing: FieldTheme.xs) {
                    Text("How was this observation measured?")
                        .font(.title2.bold())
                        .foregroundStyle(FieldTheme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("Choose the approach, then record what you used. Enter only what you know.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if showValidation, let issue = methodIssues.first {
                    NoticeBanner(title: "Complete the Method", verbatimMessage: issue, systemImage: "exclamationmark.circle.fill", color: .red)
                } else if let error = model.workflowError {
                    NoticeBanner(title: "Fix This to Continue", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", color: .red)
                }
                TestTypeList(options: typeOptions, selected: draft.testType) { type in
                    draft.testType = type
                    showValidation = false
                }
                if let type = draft.testType {
                    MethodDetailsCard(type: type, draft: draft, suggestions: suggestions(for: type), focusedField: $focusedField, showValidation: showValidation)
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Method")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 3, total: 6, actionTitle: "Enter Measurements", onDismissKeyboard: { focusedField = nil }) {
                guard methodIssues.isEmpty else {
                    showValidation = true
                    focusedField = firstIncompleteField
                    return
                }
                focusedField = nil
                model.advance(to: .measurements, step: 4)
            }
        }
    }

    /// The offered choices, plus a legacy value already on this draft so it is never silently lost.
    private var typeOptions: [TestType] {
        var options = TestType.offeredForNewObservations
        if let current = draft.testType, !options.contains(current) { options.insert(current, at: options.count - 1) }
        return options
    }

    private var methodIssues: [String] {
        draft.blockingIssues.filter { $0.section == .testMethod }.map(\.message)
    }

    private var firstIncompleteField: MethodField? {
        if draft.testType == .other && draft.testTypeOther.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .other }
        if draft.instrument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .source }
        if draft.method.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .method }
        return nil
    }

    /// The collector's own earlier entries for this approach, newest first — never invented defaults.
    private func suggestions(for type: TestType) -> (sources: [String], methods: [String]) {
        let mine = model.records.filter { $0.testType == type }
        func unique(_ values: [String]) -> [String] {
            var seen = Set<String>()
            return values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
                .prefix(3).map { $0 }
        }
        return (unique(mine.map(\.instrument)), unique(mine.map(\.method)))
    }
}

struct TestTypeList: View {
    let options: [TestType]
    let selected: TestType?
    let onSelect: (TestType) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(options) { type in
                Button { onSelect(type) } label: {
                    HStack(spacing: 14) {
                        Image(systemName: type.icon)
                            .font(.title3)
                            .foregroundStyle(selected == type ? FieldTheme.hemlock : FieldTheme.water)
                            .frame(width: 30)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(type.title)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text(type.detail)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .multilineTextAlignment(.leading)
                        Spacer(minLength: FieldTheme.s)
                        Image(systemName: selected == type ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selected == type ? FieldTheme.hemlock : Color(uiColor: .tertiaryLabel))
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 60)
                .accessibilityAddTraits(selected == type ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("method.type.\(type.rawValue)")
                if type != options.last { Divider() }
            }
        }
        .padding(.horizontal, FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

/// The one permanent details section. Both fields are required by the current data contract
/// (`instrument_name`, `method_name`); nothing is pre-filled, and suggestions come only from the
/// collector's own earlier observations.
struct MethodDetailsCard: View {
    let type: TestType
    let draft: ObservationDraft
    let suggestions: (sources: [String], methods: [String])
    let focusedField: FocusState<TestMethodContent.MethodField?>.Binding
    let showValidation: Bool

    var body: some View {
        @Bindable var draft = draft
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            FieldSectionHeader(title: "Method details", detail: "Needed so reviewers can trace how each value was produced.")
            if type == .other {
                MethodField(
                    title: "Describe the approach", prompt: "What kind of measurement was this?",
                    text: $draft.testTypeOther, suggestions: [], missing: showValidation,
                    focus: focusedField, field: .other
                )
            }
            MethodField(
                title: type.sourceLabel, prompt: type.sourcePrompt,
                text: $draft.instrument, suggestions: suggestions.sources, missing: showValidation,
                focus: focusedField, field: .source
            )
            MethodField(
                title: type.methodLabel, prompt: type.methodPrompt,
                text: $draft.method, suggestions: suggestions.methods, missing: showValidation,
                focus: focusedField, field: .method
            )
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

private struct MethodField: View {
    let title: LocalizedStringResource
    let prompt: LocalizedStringResource
    @Binding var text: String
    let suggestions: [String]
    let missing: Bool
    let focus: FocusState<TestMethodContent.MethodField?>.Binding
    let field: TestMethodContent.MethodField

    var body: some View {
        let isEmpty = text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            HStack(spacing: FieldTheme.xs) {
                Text(title).font(.subheadline.weight(.semibold))
                RequiredMark()
            }
            TextField(String(localized: prompt), text: $text, axis: .vertical)
                .lineLimit(1...4)
                .focused(focus, equals: field)
                .padding(14)
                .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous)
                        .stroke(missing && isEmpty ? Color.red : (focus.wrappedValue == field ? FieldTheme.hemlock : .clear), lineWidth: 1.5)
                }
                .accessibilityLabel(Text(title))
                .accessibilityIdentifier("method.\(field)")
            if missing && isEmpty {
                Text("Required").font(.caption.weight(.semibold)).foregroundStyle(.red)
            }
            if isEmpty && !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: FieldTheme.s) {
                        Text("Used before:").font(.caption).foregroundStyle(.secondary)
                        ForEach(suggestions, id: \.self) { value in
                            Button(value) { text = value }
                                .font(.caption.weight(.semibold))
                                .buttonStyle(.bordered)
                                .buttonBorderShape(.capsule)
                                .accessibilityHint("Fills \(String(localized: title)) with your earlier entry")
                        }
                    }
                }
            }
        }
    }
}

struct MeasurementsView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            MeasurementsContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct MeasurementsContent: View {
    let model: AppModel
    let draft: ObservationDraft
    @State private var showValidation = false
    @FocusState private var focusedMeasurement: MeasurementKind?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.l) {
                if showValidation {
                    MeasurementValidationBanner(draft: draft)
                }
                MeasurementGroup(
                    title: "Required Measurements",
                    kinds: draft.requiredMeasurements,
                    draft: draft,
                    focused: $focusedMeasurement,
                    showsProgress: true
                )
                MeasurementGroup(
                    title: "Optional Measurements",
                    kinds: draft.optionalMeasurements,
                    draft: draft,
                    focused: $focusedMeasurement
                )
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Measurements")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(
                step: 4, total: 6, actionTitle: "Notes",
                onDismissKeyboard: { focusedMeasurement = nil },
                onNextField: nextFocusTarget.map { next in { focusedMeasurement = next } }
            ) {
                guard measurementsAreValid else {
                    showValidation = true
                    focusedMeasurement = draft.measurementProblems.first?.kind ?? draft.firstIncompleteRequirement
                    return
                }
                focusedMeasurement = nil
                model.advance(to: .media, step: 5)
            }
        }
        .task { await claimPendingFocus() }
        .onChange(of: model.pendingMeasurementFocus) { _, _ in
            Task { await claimPendingFocus() }
        }
    }

    private var measurementsAreValid: Bool {
        draft.measurementProblems.isEmpty && draft.completedRequiredCount == draft.requiredMeasurements.count
    }

    /// Entry order of the fields the collector can actually type into.
    private var focusOrder: [MeasurementKind] {
        (draft.requiredMeasurements + draft.optionalMeasurements).filter { $0.productionSpec.support == .fullySupported }
    }

    /// The next field still needing a value, or nil at the last one so only Done remains.
    private var nextFocusTarget: MeasurementKind? {
        guard let current = focusedMeasurement, let index = focusOrder.firstIndex(of: current) else { return nil }
        return focusOrder[(index + 1)...].first { Double(draft[valueFor: $0]) == nil }
    }

    /// Opens the keyboard on the field a Review or Submit failure named.
    private func claimPendingFocus() async {
        guard let kind = model.pendingMeasurementFocus else { return }
        model.pendingMeasurementFocus = nil
        showValidation = true
        await Task.yield()
        focusedMeasurement = kind
    }
}

struct MeasurementValidationBanner: View {
    let draft: ObservationDraft

    var body: some View {
        if draft.values.contains(where: { !$0.value.isEmpty && $0.key.productionSpec.support == .featureGated }) {
            NoticeBanner(title: "Clear Unsupported Value", message: "This draft holds a value for a measurement that is not collected in this release. Clear it before continuing.", systemImage: "exclamationmark.circle.fill", color: .red)
        } else if let problem = draft.measurementProblems.first {
            NoticeBanner(title: "Check This Entry", verbatimMessage: problem.message, systemImage: "exclamationmark.circle.fill", color: .red)
        } else {
            NoticeBanner(title: "Measurements Required", message: "Complete all required measurements.", systemImage: "exclamationmark.circle.fill", color: .red)
        }
    }
}

struct MeasurementGroup: View {
    let title: LocalizedStringResource
    let kinds: [MeasurementKind]
    let draft: ObservationDraft
    let focused: FocusState<MeasurementKind?>.Binding
    var showsProgress = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                FieldSectionHeader(title: title, isRequired: showsProgress)
                if showsProgress {
                    // Green only once every required field is filled — Water Temperature is the only
                    // one, so this reaches "1/1" the moment it is entered, with no further condition.
                    Text(draft.measurementProgressText)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(draft.completedRequiredCount == draft.requiredMeasurements.count ? FieldTheme.fern : Color.secondary)
                }
            }
            ForEach(kinds) { kind in
                MeasurementEntryRow(kind: kind, isRequired: draft.requiredMeasurements.contains(kind), draft: draft, focused: focused)
            }
        }
    }
}

struct MeasurementEntryRow: View {
    let kind: MeasurementKind
    let isRequired: Bool
    let draft: ObservationDraft
    let focused: FocusState<MeasurementKind?>.Binding
    @State private var pendingUnit: MeasurementUnit?

    var body: some View {
        @Bindable var draft = draft
        let isEnabled = kind.productionSpec.support == .fullySupported
        let valueIsValid = isEnabled && Double(draft[valueFor: kind]) != nil
        let selectedUnit = draft.selectedUnit(for: kind)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label {
                    HStack(spacing: FieldTheme.xs) {
                        Text(kind.title).font(.headline)
                        if isRequired { RequiredMark() }
                    }
                } icon: {
                    Image(systemName: kind.symbol).foregroundStyle(FieldTheme.water)
                }
                Spacer()
                if valueIsValid {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(FieldTheme.fern)
                        .accessibilityLabel("Entered")
                }
            }
            HStack(alignment: .center, spacing: 8) {
                TextField("0.0", text: $draft[valueFor: kind])
                    .font(.largeTitle.bold().monospacedDigit())
                    .keyboardType(.decimalPad)
                    .focused(focused, equals: kind)
                    .accessibilityLabel(String(localized: kind.title))
                    .accessibilityIdentifier("measurement.\(kind.rawValue)")
                    .accessibilityHint("Enter " + selectedUnit.spokenName)
                    .layoutPriority(1)
                    .disabled(!isEnabled)
                if kind != .ph {
                    MeasurementUnitMenu(
                        options: kind.unitOptions,
                        selected: selectedUnit,
                        onSelect: changeUnit
                    )
                    .disabled(!isEnabled)
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 64)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous)
                    .stroke(focused.wrappedValue == kind ? FieldTheme.hemlock : Color.clear, lineWidth: 2)
            }
            if kind == .temperature, let conversion = draft.temperatureConversion {
                Text(conversion)
                    .font(.title3.bold().monospacedDigit())
                    .foregroundStyle(FieldTheme.water)
            }
            if !isEnabled {
                // Only reachable for an older draft that already holds a value for this parameter.
                HStack {
                    Text("Not collected in this release. Clear this value to continue.")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Button("Clear Value") { draft[valueFor: kind] = "" }
                        .font(.caption.weight(.bold))
                        .frame(minHeight: 44)
                }
            }
            if let problem = draft.measurementProblem(for: kind) {
                // The same message the submit gate would produce, shown while the collector is still here.
                Text(verbatim: problem)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
            } else if isRequired && !valueIsValid {
                Text("Required")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .alert("Change Unit and Clear Value?", isPresented: unitChangeNeedsConfirmation) {
            Button("Clear Value and Change Unit", role: .destructive) {
                if let pendingUnit {
                    draft.changeUnit(pendingUnit, for: kind, clearingValueIfNeeded: true)
                }
                pendingUnit = nil
            }
            Button("Keep Current Unit", role: .cancel) { pendingUnit = nil }
        } message: {
            Text("These reporting choices cannot be converted safely. The current entry must be cleared before the unit changes.")
        }
    }

    private var unitChangeNeedsConfirmation: Binding<Bool> {
        Binding(
            get: { pendingUnit != nil },
            set: { if !$0 { pendingUnit = nil } }
        )
    }

    private func changeUnit(_ unit: MeasurementUnit) {
        focused.wrappedValue = nil
        if !draft.changeUnit(unit, for: kind) {
            pendingUnit = unit
        }
    }
}

struct MeasurementUnitMenu: View {
    let options: [MeasurementUnit]
    let selected: MeasurementUnit
    let onSelect: (MeasurementUnit) -> Void

    var body: some View {
        if options.count > 1 {
            Menu {
                // A menu Picker draws the standard system checkmark beside the current unit only.
                Picker("Unit", selection: Binding(get: { selected }, set: onSelect)) {
                    ForEach(options) { option in
                        Text(option.menuTitle).tag(option)
                    }
                }
                .pickerStyle(.inline)
            } label: {
                HStack(spacing: 5) {
                    ScientificUnitLabel(unit: selected)
                    Image(systemName: "chevron.down")
                        .font(.caption2.bold())
                }
                .foregroundStyle(FieldTheme.hemlock)
                .frame(minWidth: 64, minHeight: 48)
                .contentShape(Rectangle())
            }
            .accessibilityLabel("Unit: " + selected.spokenName)
            .accessibilityHint("Double tap to change unit")
        } else {
            ScientificUnitLabel(unit: selected)
                .foregroundStyle(.secondary)
                .frame(minWidth: 48, minHeight: 48)
                .accessibilityLabel(selected.spokenName)
        }
    }
}

struct ScientificUnitLabel: View {
    let unit: MeasurementUnit

    var body: some View {
        VStack(spacing: 1) {
            Text(unit.numerator)
                .lineLimit(1)
            if let denominator = unit.denominator {
                Rectangle()
                    .frame(height: 1)
                Text(denominator)
                    .lineLimit(1)
            }
        }
        .font(.subheadline.weight(.semibold))
        .minimumScaleFactor(0.7)
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct NotesMediaView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            NotesMediaContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct NotesMediaContent: View {
    let model: AppModel
    let draft: ObservationDraft
    @FocusState private var editorFocused: Bool

    var body: some View {
        @Bindable var draft = draft
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Field notes")
                        .font(.title2.bold())
                        .foregroundStyle(FieldTheme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("Optional")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Text("Conditions, sample context, or anything a reviewer should know.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ZStack(alignment: .topLeading) {
                TextEditor(text: $draft.notes)
                    .font(.body)
                    .focused($editorFocused)
                    .scrollContentBackground(.hidden)
                    .padding(12)
                    .accessibilityLabel("Field notes")
                    .accessibilityIdentifier("notes.editor")
                if draft.notes.isEmpty {
                    Text("Weather, flow, water color or odor, recent rain, access issues…")
                        .font(.body)
                        .foregroundStyle(Color(uiColor: .placeholderText))
                        .padding(.horizontal, 17)
                        .padding(.vertical, 20)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 180, maxHeight: .infinity)
            .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                    .stroke(editorFocused ? FieldTheme.hemlock : Color(uiColor: .separator), lineWidth: editorFocused ? 1.5 : 0.5)
            }
            .contentShape(Rectangle())
            .onTapGesture { editorFocused = true }
            if !draft.notes.isEmpty {
                Text("\(draft.notes.count) characters · saved on this phone")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, FieldTheme.m)
        .padding(.top, FieldTheme.s)
        .padding(.bottom, FieldTheme.s)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .fieldScreen()
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 5, total: 6, actionTitle: "Review Observation", onDismissKeyboard: { editorFocused = false }) {
                editorFocused = false
                model.advance(to: .review, step: 6)
            }
        }
    }
}

struct MissingDraftView: View {
    var body: some View {
        ContentUnavailableView("Observation Unavailable", systemImage: "doc.questionmark", description: Text("Start or resume an observation from Home."))
            .navigationTitle("Observation")
    }
}
