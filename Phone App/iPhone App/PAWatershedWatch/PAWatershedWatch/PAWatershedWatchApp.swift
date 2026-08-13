import SwiftUI

@main
struct PAWatershedWatchApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            if model.isSignedIn {
                MainTabView(model: model)
            } else {
                SignInView(model: model)
            }
        }
    }
}

struct MainTabView: View {
    let model: AppModel

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            Tab("Home", systemImage: "house.fill", value: AppTab.home) {
                HomeNavigation(model: model)
            }
            Tab("Recent", systemImage: "clock.arrow.circlepath", value: AppTab.recent) {
                RecentNavigation(model: model)
            }
            Tab("Account", systemImage: "person.crop.circle", value: AppTab.account) {
                AccountView(model: model)
            }
        }
        .tint(FieldTheme.hemlock)
    }
}

struct HomeNavigation: View {
    let model: AppModel

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.homePath) {
            HomeView(model: model)
                .navigationDestination(for: HomeRoute.self) { route in
                    switch route {
                    case .selectSite: SelectSiteView(model: model)
                    case .visitDetails: VisitDetailsView(model: model)
                    case .testMethod: TestMethodView(model: model)
                    case .measurements: MeasurementsView(model: model)
                    case .media: NotesMediaView(model: model)
                    case .review: ReviewView(model: model)
                    case .submit: SubmitView(model: model)
                    case .status: SubmissionStatusView(model: model, recordID: model.records.first?.id, fromCorrection: false)
                    }
                }
        }
    }
}

struct RecentNavigation: View {
    let model: AppModel

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.recentPath) {
            RecentObservationsView(model: model)
                .navigationDestination(for: RecentRoute.self) { route in
                    switch route {
                    case .detail(let id): ObservationDetailView(model: model, recordID: id)
                    case .correction(let id): CorrectionRevisionView(model: model, recordID: id)
                    case .status(let id): SubmissionStatusView(model: model, recordID: id, fromCorrection: true)
                    }
                }
        }
    }
}
