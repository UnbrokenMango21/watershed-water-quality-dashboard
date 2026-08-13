import SwiftUI

struct SignInView: View {
    let model: AppModel
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.xl) {
                SignInIdentity()
                VStack(spacing: FieldTheme.m) {
                    TextField("Institution email", text: $model.email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .password }
                        .fieldInputStyle()
                    SecureField("Password", text: $model.password)
                        .textContentType(.password)
                        .focused($focusedField, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(model.signIn)
                        .fieldInputStyle()
                        .overlay(alignment: .trailing) {
                            if !model.password.isEmpty {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(FieldTheme.fern)
                                    .padding(.trailing, FieldTheme.m)
                                    .accessibilityHidden(true)
                            }
                        }
                        .accessibilityHint(model.password.isEmpty ? "Password is empty" : "Password is filled")
                    if let error = model.authError {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                VStack(spacing: 12) {
                    PrimaryActionButton(title: "Sign In", systemImage: "arrow.right.circle.fill", action: model.signIn)
                    Button("Forgot Password?") { model.authError = "Password recovery requires a connection." }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
            .padding(.horizontal, FieldTheme.l)
            .padding(.top, 52)
            .padding(.bottom, FieldTheme.xl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FieldTheme.limestone.ignoresSafeArea())
        .tint(FieldTheme.hemlock)
    }
}

struct SignInIdentity: View {
    var body: some View {
        VStack(alignment: .leading, spacing: FieldTheme.m) {
            WatershedMark(size: 68)
            VStack(alignment: .leading, spacing: FieldTheme.s) {
                Text("PA Watershed Watch")
                    .font(.largeTitle.bold())
                    .foregroundStyle(FieldTheme.ink)
                Text("Field Data Collection")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private extension View {
    func fieldInputStyle() -> some View {
        font(.body)
            .padding(.horizontal, FieldTheme.m)
            .frame(minHeight: 54)
            .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                    .stroke(Color(uiColor: .separator), lineWidth: 0.5)
            }
    }
}

struct HomeView: View {
    let model: AppModel
    @State private var confirmNewObservation = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: FieldTheme.l) {
                HomeFieldHeader()
                if model.connection != .online {
                    ConnectionBanner(connection: model.connection)
                }
                StartObservationPanel {
                    if model.draft == nil {
                        model.startNewObservation()
                    } else {
                        confirmNewObservation = true
                    }
                }
                if let draft = model.draft, model.workflowState == .draft {
                    ResumeDraftPanel(draft: draft, action: model.resumeObservation)
                }
                if model.records.contains(where: { $0.sync == .failed || $0.sync == .waiting }) {
                    SyncAttentionPanel(model: model)
                }
                RecentPreview(model: model)
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.top, FieldTheme.s)
            .padding(.bottom, FieldTheme.xl)
        }
        .fieldScreen()
        .navigationTitle("PA Watershed Watch")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Account", systemImage: "person.crop.circle.fill") {
                    model.selectedTab = .account
                }
                .labelStyle(.iconOnly)
            }
        }
        .alert("Start New Observation?", isPresented: $confirmNewObservation) {
            Button("Resume Current Draft") { model.resumeObservation() }
            Button("Discard Draft and Start New", role: .destructive) { model.startNewObservation() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Current draft will be removed from this phone.")
        }
    }
}

struct HomeFieldHeader: View {
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: FieldTheme.xs) {
                Text("Maya Chen")
                    .font(.title2.bold())
                Text("Centre County · 6 Cached Sites")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct ConnectionBanner: View {
    let connection: ConnectionState

    var body: some View {
        switch connection {
        case .offline:
            Label("Offline", systemImage: "wifi.slash")
                .font(.subheadline.bold())
                .foregroundStyle(FieldTheme.goldenrod)
        case .serverUnavailable:
            Label("Archive Unavailable", systemImage: "exclamationmark.icloud")
                .font(.subheadline.bold())
                .foregroundStyle(.red)
        case .online:
            EmptyView()
        }
    }
}

struct StartObservationPanel: View {
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Button(action: action) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: FieldTheme.m) {
                        HStack {
                            actionIcon
                            Spacer()
                            arrow
                        }
                        Text("Start New Observation")
                            .font(.title.bold())
                    }
                } else {
                    HStack(spacing: FieldTheme.m) {
                        actionIcon
                        Text("Start New Observation")
                            .font(.title2.bold())
                        Spacer()
                        arrow
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(FieldTheme.m)
            .frame(minHeight: 88)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldTheme.hemlock, in: RoundedRectangle(cornerRadius: FieldTheme.radiusL, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Start New Observation")
    }

    private var actionIcon: some View {
        Image(systemName: "plus")
            .font(.title2.bold())
            .frame(width: 48, height: 48)
            .background(Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS))
    }

    private var arrow: some View {
        Image(systemName: "arrow.right")
            .font(.headline)
    }
}

struct ResumeDraftPanel: View {
    let draft: ObservationDraft
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                FieldSectionHeader(title: "Draft")
                StatusPill(title: "Draft", systemImage: "pencil", color: FieldTheme.water)
            }
            if let site = draft.site {
                Text(site.name)
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Site Not Selected")
                    .font(.body.weight(.semibold))
            }
            HStack {
                Text("Step \(draft.currentStep) of 6")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Resume", action: action)
                    .font(.headline)
                    .frame(minWidth: 88, minHeight: 48)
                    .buttonStyle(.borderedProminent)
            }
            ProgressView(value: Double(draft.currentStep), total: 6)
                .tint(FieldTheme.water)
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous)
                .stroke(Color(uiColor: .separator), lineWidth: 0.5)
        }
    }
}

struct SyncAttentionPanel: View {
    let model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            FieldSectionHeader(title: "Sync")
            ForEach(model.records.filter { $0.sync == .failed || $0.sync == .waiting }.prefix(2)) { record in
                Button {
                    model.selectedTab = .recent
                    model.recentPath = [.detail(record.id)]
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: record.sync.icon)
                            .foregroundStyle(record.sync.color)
                            .frame(width: 32, height: 32)
                            .background(record.sync.color.opacity(0.1), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.site.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(record.sync.title)
                                .font(.caption)
                                .foregroundStyle(record.sync.color)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .frame(minHeight: 52)
            }
        }
        .padding(FieldTheme.m)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
    }
}

struct RecentPreview: View {
    let model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                FieldSectionHeader(title: "Recent Observations")
                Button("See All") { model.selectedTab = .recent }
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 44)
            }
            ForEach(model.records.prefix(2)) { record in
                Button {
                    model.selectedTab = .recent
                    model.recentPath = [.detail(record.id)]
                } label: {
                    ObservationCompactRow(record: record)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct ObservationCompactRow: View {
    let record: ObservationRecord

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 4) {
                Text(record.date, format: .dateTime.day())
                    .font(.title3.bold())
                Text(record.date, format: .dateTime.month(.abbreviated))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .frame(width: 46, height: 50)
            .background(FieldTheme.water.opacity(0.1), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(record.site.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                WorkflowSyncLine(workflow: record.workflow, sync: record.sync)
            }
            Spacer(minLength: FieldTheme.xs)
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
                .padding(.top, 15)
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
