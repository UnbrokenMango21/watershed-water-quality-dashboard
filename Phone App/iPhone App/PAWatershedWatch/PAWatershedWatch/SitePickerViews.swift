@preconcurrency import CoreLocation
import MapKit
import SwiftUI

/// Location used only to sort and measure distance to catalog sites while choosing one. The observed
/// field position is captured separately, on Visit Details, with its own accuracy rules.
@MainActor
final class SiteProximityLocator: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var location: CLLocation?
    @Published private(set) var status: CLAuthorizationStatus
    private let manager = CLLocationManager()

    override init() {
        status = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 25
    }

    var isAuthorized: Bool { status == .authorizedWhenInUse || status == .authorizedAlways }

    func start() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: manager.startUpdatingLocation()
        default: break
        }
    }

    func stop() { manager.stopUpdatingLocation() }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.status = status
            if self.isAuthorized { self.manager.startUpdatingLocation() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let value = locations.last, value.horizontalAccuracy >= 0 else { return }
        Task { @MainActor in self.location = value }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}

/// Step 1: choose an authoritative catalog site from a searchable list or its map pin.
struct SelectSiteView: View {
    let model: AppModel
    @StateObject private var locator = SiteProximityLocator()
    @State private var searchText = ""
    @State private var selectedID: String?
    @State private var camera: MapCameraPosition = .automatic
    @State private var showMap = true
    @FocusState private var searchFocused: Bool

    private var ranked: [(site: Site, distance: CLLocationDistance?)] {
        let matches = model.sites.filter { $0.matches(searchText) }
        guard let here = locator.location else {
            return matches.map { ($0, nil) }
        }
        return matches.map { ($0, $0.distance(from: here)) }.sorted { ($0.1 ?? .infinity) < ($1.1 ?? .infinity) }
    }

    private var selectedSite: Site? { model.sites.first { $0.id == selectedID } }

    var body: some View {
        let results = ranked
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: FieldTheme.m) {
                    SiteCatalogStatus(model: model)
                    if showMap && !model.sites.isEmpty {
                        SiteMap(sites: results.map(\.site), selectedID: $selectedID, camera: $camera, showsUser: locator.isAuthorized)
                    }
                    if model.sites.isEmpty {
                        if !model.sitesLoading {
                            ContentUnavailableView(
                                "No Sites Available",
                                systemImage: "mappin.slash",
                                description: Text(model.connection == .online
                                    ? "The site catalog has no active sites for your program yet. Contact your program coordinator."
                                    : "Connect once to download the site catalog to this phone.")
                            )
                            .padding(.vertical, FieldTheme.l)
                        }
                    } else if results.isEmpty {
                        ContentUnavailableView.search(text: searchText)
                            .padding(.vertical, FieldTheme.l)
                    } else {
                        SiteListHeader(sortedByDistance: locator.location != nil, count: results.count)
                        VStack(spacing: 0) {
                            ForEach(Array(results.enumerated()), id: \.element.site.id) { index, item in
                                SiteRow(
                                    site: item.site,
                                    distance: item.distance,
                                    isNearest: index == 0 && item.distance != nil && searchText.isEmpty,
                                    isSelected: item.site.id == selectedID
                                ) { select(item.site) }
                                .id(item.site.id)
                                .accessibilityIdentifier("site.\(item.site.id)")
                                if index < results.count - 1 { Divider().padding(.leading, FieldTheme.m) }
                            }
                        }
                        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
                    }
                }
                .padding(.horizontal, FieldTheme.m)
                .padding(.bottom, FieldTheme.l)
            }
            .onChange(of: selectedID) { _, id in
                guard let id, let site = model.sites.first(where: { $0.id == id }) else { return }
                withAnimation { proxy.scrollTo(id, anchor: .center) }
                focusMap(on: site)
            }
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.immediately)
        .navigationTitle("Choose Site")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top, spacing: 0) {
            SiteSearchField(text: $searchText, focused: $searchFocused)
                .padding(.horizontal, FieldTheme.m)
                .padding(.vertical, FieldTheme.s)
                .background(FieldTheme.limestone)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(showMap ? "Hide Map" : "Show Map", systemImage: showMap ? "map.fill" : "map") {
                    withAnimation { showMap.toggle() }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            SelectedSiteFooter(site: selectedSite, distance: selectedSite.flatMap { site in locator.location.map { site.distance(from: $0) } }) {
                guard let site = selectedSite else { return }
                searchFocused = false
                model.draft?.site = site
                model.advance(to: .visitDetails, step: 2)
            }
        }
        .task {
            selectedID = model.draft?.site?.id
            model.refreshSites()
            locator.start()
        }
        .onDisappear { locator.stop() }
    }

    /// Choosing a result closes the keyboard, so the selected site and Continue are immediately reachable.
    private func select(_ site: Site) {
        selectedID = site.id
        searchFocused = false
    }

    private func focusMap(on site: Site) {
        withAnimation {
            camera = .region(MKCoordinateRegion(center: site.coordinate, latitudinalMeters: 4_000, longitudinalMeters: 4_000))
        }
    }
}

/// A plain, always-visible search field. Deliberately not the system search drawer: its presentation
/// state can swallow the first tap on a result, and a collector in the field should never wonder whether
/// a tap registered.
private struct SiteSearchField: View {
    @Binding var text: String
    let focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: FieldTheme.s) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
            TextField("Name, code, county, or watershed", text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused(focused)
                .onSubmit { focused.wrappedValue = false }
                .accessibilityLabel("Search sites")
                .accessibilityIdentifier("site.search")
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous)
                .stroke(focused.wrappedValue ? FieldTheme.hemlock : Color(uiColor: .separator), lineWidth: focused.wrappedValue ? 1.5 : 0.5)
        }
    }
}

private struct SiteCatalogStatus: View {
    let model: AppModel

    var body: some View {
        if model.connection != .online {
            NoticeBanner(title: "Offline", message: "Showing sites saved on this phone. The map may not load until you reconnect.", systemImage: "wifi.slash")
        } else if model.sitesLoading && model.sites.isEmpty {
            HStack(spacing: FieldTheme.s) {
                ProgressView()
                Text("Loading sites").font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(minHeight: 44)
        }
    }
}

private struct SiteListHeader: View {
    let sortedByDistance: Bool
    let count: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            FieldSectionHeader(title: sortedByDistance ? "Sites by distance" : "Sites A–Z", isRequired: true)
            Text("\(count)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .accessibilityLabel(Text("^[\(count) site](inflect: true)"))
        }
        .padding(.top, FieldTheme.xs)
    }
}

private struct SiteMap: View {
    let sites: [Site]
    @Binding var selectedID: String?
    @Binding var camera: MapCameraPosition
    let showsUser: Bool

    var body: some View {
        Map(position: $camera, selection: $selectedID) {
            if showsUser { UserAnnotation() }
            ForEach(sites) { site in
                Marker(site.name, systemImage: "drop.fill", coordinate: site.coordinate)
                    .tint(site.id == selectedID ? FieldTheme.hemlock : FieldTheme.water)
                    .tag(site.id)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            if showsUser { MapUserLocationButton() }
            MapCompass()
        }
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Map of sampling sites. The list below contains the same sites.")
    }
}

private struct SiteRow: View {
    let site: Site
    let distance: CLLocationDistance?
    let isNearest: Bool
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "mappin.circle")
                    .font(.title2)
                    .foregroundStyle(isSelected ? FieldTheme.hemlock : FieldTheme.water)
                    .frame(width: 32)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    if isNearest {
                        Text("Nearest")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(FieldTheme.hemlock)
                    }
                    Text(site.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                    if !site.subtitle.isEmpty || !site.code.isEmpty {
                        Text([site.code, site.subtitle].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: FieldTheme.s)
                if let distance {
                    Text(Site.distanceText(distance))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.vertical, 14)
            .frame(minHeight: 60)
            .background(isSelected ? FieldTheme.hemlock.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint("Selects this site")
    }
}

private struct SelectedSiteFooter: View {
    let site: Site?
    let distance: CLLocationDistance?
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.s) {
            HStack {
                if let site {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Selected site").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(site.name).font(.subheadline.weight(.semibold)).lineLimit(2)
                    }
                    .accessibilityElement(children: .combine)
                    Spacer(minLength: FieldTheme.s)
                    if let distance {
                        Text(Site.distanceText(distance)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                } else {
                    Text("Tap a site in the list or on the map.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                Text("Step 1 of 6")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            PrimaryActionButton(title: "Continue with This Site", isEnabled: site != nil, action: onContinue)
                .accessibilityIdentifier("site.continue")
        }
        .padding(.horizontal, FieldTheme.m)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }
}
