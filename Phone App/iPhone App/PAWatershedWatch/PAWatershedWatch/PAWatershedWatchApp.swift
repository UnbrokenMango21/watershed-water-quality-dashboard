import FirebaseAppCheck
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import SwiftData
import SwiftUI

@main
struct PAWatershedWatchApp: App {
    private let container: ModelContainer
    @State private var model: AppModel

    init() {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory())
        #endif
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        FirebaseEnvironment.configureEmulatorsIfRequested()
        do {
            let container = try MobileModelContainer.make()
            self.container = container
            _model = State(initialValue: AppModel(context: container.mainContext))
        } catch {
            fatalError("PA Watershed Watch cannot safely start without its on-device scientific record store: \(error.localizedDescription)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .onOpenURL { url in
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
        }
        .modelContainer(container)
    }
}

/// First launch → Welcome → Sign in or create account → Confirm name → Home.
/// Welcome is shown once per device; it can be reopened from Account → About.
struct RootView: View {
    let model: AppModel
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false

    var body: some View {
        Group {
            if !model.authResolved {
                LaunchPlaceholder()
            } else if !model.isSignedIn {
                if hasSeenWelcome {
                    AuthenticationView(model: model)
                } else {
                    WelcomeView { hasSeenWelcome = true }
                }
            } else if model.needsIdentity {
                IdentityConfirmationView(model: model)
            } else {
                MainTabView(model: model)
            }
        }
        .animation(.default, value: model.isSignedIn)
        .animation(.default, value: model.needsIdentity)
    }
}

struct LaunchPlaceholder: View {
    var body: some View {
        VStack(spacing: FieldTheme.m) {
            WatershedMark(size: 72)
            ProgressView("Restoring your session")
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FieldTheme.limestone.ignoresSafeArea())
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
            Tab("Observations", systemImage: "clock.arrow.circlepath", value: AppTab.recent) {
                RecentNavigation(model: model)
            }
        }
        .tint(FieldTheme.hemlock)
        .sheet(isPresented: $model.showAccount) {
            AccountView(model: model)
        }
    }
}

/// The single entry point to Account and Settings, placed top-right on each tab's root screen.
struct AccountToolbarButton: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                model.showAccount = true
            } label: {
                AccountInitialsBadge(name: model.userDisplayName, size: 32)
            }
            .accessibilityLabel("Account and settings")
        }
    }
}

struct HomeNavigation: View {
    let model: AppModel

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.homePath) {
            HomeView(model: model)
                .navigationDestination(for: HomeRoute.self) { route in
                    Group {
                        switch route {
                        case .selectSite: SelectSiteView(model: model)
                        case .visitDetails: VisitDetailsView(model: model)
                        case .testMethod: TestMethodView(model: model)
                        case .measurements: MeasurementsView(model: model)
                        case .media: NotesMediaView(model: model)
                        case .review: ReviewView(model: model)
                        case .status: SubmissionStatusView(model: model, recordID: model.lastSubmittedID ?? model.records.first?.id, fromCorrection: false)
                        }
                    }
                    // A focused, full-height flow: no tab bar under the action footer or the keyboard.
                    .toolbar(.hidden, for: .tabBar)
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
                    Group {
                        switch route {
                        case .detail(let id): ObservationDetailView(model: model, recordID: id)
                        case .correction(let id): CorrectionRevisionView(model: model, recordID: id)
                        case .status(let id): SubmissionStatusView(model: model, recordID: id, fromCorrection: true)
                        }
                    }
                    .toolbar(.hidden, for: .tabBar)
                }
        }
    }
}
