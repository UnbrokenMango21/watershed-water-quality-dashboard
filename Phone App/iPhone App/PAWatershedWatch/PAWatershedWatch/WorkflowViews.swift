import AVFoundation
@preconcurrency import CoreLocation
import SwiftUI
import UIKit

@MainActor
final class LocationPermissionRequester: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var status: CLAuthorizationStatus
    private let manager = CLLocationManager()

    override init() {
        status = manager.authorizationStatus
        super.init()
        manager.delegate = self
    }

    func request() {
        status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
    }
}

enum FieldPermissionRequester {
    static func camera() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: true
        case .notDetermined: await AVCaptureDevice.requestAccess(for: .video)
        case .denied, .restricted: false
        @unknown default: false
        }
    }

    static func microphone() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: true
        case .undetermined:
            await withCheckedContinuation { continuation in
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        case .denied: false
        @unknown default: false
        }
    }
}

struct SelectSiteView: View {
    let model: AppModel
    @State private var searchText = ""
    @State private var checkingUpdates = true

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
                } else if checkingUpdates {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Updating Sites")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(minHeight: 44)
                }
                NearestSiteCallout(site: model.sites[0]) {
                    choose(model.sites[0])
                }
                FieldSectionHeader(title: "Nearby Sites")
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
        .task {
            try? await Task.sleep(for: .milliseconds(650))
            checkingUpdates = false
        }
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

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                if let site = draft.site {
                    SelectedSiteHeader(site: site)
                }
                VStack(alignment: .leading, spacing: 12) {
                    FieldSectionHeader(title: "Collected")
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                        .frame(minHeight: 48)
                    Divider()
                    DatePicker("Time", selection: $draft.date, displayedComponents: .hourAndMinute)
                        .frame(minHeight: 48)
                }
                .padding(FieldTheme.m)
                .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                GPSQualityPanel(draft: draft)
                CollectorPanel(name: draft.collector)
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .navigationTitle("Visit Details")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 2, total: 6, actionTitle: "Test and Method") {
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
                FieldSectionHeader(title: "Position")
                Menu {
                    ForEach(GPSState.allCases) { state in
                        Button { draft.gpsState = state } label: {
                            Label(state.title, systemImage: state.icon)
                        }
                    }
                } label: {
                    StatusPill(title: draft.gpsState.title, systemImage: draft.gpsState.icon, color: draft.gpsState.color)
                }
                .accessibilityLabel("Location quality: \(String(localized: draft.gpsState.title))")
            }
            if draft.gpsState == .denied {
                NoticeBanner(title: "Location Access Required", message: "Open Settings or enter a position.", systemImage: "location.slash.fill", color: .red)
                HStack {
                    Button("Open Settings") { openSettings() }
                        .buttonStyle(.borderedProminent)
                        .frame(minHeight: 48)
                    Button("Enter Manually") { draft.gpsState = .poor }
                        .buttonStyle(.bordered)
                        .frame(minHeight: 48)
                }
            } else {
                KeyValueRow(
                    label: "Position",
                    value: "\(draft.site?.position ?? "Position unavailable") · \(String(localized: draft.gpsState.title))",
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
                Text("Target Accuracy · ±20 m")
                    .font(.subheadline.bold())
                    .foregroundStyle(FieldTheme.goldenrod)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .onChange(of: locationPermission.status) { _, status in
            switch status {
            case .authorizedAlways, .authorizedWhenInUse: reacquire()
            case .denied, .restricted: draft.gpsState = .denied
            case .notDetermined: break
            @unknown default: draft.gpsState = .denied
            }
        }
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
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            draft.gpsState = .good
        }
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
                FieldSectionHeader(title: "Test Type")
                if showValidation && draft.testType == nil {
                    NoticeBanner(title: "Test Type Required", message: "Select a test type.", systemImage: "exclamationmark.circle.fill", color: .red)
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
                        FieldSectionHeader(title: "Method")
                        TextField("Method", text: $draft.method, axis: .vertical)
                            .lineLimit(2...5)
                            .padding(16)
                            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                        FieldSectionHeader(title: "Instrument or Lab")
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
                guard draft.testType != nil, !draft.method.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
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
            FlowFooter(step: 4, total: 6, actionTitle: "Notes and Media") {
                guard measurementsAreValid else {
                    showValidation = true
                    focusedMeasurement = draft.invalidMeasurementKinds.first
                        ?? draft.requiredMeasurements.first { Double(draft[valueFor: $0]) == nil }
                    return
                }
                focusedMeasurement = nil
                model.advance(to: .media, step: 5)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedMeasurement = nil }
            }
        }
    }

    private var measurementsAreValid: Bool {
        let labSelectionValid = !draft.includesLab || !draft.labResultsPending || !draft.requestedAnalytes.isEmpty
        return labSelectionValid
            && draft.invalidMeasurementKinds.isEmpty
            && draft.completedRequiredCount == draft.requiredMeasurements.count
    }
}

struct MeasurementValidationBanner: View {
    let draft: ObservationDraft

    var body: some View {
        if !draft.invalidMeasurementKinds.isEmpty {
            NoticeBanner(title: "Invalid Number", message: "Enter a number without units.", systemImage: "exclamationmark.circle.fill", color: .red)
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
                FieldSectionHeader(title: title)
                if showsProgress {
                    Text("\(draft.completedRequiredCount)/\(draft.requiredMeasurements.count)")
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
        let valueIsValid = Double(draft[valueFor: kind]) != nil
        let selectedUnit = draft.selectedUnit(for: kind)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label {
                    Text(kind.title).font(.headline)
                } icon: {
                    Image(systemName: kind.symbol).foregroundStyle(FieldTheme.water)
                }
                Spacer()
                Image(systemName: valueIsValid ? "checkmark.circle.fill" : "circle")
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
                if kind != .ph {
                    MeasurementUnitMenu(
                        options: kind.unitOptions,
                        selected: selectedUnit,
                        onSelect: changeUnit
                    )
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
            if isRequired && !valueIsValid {
                Text(draft[valueFor: kind].isEmpty ? "Required" : "Enter a number without units")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(draft[valueFor: kind].isEmpty ? Color.secondary : .red)
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
    @Environment(\.openURL) private var openURL
    @State private var showPhotoOptions = false
    @State private var showAudioOptions = false
    @State private var showPermissionAlert = false
    @State private var permissionTitle = ""
    @State private var permissionMessage = ""

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
                PhotoPanel(count: draft.photoCount) { showPhotoOptions = true }
                AudioPanel(hasAudio: draft.hasAudio) { showAudioOptions = true } onRemove: { draft.hasAudio = false }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Notes and Media")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 5, total: 6, actionTitle: "Review Observation") {
                model.advance(to: .review, step: 6)
            }
        }
        .confirmationDialog("Add Photo", isPresented: $showPhotoOptions, titleVisibility: .visible) {
            Button("Take Photo") {
                Task {
                    if await FieldPermissionRequester.camera() {
                        draft.photoCount += 1
                    } else {
                        showPermissionDenied(
                            title: "Camera Access Needed",
                            message: "Allow camera access in Settings to photograph the sampling site."
                        )
                    }
                }
            }
            Button("Choose from Library") { draft.photoCount += 1 }
            Button("Cancel", role: .cancel) { }
        }
        .confirmationDialog("Audio Note", isPresented: $showAudioOptions, titleVisibility: .visible) {
            Button("Record 18-second Note") {
                Task {
                    if await FieldPermissionRequester.microphone() {
                        draft.hasAudio = true
                    } else {
                        showPermissionDenied(
                            title: "Microphone Access Needed",
                            message: "Allow microphone access in Settings to record an audio note."
                        )
                    }
                }
            }
            Button("Cancel", role: .cancel) { }
        }
        .alert(permissionTitle, isPresented: $showPermissionAlert) {
            Button("Open Settings") { openSettings() }
            Button("Not Now", role: .cancel) { }
        } message: {
            Text(permissionMessage)
        }
    }

    private func showPermissionDenied(title: String, message: String) {
        permissionTitle = title
        permissionMessage = message
        showPermissionAlert = true
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
        }
    }
}

struct PhotoPanel: View {
    let count: Int
    let add: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                FieldSectionHeader(title: "Photos", detail: count == 0 ? nil : "\(count) Attached")
                Button(action: add) {
                    Label("Add", systemImage: "camera.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(minWidth: 72, minHeight: 44)
                }
                .buttonStyle(.bordered)
            }
            if count > 0 {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(1...count, id: \.self) { number in
                            PhotoThumbnail(number: number)
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct PhotoThumbnail: View {
    let number: Int

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            FieldTheme.water.opacity(0.14)
            Image(systemName: number.isMultiple(of: 2) ? "water.waves" : "leaf.fill")
                .font(.largeTitle)
                .foregroundStyle(FieldTheme.hemlock.opacity(0.65))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text("Photo \(number)")
                .font(.caption.bold())
                .padding(8)
                .background(.regularMaterial, in: Capsule())
                .padding(8)
        }
        .frame(width: 126, height: 92)
        .clipShape(RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        .accessibilityLabel("Attached photo \(number)")
    }
}

struct AudioPanel: View {
    let hasAudio: Bool
    let add: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                FieldSectionHeader(title: "Audio Note")
                if hasAudio {
                    Menu("Audio options", systemImage: "ellipsis.circle") {
                        Button("Remove Audio", role: .destructive, action: onRemove)
                    }
                    .labelStyle(.iconOnly)
                    .frame(width: 44, height: 44)
                }
            }
            if hasAudio {
                HStack(spacing: 16) {
                    Button(action: {}) {
                        Image(systemName: "play.fill")
                            .frame(width: 48, height: 48)
                            .background(FieldTheme.hemlock, in: Circle())
                            .foregroundStyle(Color(uiColor: .systemBackground))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Play audio note")
                    Image(systemName: "waveform")
                        .font(.title2)
                        .foregroundStyle(FieldTheme.water)
                        .frame(maxWidth: .infinity)
                    Text("0:18").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                }
            } else {
                Button(action: add) {
                    Label("Record Audio Note", systemImage: "mic.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct MissingDraftView: View {
    var body: some View {
        ContentUnavailableView("Observation Unavailable", systemImage: "doc.questionmark", description: Text("Start or resume an observation from Home."))
            .navigationTitle("Observation")
    }
}
