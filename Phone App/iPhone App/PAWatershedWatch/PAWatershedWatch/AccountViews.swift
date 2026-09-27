import SwiftUI

/// Links that belong in Settings once the program publishes them. Each row appears only when its URL
/// is set, so the app never shows a placeholder or a dead link.
enum AppLinks {
    static let privacyPolicy: URL? = nil
    static let support: URL? = nil
}

enum AppBuildInfo {
    static var version: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—" }
    static var build: String { Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—" }
    static var display: String { "\(version) (\(build))" }
}

/// Account and Settings, opened from the top-right control on Home and Observations.
struct AccountView: View {
    let model: AppModel
    @State private var confirmSignOut = false
    @State private var showAbout = false
    @State private var showPasswordReset = false
    @Environment(\.dismiss) private var dismiss

    private var unsyncedCount: Int { model.records.filter { $0.sync != .synced }.count }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: FieldTheme.m) {
                        AccountInitialsBadge(name: model.userDisplayName, size: 56)
                        VStack(alignment: .leading, spacing: FieldTheme.xs) {
                            Text(model.userDisplayName.isEmpty ? String(localized: "Name not set") : model.userDisplayName)
                                .font(.title3.bold())
                            if !model.userEmail.isEmpty {
                                Text(model.userEmail)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, FieldTheme.xs)
                    .accessibilityElement(children: .combine)
                }

                Section {
                    NavigationLink {
                        EditDisplayNameView(model: model)
                    } label: {
                        LabeledContent("Full name", value: model.userDisplayName)
                    }
                } header: {
                    Text("Research Identity")
                } footer: {
                    Text("Recorded as the collector on new observations and visible to authorized research and QC staff. Never shown on the public dashboard.")
                }

                Section("Sign-In") {
                    LabeledContent("Method", value: providerText)
                    if model.signInProviders.contains(.password) {
                        LabeledContent("Email", value: model.userEmailVerified ? String(localized: "Verified") : String(localized: "Not verified"))
                        Button("Send Password Reset Email") {
                            showPasswordReset = true
                            model.sendPasswordReset(to: model.userEmail)
                        }
                        .disabled(model.connection != .online || model.isAuthenticating)
                    }
                }

                Section {
                    LabeledContent("Connection") {
                        Label(model.connection == .online ? "Online" : "Offline", systemImage: model.connection == .online ? "wifi" : "wifi.slash")
                            .foregroundStyle(model.connection == .online ? FieldTheme.fern : FieldTheme.goldenrod)
                    }
                    LabeledContent("Waiting to sync", value: unsyncedCount.formatted())
                    LabeledContent("Sites available", value: model.sites.count.formatted())
                    Button {
                        model.retrySync()
                    } label: {
                        Label("Retry Sync Now", systemImage: "arrow.clockwise")
                    }
                    .disabled(model.connection != .online || unsyncedCount == 0)
                } header: {
                    Text("Field Data")
                } footer: {
                    Text("Drafts and submitted observations stay on this phone until the archive confirms them. Sync resumes automatically when a connection returns.")
                }

                Section("About") {
                    Button("About PA Watershed Watch") { showAbout = true }
                    if let url = AppLinks.privacyPolicy { Link("Privacy Policy", destination: url) }
                    if let url = AppLinks.support { Link("Support", destination: url) }
                    LabeledContent("Version", value: AppBuildInfo.display)
                }

                Section {
                    Button("Sign Out", role: .destructive) { confirmSignOut = true }
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Sign out of PA Watershed Watch?", isPresented: $confirmSignOut) {
                Button("Sign Out", role: .destructive) { model.signOut() }
                Button("Cancel", role: .cancel) { }
            } message: {
                if unsyncedCount > 0 {
                    Text("\(unsyncedCount) observation(s) have not synced yet. They stay on this phone and sync after you sign back in with this account.")
                } else {
                    Text("Your drafts stay on this phone for when you sign back in.")
                }
            }
            .alert("Password Reset", isPresented: resetResultShown) {
                Button("OK") { model.authNotice = nil; model.authError = nil }
            } message: {
                Text(verbatim: model.authNotice ?? model.authError ?? "")
            }
            .sheet(isPresented: $showAbout) {
                WelcomeView(isRevisit: true) { }
            }
        }
        .tint(FieldTheme.hemlock)
    }

    private var providerText: String {
        let names = model.signInProviders.map { String(localized: $0.title) }
        return names.isEmpty ? String(localized: "Email and password") : names.formatted()
    }

    private var resetResultShown: Binding<Bool> {
        Binding(
            get: { showPasswordReset && !model.isAuthenticating && (model.authNotice != nil || model.authError != nil) },
            set: { if !$0 { showPasswordReset = false } }
        )
    }
}

struct EditDisplayNameView: View {
    let model: AppModel
    @State private var name = ""
    @State private var saved = false
    @FocusState private var focused: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section {
                TextField("Full name", text: $name)
                    .textContentType(.name)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.done)
                    .onSubmit(save)
            } footer: {
                Text("Use the name your research team knows you by. Observations you already submitted keep the name they were recorded with; the change applies to new observations.")
            }
            if let error = model.authError {
                Section {
                    Label(error, systemImage: "exclamationmark.circle.fill").foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Full Name")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                if model.isSavingName {
                    ProgressView()
                } else {
                    Button("Save", action: save)
                        .disabled(IdentityName.normalized(name) == model.userDisplayName || IdentityName.problem(name) != nil)
                }
            }
        }
        .onAppear {
            name = model.userDisplayName
            model.authError = nil
            focused = true
        }
        .sensoryFeedback(.success, trigger: saved)
    }

    private func save() {
        Task {
            if await model.updateDisplayName(name) {
                saved = true
                dismiss()
            }
        }
    }
}

/// Initials in a hemlock circle. Decorative: callers supply the accessible label.
struct AccountInitialsBadge: View {
    let name: String
    var size: CGFloat = 32

    var body: some View {
        let initials = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        ZStack {
            Circle().fill(FieldTheme.hemlock)
            if initials.isEmpty {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.45, weight: .semibold))
                    .foregroundStyle(Color(uiColor: .systemBackground))
            } else {
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(uiColor: .systemBackground))
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
