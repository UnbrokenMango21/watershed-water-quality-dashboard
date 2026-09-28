import GoogleSignInSwift
import SwiftUI

// MARK: - Welcome

/// First-run introduction. One screen, not a carousel: what the app is for, what happens to an
/// observation, and why the collector's real name matters.
struct WelcomeView: View {
    var isRevisit = false
    let onContinue: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.xl) {
                VStack(alignment: .leading, spacing: FieldTheme.m) {
                    WatershedMark(size: 76)
                    Text("PA Watershed Watch")
                        .font(.largeTitle.bold())
                        .foregroundStyle(FieldTheme.hemlock)
                        .accessibilityAddTraits(.isHeader)
                    Text("Monitor local water quality, support Penn State research, and help care for our watersheds.")
                        .font(.title3)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: FieldTheme.l) {
                    WelcomeStep(
                        systemImage: "mappin.and.ellipse",
                        title: "Record in the field",
                        detail: "Choose a site, capture your position, and enter readings. Everything saves on your phone, even offline."
                    )
                    WelcomeStep(
                        systemImage: "checkmark.seal",
                        title: "Checked and reviewed",
                        detail: "Automated checks run first, then the research team reviews each submission."
                    )
                    WelcomeStep(
                        systemImage: "person.text.rectangle",
                        title: "Attributed to you",
                        detail: "The research team sees your name with your observations. It never appears on the public dashboard."
                    )
                }
                .fieldCard()
            }
            .padding(.horizontal, FieldTheme.l)
            .padding(.top, FieldTheme.xl)
            .padding(.bottom, FieldTheme.l)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(FieldTheme.limestone.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            PrimaryActionButton(title: isRevisit ? "Done" : "Get Started") {
                if isRevisit { dismiss() } else { onContinue() }
            }
            .accessibilityIdentifier("welcome.continue")
            .padding(.horizontal, FieldTheme.l)
            .padding(.vertical, FieldTheme.s)
            .background(FieldTheme.limestone)
        }
        .tint(FieldTheme.hemlock)
    }
}

private struct WelcomeStep: View {
    let systemImage: String
    let title: LocalizedStringResource
    let detail: LocalizedStringResource

    var body: some View {
        HStack(alignment: .top, spacing: FieldTheme.m) {
            Image(systemName: systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(FieldTheme.hemlock)
                .frame(width: 44, height: 44)
                .background(FieldTheme.primarySoft, in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text(title).font(.headline).foregroundStyle(FieldTheme.ink)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(FieldTheme.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Sign in / create account

enum AuthMode: String, CaseIterable, Identifiable {
    case signIn, createAccount
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .signIn: "Sign In"
        case .createAccount: "Create Account"
        }
    }
}

struct AuthenticationView: View {
    let model: AppModel
    @State private var mode: AuthMode = .signIn
    @State private var showReset = false
    @State private var showAbout = false
    @FocusState private var focused: Field?
    @Environment(\.colorScheme) private var colorScheme

    private enum Field { case name, email, password }

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                HStack(spacing: FieldTheme.m) {
                    WatershedMark(size: 52)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("PA Watershed Watch")
                            .font(.title2.bold())
                            .foregroundStyle(FieldTheme.hemlock)
                        Text(mode == .signIn ? "Sign in to collect observations" : "Create your collector account")
                            .font(.subheadline)
                            .foregroundStyle(FieldTheme.inkMuted)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)

                if FirebaseEnvironment.usesEmulators {
                    EmulatorBadge()
                }

                Picker("Account", selection: $mode) {
                    ForEach(AuthMode.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .onChange(of: mode) { _, _ in
                    model.authError = nil
                    model.authNotice = nil
                }

                if model.connection != .online {
                    NoticeBanner(title: "Offline", message: "Signing in needs a connection. Observations already on this phone stay safe.", systemImage: "wifi.slash")
                }

                VStack(alignment: .leading, spacing: FieldTheme.m) {
                    if mode == .createAccount {
                        VStack(alignment: .leading, spacing: FieldTheme.xs) {
                            TextField("Full name", text: $model.fullName)
                                .textContentType(.name)
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .name)
                                .submitLabel(.next)
                                .onSubmit { focused = .email }
                                .authFieldStyle()
                            Text("Your real name, shown to the research team with your observations.")
                                .font(.footnote)
                                .foregroundStyle(FieldTheme.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    TextField("Email", text: $model.email)
                        .textContentType(mode == .createAccount ? .emailAddress : .username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focused = .password }
                        .authFieldStyle()
                    VStack(alignment: .leading, spacing: FieldTheme.xs) {
                        SecureField("Password", text: $model.password)
                            .textContentType(mode == .createAccount ? .newPassword : .password)
                            .focused($focused, equals: .password)
                            .submitLabel(.go)
                            .onSubmit(submit)
                            .authFieldStyle()
                        if mode == .createAccount {
                            Text("At least 8 characters.")
                                .font(.footnote)
                                .foregroundStyle(FieldTheme.inkMuted)
                        }
                    }
                }

                AuthMessages(model: model)

                VStack(spacing: FieldTheme.m) {
                    PrimaryActionButton(
                        title: mode == .signIn ? "Sign In" : "Create Account",
                        systemImage: mode == .signIn ? "arrow.right.circle.fill" : "person.crop.circle.badge.plus",
                        isEnabled: !model.isAuthenticating,
                        action: submit
                    )
                    .accessibilityIdentifier("auth.submit")
                    if mode == .signIn {
                        Button("Forgot password?") {
                            model.authError = nil
                            showReset = true
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                    }
                    HStack(spacing: FieldTheme.s) {
                        CardDivider()
                        Text("or").font(.caption).foregroundStyle(FieldTheme.inkMuted)
                        CardDivider()
                    }
                    .accessibilityHidden(true)
                    GoogleSignInButton(scheme: colorScheme == .dark ? .dark : .light, style: .wide, state: model.isAuthenticating ? .disabled : .normal) {
                        focused = nil
                        model.signInWithGoogle()
                    }
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .accessibilityLabel("Continue with Google")
                    Text("Use the same sign-in method each time to keep your observations together.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                    if model.isAuthenticating {
                        ProgressView(mode == .signIn ? "Signing in…" : "Creating account…")
                            .font(.subheadline)
                    }
                }

                Button("About PA Watershed Watch") { showAbout = true }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(.horizontal, FieldTheme.l)
            .padding(.top, FieldTheme.xl)
            .padding(.bottom, FieldTheme.xl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FieldTheme.limestone.ignoresSafeArea())
        .tint(FieldTheme.hemlock)
        .sheet(isPresented: $showReset) {
            PasswordResetView(model: model)
        }
        .sheet(isPresented: $showAbout) {
            WelcomeView(isRevisit: true) { }
        }
    }

    private func submit() {
        focused = nil
        switch mode {
        case .signIn: model.signIn()
        case .createAccount: model.createAccount()
        }
    }
}

private struct AuthMessages: View {
    let model: AppModel

    var body: some View {
        if let error = model.authError {
            Label {
                Text(verbatim: error)
            } icon: {
                Image(systemName: "exclamationmark.circle.fill")
            }
            .font(.subheadline)
            .foregroundStyle(FieldTheme.alert)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel("Error: \(error)")
        }
        if let notice = model.authNotice {
            NoticeBanner(title: "Check Your Email", verbatimMessage: notice, systemImage: "envelope.badge", tone: .success)
        }
    }
}

/// Real Firebase password reset. The confirmation never reveals whether an address has an account.
struct PasswordResetView: View {
    let model: AppModel
    @State private var address = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $address)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit { model.sendPasswordReset(to: address) }
                } footer: {
                    Text("We'll email a link to set a new password. If you created your account with Google, use Continue with Google instead.")
                }
                if model.authError != nil || model.authNotice != nil {
                    Section { AuthMessages(model: model) }
                }
                Section {
                    Button {
                        model.sendPasswordReset(to: address)
                    } label: {
                        HStack {
                            Text("Send Reset Email")
                            Spacer()
                            if model.isAuthenticating { ProgressView() }
                        }
                    }
                    .disabled(model.isAuthenticating || address.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear {
                address = model.email
                model.authNotice = nil
                model.authError = nil
            }
        }
        .tint(FieldTheme.hemlock)
    }
}

// MARK: - Ready to collect

/// Shown after the first sign-in on a device, and whenever the account has no name: confirms the real
/// name that will be recorded as the collector on new observations.
struct IdentityConfirmationView: View {
    let model: AppModel
    @State private var name = ""
    @FocusState private var nameFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 52))
                    .foregroundStyle(FieldTheme.hemlock)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: FieldTheme.s) {
                    Text("Ready to collect")
                        .font(.largeTitle.bold())
                        .foregroundStyle(FieldTheme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text("Confirm the name that will identify you on new observations.")
                        .font(.title3)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: FieldTheme.s) {
                    Text("Full name").font(.headline)
                    TextField("Full name", text: $name)
                        .textContentType(.name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($nameFocused)
                        .submitLabel(.done)
                        .onSubmit(confirm)
                        .authFieldStyle()
                    Text("Shown to the research team. You can change it later in Account.")
                        .font(.footnote)
                        .foregroundStyle(FieldTheme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !model.userEmail.isEmpty {
                    KeyValueRow(label: "Signed in as", value: model.userEmail)
                }
                if let error = model.authError {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(FieldTheme.alert)
                }
            }
            .padding(.horizontal, FieldTheme.l)
            .padding(.top, FieldTheme.xl)
            .padding(.bottom, FieldTheme.l)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FieldTheme.limestone.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: FieldTheme.s) {
                PrimaryActionButton(title: "Start Collecting", systemImage: "checkmark.circle.fill", isEnabled: !model.isSavingName, action: confirm)
                    .accessibilityIdentifier("identity.confirm")
                Button("Not you? Sign Out", role: .destructive) { model.signOut() }
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, FieldTheme.l)
            .padding(.vertical, FieldTheme.s)
            .background(FieldTheme.limestone)
        }
        .tint(FieldTheme.hemlock)
        .onAppear {
            name = model.userDisplayName
            model.authError = nil
            if name.isEmpty { nameFocused = true }
        }
    }

    private func confirm() {
        nameFocused = false
        Task { await model.confirmIdentity(name) }
    }
}

// MARK: - Shared

/// Debug-only marker that the app is talking to the local Firebase emulators, not the real project.
struct EmulatorBadge: View {
    var body: some View {
        StatusPill(title: "Local Firebase emulators", systemImage: "hammer.fill", tone: .warning)
            .accessibilityIdentifier("debug.emulators")
    }
}

extension View {
    func authFieldStyle() -> some View {
        font(.body)
            .foregroundStyle(FieldTheme.ink)
            .padding(.horizontal, FieldTheme.m)
            .fieldInput()
            .contentShape([.interaction, .accessibility], Rectangle())
    }
}
