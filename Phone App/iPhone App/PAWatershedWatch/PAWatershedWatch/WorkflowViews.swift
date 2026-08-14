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

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
        isApproximate = manager.accuracyAuthorization == .reducedAccuracy
        if status == .authorizedAlways || status == .authorizedWhenInUse { acquire() }
        if status == .denied || status == .restricted { failureMessage = "Location access is denied." }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let value = locations.last, value.horizontalAccuracy >= 0,
              abs(value.timestamp.timeIntervalSinceNow) <= 30
        else { failureMessage = "The location reading was stale. Reacquire GPS."; return }
        requestID = nil; failureMessage = nil; location = value
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        requestID = nil
        failureMessage = (error as? CLError)?.code == .locationUnknown
            ? "A field position is not available yet. Reacquire GPS in an open area."
            : "The device could not acquire a field position."
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

struct SelectSiteView: View {
    let model: AppModel
    @State private var searchText = ""

    var body: some View {
        let visibleSites = searchText.isEmpty
            ? model.sites
            : model.sites.filter {
                $0.name.localizedStandardContains(searchText)
                || $0.county.localizedStandardContains(searchText)
                || $0.watershed.localizedStandardContains(searchText)
            }
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.m) {
                if model.connection == .offline {
                    StatusPill(title: "Cached Sites", systemImage: "internaldrive.fill", color: FieldTheme.water)
                } else if model.sitesLoading {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Updating Sites")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(minHeight: 44)
                }
                if let nearest = model.sites.first {
                    NearestSiteCallout(site: nearest) { choose(nearest) }
                } else if !model.sitesLoading {
                    ContentUnavailableView(
                        "No Sites Available",
                        systemImage: "map",
                        description: Text(model.connection == .offline ? "Connect once to cache the site catalog on this phone." : "Site data could not be loaded. Try again.")
                    )
                }
                FieldSectionHeader(title: "Nearby Sites", isRequired: true)
                if visibleSites.isEmpty {
                    ContentUnavailableView.search
                        .padding(.vertical, 48)
                } else {
                    SiteResultsList(sites: visibleSites, connection: model.connection, onChoose: choose)
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("Select Site")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Site, county, or watershed")
        .task { model.refreshSites() }
    }

    private func choose(_ site: Site) {
        guard model.connection == .online || site.cached else { return }
        model.draft?.site = site
        model.advance(to: .visitDetails, step: 2)
    }
}

struct NearestSiteCallout: View {
    let site: Site
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: "location.fill")
                    .font(.title2)
                    .foregroundStyle(FieldTheme.hemlock)
                    .frame(width: 48, height: 48)
                    .background(FieldTheme.hemlock.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("Nearest · \(site.distance)")
                        .font(.subheadline.bold())
                        .foregroundStyle(FieldTheme.hemlock)
                    Text(site.name)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: FieldTheme.s)
                Image(systemName: "arrow.right.circle.fill")
                    .font(.title2)
                    .foregroundStyle(FieldTheme.hemlock)
            }
            .padding(FieldTheme.m)
            .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct SiteResultsList: View {
    let sites: [Site]
    let connection: ConnectionState
    let onChoose: (Site) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(sites) { site in
                Button { onChoose(site) } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(site.name)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Text("\(site.county) · \(site.watershed)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.leading)
                            if connection == .offline {
                                Label(site.cached ? "Available Offline" : "Not Cached", systemImage: site.cached ? "checkmark.circle.fill" : "icloud.slash")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(site.cached ? FieldTheme.fern : .red)
                            }
                        }
                        Spacer(minLength: FieldTheme.s)
                        VStack(alignment: .trailing, spacing: FieldTheme.s) {
                            Text(site.distance).font(.caption).foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.vertical, 16)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(connection == .offline && !site.cached)
                Divider()
            }
        }
        .padding(.horizontal, FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
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
            FlowFooter(step: 2, total: 6, actionTitle: "Test and Method") {
                guard draft.latitude != nil, draft.longitude != nil, draft.accuracyMeters != nil else {
                    showLocationValidation = true
                    return
                }
                model.advance(to: .testMethod, step: 3)
            }
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
            Text("\(site.county) · \(site.watershed)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
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
                    label: "Position",
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
            FieldSectionHeader(title: "Collector")
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                FieldSectionHeader(title: "Test Type", isRequired: true)
                if showValidation {
                    NoticeBanner(title: "Complete Test Details", message: "Select a test type and complete its method, instrument or laboratory, and description when Other is selected.", systemImage: "exclamationmark.circle.fill", color: .red)
                } else if let error = model.workflowError {
                    NoticeBanner(title: "Fix This to Continue", verbatimMessage: error, systemImage: "exclamationmark.circle.fill", color: .red)
                }
                TestTypeList(selected: draft.testType) { type in
                    withAnimation(reduceMotion ? nil : .snappy) {
                        draft.testType = type
                        draft.method = type.suggestedMethod
                        draft.instrument = type.suggestedInstrument
                        draft.lastSaved = .now
                        showValidation = false
                    }
                }
                if draft.testType != nil {
                    VStack(alignment: .leading, spacing: FieldTheme.l) {
                        if draft.testType == .other {
                            FieldSectionHeader(title: "Other Test Type", isRequired: true)
                            TextField("Describe the test type", text: $draft.testTypeOther, axis: .vertical)
                                .lineLimit(2...4)
                                .padding(16)
                                .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                        }
                        FieldSectionHeader(title: "Method", isRequired: true)
                        TextField("Method", text: $draft.method, axis: .vertical)
                            .lineLimit(2...5)
                            .padding(16)
                            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                        FieldSectionHeader(title: "Instrument or Lab", isRequired: true)
                        TextField("Instrument or Lab", text: $draft.instrument, axis: .vertical)
                            .lineLimit(2...5)
                            .padding(16)
                            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                    }
                    .padding(FieldTheme.m)
                    .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Test and Method")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 3, total: 6, actionTitle: "Enter Measurements") {
                guard let testType = draft.testType,
                      !draft.method.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      !draft.instrument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      testType != .other || !draft.testTypeOther.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                else {
                    showValidation = true
                    return
                }
                model.advance(to: .measurements, step: 4)
            }
        }
    }
}

struct TestTypeList: View {
    let selected: TestType?
    let onSelect: (TestType) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(TestType.allCases) { type in
                Button { onSelect(type) } label: {
                    HStack(spacing: 16) {
                        Image(systemName: type.icon)
                            .font(.title3)
                            .foregroundStyle(selected == type ? FieldTheme.hemlock : .secondary)
                            .frame(width: 30)
                        Text(type.title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: FieldTheme.s)
                        Image(systemName: selected == type ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(selected == type ? FieldTheme.hemlock : Color(uiColor: .tertiaryLabel))
                    }
                    .padding(.vertical, 16)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 54)
                Divider()
            }
        }
        .padding(.horizontal, FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
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
        let isLab = draft.testType == .pennStateLab || draft.testType == .externalLab
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.l) {
                if showValidation {
                    MeasurementValidationBanner(draft: draft)
                }
                if isLab {
                    LabResultTimingPanel(draft: draft)
                    if draft.labResultsPending {
                        RequestedAnalytesPanel(draft: draft)
                    }
                }
                MeasurementGroup(
                    title: "Required Measurements",
                    kinds: draft.requiredMeasurements,
                    draft: draft,
                    focused: $focusedMeasurement,
                    showsProgress: true
                )
                if draft.testType == .mixed {
                    RequestedAnalytesPanel(draft: draft)
                }
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
            FlowFooter(step: 4, total: 6, actionTitle: "Notes") {
                guard measurementsAreValid else {
                    showValidation = true
                    focusedMeasurement = draft.measurementProblems.first?.kind ?? draft.firstIncompleteRequirement
                    return
                }
                focusedMeasurement = nil
                model.advance(to: .media, step: 5)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                if let next = nextFocusTarget {
                    Button("Next") { focusedMeasurement = next }
                }
                Button("Done") { focusedMeasurement = nil }
            }
        }
        .task { await claimPendingFocus() }
        .onChange(of: model.pendingMeasurementFocus) { _, _ in
            Task { await claimPendingFocus() }
        }
    }

    private var measurementsAreValid: Bool {
        let labSelectionValid = !draft.includesLab || !draft.labResultsPending || !draft.requestedAnalytes.isEmpty
        return labSelectionValid && draft.measurementProblems.isEmpty && draft.completedRequiredCount == draft.requiredMeasurements.count
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
            NoticeBanner(title: "Measurement Not Yet Enabled", message: "Clear values marked unavailable before continuing. They cannot be silently omitted from a scientific record.", systemImage: "lock.fill", color: .red)
        } else if let problem = draft.measurementProblems.first {
            NoticeBanner(title: "Check This Entry", verbatimMessage: problem.message, systemImage: "exclamationmark.circle.fill", color: .red)
        } else if draft.includesLab && draft.labResultsPending && draft.requestedAnalytes.isEmpty {
            NoticeBanner(title: "Analysis Required", message: "Select at least one analysis.", systemImage: "exclamationmark.circle.fill", color: .red)
        } else {
            NoticeBanner(title: "Measurements Required", message: "Complete all required measurements.", systemImage: "exclamationmark.circle.fill", color: .red)
        }
    }
}

struct LabResultTimingPanel: View {
    let draft: ObservationDraft

    var body: some View {
        @Bindable var draft = draft
        VStack(alignment: .leading, spacing: 12) {
            FieldSectionHeader(title: "Result Status")
            Picker("Result Status", selection: $draft.labResultsPending) {
                Text("Pending Lab").tag(true)
                Text("Available Now").tag(false)
            }
            .pickerStyle(.segmented)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct RequestedAnalytesPanel: View {
    let draft: ObservationDraft
    private let analytes: [MeasurementKind] = [.chloride, .sulfate, .nitrate, .phosphate]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldSectionHeader(title: "Requested Lab Analyses")
            ForEach(analytes) { kind in
                Button {
                    if draft.requestedAnalytes.contains(kind) {
                        draft.requestedAnalytes.remove(kind)
                    } else {
                        draft.requestedAnalytes.insert(kind)
                    }
                } label: {
                    HStack {
                        Text(kind.title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: draft.requestedAnalytes.contains(kind) ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(draft.requestedAnalytes.contains(kind) ? FieldTheme.hemlock : Color(uiColor: .tertiaryLabel))
                    }
                    .frame(minHeight: 48)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
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
            if kinds.isEmpty {
                Label("No measurements required while lab results are pending", systemImage: "checkmark.circle")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(kinds) { kind in
                    MeasurementEntryRow(kind: kind, isRequired: draft.requiredMeasurements.contains(kind), draft: draft, focused: focused)
                }
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
                Image(systemName: isEnabled ? (valueIsValid ? "checkmark.circle.fill" : "circle") : "lock.fill")
                    .foregroundStyle(valueIsValid ? FieldTheme.fern : Color.secondary)
                    .accessibilityLabel(valueIsValid ? "Complete" : "Incomplete")
            }
            HStack(alignment: .center, spacing: 8) {
                TextField("0.0", text: $draft[valueFor: kind])
                    .font(.largeTitle.bold().monospacedDigit())
                    .keyboardType(.decimalPad)
                    .focused(focused, equals: kind)
                    .accessibilityLabel(kind.title)
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
                HStack {
                    Text("Visible for field planning; production mapping is not yet approved.")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if !draft[valueFor: kind].isEmpty {
                        Button("Clear") { draft[valueFor: kind] = "" }
                            .font(.caption.weight(.bold))
                    }
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
        .opacity(isEnabled ? 1 : 0.72)
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
                ForEach(options) { option in
                    Button { onSelect(option) } label: {
                        Label(option.menuTitle, systemImage: option == selected ? "checkmark" : "circle")
                    }
                }
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

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                VStack(alignment: .leading, spacing: 12) {
                    FieldSectionHeader(title: "Field Notes")
                    TextField("Describe conditions, sample context, or anything unusual", text: $draft.notes, axis: .vertical)
                        .font(.body)
                        .lineLimit(6...10)
                        .padding(8)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                }
                .padding(FieldTheme.m)
                .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 5, total: 6, actionTitle: "Review Observation") {
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
