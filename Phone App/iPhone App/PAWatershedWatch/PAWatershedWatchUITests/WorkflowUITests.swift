import XCTest

/// End-to-end collector workflow against the local Firebase Emulator Suite (Auth, Firestore with the
/// repository rules, and Functions for validation and the display-name callable). Never touches the
/// live project: the app is launched with `-PWWUseFirebaseEmulators YES`, which only DEBUG builds honor.
///
/// Run with `bash scripts/dev.sh ios-ui`, which starts the emulators, seeds the TEST site fixtures,
/// grants location, and resets the app so onboarding starts fresh.
@MainActor
final class WorkflowUITests: XCTestCase {
    private let projectID = "central-pa-watershed-dev"
    private let siteID = "site-test-001"
    private var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments += ["-PWWUseFirebaseEmulators", "YES"]
        addUIInterruptionMonitor(withDescription: "Location permission") { alert in
            for label in ["Allow While Using App", "Allow Once", "Allow"] where alert.buttons[label].exists {
                alert.buttons[label].tap()
                return true
            }
            return false
        }
        try await requireEmulator()
    }

    func testFirstRunThroughSubmissionAndCorrectionRevision() async throws {
        app.launch()
        let email = "collector-\(UUID().uuidString.prefix(8).lowercased())@example.test"

        // A session restored from the simulator keychain (an earlier run) is signed out first, so this
        // always exercises a first run: Welcome → create account with a real name.
        signOutIfRestored()
        if app.buttons["welcome.continue"].waitForExistence(timeout: 5) {
            snapshot("01-welcome")
            app.buttons["welcome.continue"].tap()
        }
        XCTAssertTrue(app.buttons["auth.submit"].waitForExistence(timeout: 10))
        // Safety: never create an account unless the app proves it is on the local emulators.
        XCTAssertTrue(app.staticTexts["Local Firebase emulators"].exists, "App is not in emulator mode; refusing to create an account")
        snapshot("02-sign-in")
        app.segmentedControls.buttons["Create Account"].tap()
        type("Maya Chen", into: app.textFields["Full name"])
        type(email, into: app.textFields["Email"])
        typePassword("field-sample-2026", into: app.secureTextFields["Password"])
        snapshot("03-create-account")
        app.buttons["auth.submit"].tap()

        // Home, with the account control top-right and no Account tab.
        let start = app.buttons["Start New Observation"]
        XCTAssertTrue(start.waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["Account and settings"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.tabBars.buttons["Account"].exists)
        snapshot("04-home")
        start.tap()

        // Site picker: search, select from the list, continue.
        let site = app.buttons["site.\(siteID)"]
        XCTAssertTrue(site.waitForExistence(timeout: 20))
        snapshot("05-site-picker")
        type("Houserville", into: app.textFields["site.search"])
        XCTAssertTrue(site.waitForExistence(timeout: 5))
        site.tap()
        // Selecting a result closes search; wait for the keyboard to finish leaving.
        let keyboardGone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "count == 0"), object: app.keyboards)
        _ = await XCTWaiter().fulfillment(of: [keyboardGone], timeout: 5)
        app.buttons["site.continue"].tap()

        // Visit details: GPS from the simulated location.
        XCTAssertTrue(app.navigationBars["Visit Details"].waitForExistence(timeout: 5), "Continue did not open Visit Details")
        let next = app.buttons["flow.next"]
        XCTAssertTrue(next.waitForExistence(timeout: 10))
        waitForSiteDistance()
        snapshot("06-visit-details")
        next.tap()

        // One method choice; instrument details are not invented or required.
        app.buttons["method.type.fieldInstrument"].tap()
        XCTAssertFalse(app.textFields["method.source"].exists)
        snapshot("07-method")
        next.tap()

        // Measurements: only contract-enabled parameters are offered.
        for label in ["Weather Conditions", "Water Color", "Flow Condition"] {
            let picker = app.buttons["observations.\(label)"]
            XCTAssertTrue(picker.waitForExistence(timeout: 5))
            picker.tap()
            app.buttons["Unknown"].tap()
        }
        let temperature = app.textFields["measurement.temperature"]
        XCTAssertTrue(temperature.waitForExistence(timeout: 5))
        XCTAssertFalse(app.textFields["measurement.turbidity"].exists)
        XCTAssertFalse(app.textFields["measurement.salinity"].exists)
        type("18.5", into: temperature)
        snapshot("08-measurements-keyboard")
        dismissKeyboard()
        next.tap()

        // Notes.
        let notes = app.textViews["notes.editor"]
        XCTAssertTrue(notes.waitForExistence(timeout: 5))
        type("Clear flow after overnight rain.", into: notes)
        snapshot("09-notes-keyboard")
        dismissKeyboard()
        next.tap()

        // Review and submit.
        XCTAssertTrue(app.staticTexts["Ready to submit"].waitForExistence(timeout: 5))
        snapshot("10-review")
        app.buttons["review.submit"].tap()
        app.alerts.buttons["Submit"].tap()
        XCTAssertTrue(app.buttons["status.done"].waitForExistence(timeout: 10))
        let received = NSPredicate(format: "label BEGINSWITH 'Waiting for review' OR label BEGINSWITH 'Pending Review' OR label BEGINSWITH 'Submitted' OR label BEGINSWITH 'Validating'")
        XCTAssertTrue(app.staticTexts.containing(received).firstMatch.waitForExistence(timeout: 30))
        snapshot("11-status")
        app.buttons["status.done"].tap()

        // The QC Console's real review API, running against the emulators, requests a correction.
        // A collector who discovers the URL is refused by the server; only the provisioned reviewer
        // (QC_REVIEWER claim plus an active profile) can decide. The phone receives it by listener.
        let submission = try await waitForSubmission(status: ["PENDING_REVIEW"])
        let submissionPath = submission.name
        let submissionID = String(submissionPath.split(separator: "/").last ?? "")
        let firstRevisionID = try XCTUnwrap(submission.string("current_revision_id"))
        let collectorToken = try await signIn(email: email, password: "field-sample-2026")
        let refused = try await review(submissionID, decision: "APPROVE", revisionID: firstRevisionID, reason: nil, token: collectorToken)
        XCTAssertEqual(refused, 403, "A collector account must not be able to review")
        let reviewerToken = try await reviewerIDToken()
        let requested = try await review(submissionID, decision: "NEEDS_CORRECTION", revisionID: firstRevisionID, reason: "Please confirm water temperature against your thermometer log.", token: reviewerToken)
        XCTAssertEqual(requested, 200)

        app.tabBars.buttons["Observations"].tap()
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS 'Houserville'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Needs Correction"].waitForExistence(timeout: 20))
        row.tap()
        let correct = app.buttons["detail.correct"]
        XCTAssertTrue(correct.waitForExistence(timeout: 10))
        snapshot("12-correction-requested")
        correct.tap()

        let correctedTemperature = app.textFields["measurement.temperature"]
        XCTAssertTrue(correctedTemperature.waitForExistence(timeout: 5))
        correctedTemperature.tap()
        correctedTemperature.doubleTap()
        correctedTemperature.typeText(XCUIKeyboardKey.delete.rawValue + "18.2")
        snapshot("13a-correction-keyboard")
        dismissKeyboard()
        type("Checked the thermometer log; 18.2 °C was recorded.", into: app.textViews["correction.note"].exists ? app.textViews["correction.note"] : app.textFields["correction.note"])
        dismissKeyboard()
        snapshot("13-correction-revision")
        app.buttons["correction.resubmit"].tap()
        app.alerts.buttons["Resubmit Revision 2"].tap()
        XCTAssertTrue(app.buttons["status.done"].waitForExistence(timeout: 10))
        snapshot("14-revision-status")

        // Archive check: revision 2 is current, revision 1 is unchanged.
        let corrected = try await waitForSubmission(status: ["RESUBMITTED", "VALIDATING", "PENDING_REVIEW"], path: submissionPath)
        XCTAssertEqual(corrected.integer("current_revision_no"), 2)
        XCTAssertNotEqual(corrected.string("current_revision_id"), firstRevisionID)
        let revisions = try await listDocuments("\(submissionPath)/revisions")
        XCTAssertEqual(revisions.count, 2)
        let original = try XCTUnwrap(revisions.first { $0.name.hasSuffix(firstRevisionID) })
        XCTAssertEqual(original.double("temp_entered_value"), 18.5)
        XCTAssertEqual(original.string("revision_status"), "SUBMITTED")
        XCTAssertEqual(original.string("data_collected_by"), "Maya Chen")
        let second = try XCTUnwrap(revisions.first { !$0.name.hasSuffix(firstRevisionID) })
        XCTAssertEqual(second.double("temp_entered_value"), 18.2)
        XCTAssertEqual(second.integer("revision_no"), 2)

        // The reviewer sees revision 2 and approves it through the same API; the phone follows.
        let pending = try await waitForSubmission(status: ["PENDING_REVIEW"], path: submissionPath)
        let secondRevisionID = try XCTUnwrap(pending.string("current_revision_id"))
        XCTAssertNotEqual(secondRevisionID, firstRevisionID)
        let approvedStatus = try await review(submissionID, decision: "APPROVE", revisionID: secondRevisionID, reason: nil, token: reviewerToken)
        XCTAssertEqual(approvedStatus, 200)
        _ = try await waitForSubmission(status: ["APPROVED"], path: submissionPath, timeout: 15)
        let unchanged = try await listDocuments("\(submissionPath)/revisions")
        XCTAssertEqual(unchanged.first { $0.name.hasSuffix(firstRevisionID) }?.double("temp_entered_value"), 18.5)
        app.buttons["status.done"].tap()
        XCTAssertTrue(app.staticTexts["Approved"].waitForExistence(timeout: 20), "The phone should show the reviewer's approval")
        snapshot("15-approved")
    }

    /// Verification refresh must keep the existing UID and let only the trusted server initialize
    /// collector membership. Applying the email action is isolated to the local Auth emulator.
    func testEmailVerificationRefreshPreservesIdentity() async throws {
        app.launch()
        signOutIfRestored()
        if app.buttons["welcome.continue"].waitForExistence(timeout: 5) { app.buttons["welcome.continue"].tap() }
        XCTAssertTrue(app.buttons["auth.submit"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Local Firebase emulators"].exists)
        let email = "verify-\(UUID().uuidString.prefix(8).lowercased())@example.test"
        app.segmentedControls.buttons["Create Account"].tap()
        type("River Jordan", into: app.textFields["Full name"])
        type(email, into: app.textFields["Email"])
        typePassword("field-sample-2026", into: app.secureTextFields["Password"])
        app.buttons["auth.submit"].tap()
        XCTAssertTrue(app.buttons["Account and settings"].waitForExistence(timeout: 20))
        app.buttons["Start New Observation"].tap()
        let site = app.buttons["site.\(siteID)"]
        XCTAssertTrue(site.waitForExistence(timeout: 20))
        site.tap()
        app.buttons["site.continue"].tap()
        XCTAssertTrue(app.navigationBars["Visit Details"].waitForExistence(timeout: 5))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Resume"].waitForExistence(timeout: 15))
        app.buttons["Account and settings"].tap()

        let refresh = app.buttons["account.refreshVerification"]
        XCTAssertTrue(refresh.waitForExistence(timeout: 5))
        refresh.tap()
        XCTAssertTrue(app.alerts.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'Your email is not verified yet'")).firstMatch.waitForExistence(timeout: 10))
        app.alerts.buttons["OK"].tap()
        app.buttons["account.resendVerification"].tap()
        XCTAssertTrue(app.alerts.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'Verification email sent'")).firstMatch.waitForExistence(timeout: 10))
        app.alerts.buttons["OK"].tap()
        snapshot("verification-pending")

        let (_, before) = try await postJSON(URL(string: "\(authBase)/projects/\(projectID)/accounts:lookup")!, body: ["email": [email]], bearer: "owner")
        let original = try XCTUnwrap((before["users"] as? [[String: Any]])?.first)
        let uid = try XCTUnwrap(original["localId"] as? String)
        XCTAssertEqual(original["emailVerified"] as? Bool, false)
        let actions = try await send(URL(string: "http://127.0.0.1:9099/emulator/v1/projects/\(projectID)/oobCodes")!)
        let code = try XCTUnwrap((actions["oobCodes"] as? [[String: Any]])?.last(where: {
            $0["email"] as? String == email && $0["requestType"] as? String == "VERIFY_EMAIL"
        })?["oobCode"] as? String)
        let (applied, _) = try await postJSON(URL(string: "\(authBase)/accounts:update?key=emulator")!, body: ["oobCode": code], bearer: nil)
        XCTAssertEqual(applied, 200)
        refresh.tap()
        XCTAssertTrue(app.alerts.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'Email verified. Your collector profile'")).firstMatch.waitForExistence(timeout: 15))
        app.alerts.buttons["OK"].tap()
        XCTAssertFalse(app.buttons["account.refreshVerification"].exists)
        snapshot("verification-complete")

        let (_, after) = try await postJSON(URL(string: "\(authBase)/projects/\(projectID)/accounts:lookup")!, body: ["email": [email]], bearer: "owner")
        let current = try XCTUnwrap((after["users"] as? [[String: Any]])?.first)
        XCTAssertEqual(current["localId"] as? String, uid)
        XCTAssertEqual(current["emailVerified"] as? Bool, true)
        XCTAssertNil(current["customAttributes"], "Self-service verification must not grant role claims")
        let profile = try await send(URL(string: "\(base)/users/\(uid)")!)
        let fields = try XCTUnwrap(profile["fields"] as? [String: [String: Any]])
        XCTAssertEqual(fields["role"]?["stringValue"] as? String, "COLLECTOR")
        XCTAssertEqual(fields["verified_email"]?["stringValue"] as? String, email)
        XCTAssertEqual(fields["display_name"]?["stringValue"] as? String, "River Jordan")
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Resume"].waitForExistence(timeout: 5), "Verification must preserve the collector's draft")
        XCTAssertTrue(app.staticTexts["Spring Creek at Houserville Road Bridge"].exists)
        app.buttons["Resume"].tap()
        XCTAssertTrue(app.navigationBars["Visit Details"].waitForExistence(timeout: 5))
    }

    func testDeferredLaboratoryResultsStayOnSameSamplingRecord() async throws {
        app.launch()
        signOutIfRestored()
        if app.buttons["welcome.continue"].waitForExistence(timeout: 5) { app.buttons["welcome.continue"].tap() }
        XCTAssertTrue(app.buttons["auth.submit"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Local Firebase emulators"].exists)
        let email = "lab-\(UUID().uuidString.prefix(8).lowercased())@example.test"
        app.segmentedControls.buttons["Create Account"].tap()
        type("Taylor Reed", into: app.textFields["Full name"])
        type(email, into: app.textFields["Email"])
        typePassword("field-sample-2026", into: app.secureTextFields["Password"])
        app.buttons["auth.submit"].tap()
        XCTAssertTrue(app.buttons["Start New Observation"].waitForExistence(timeout: 20))
        let (_, account) = try await postJSON(URL(string: "\(authBase)/projects/\(projectID)/accounts:lookup")!, body: ["email": [email]], bearer: "owner")
        let uid = try XCTUnwrap((account["users"] as? [[String: Any]])?.first?["localId"] as? String)
        app.buttons["Start New Observation"].tap()
        let site = app.buttons["site.\(siteID)"]
        XCTAssertTrue(site.waitForExistence(timeout: 20))
        site.tap()
        app.buttons["site.continue"].tap()
        XCTAssertTrue(app.buttons["flow.next"].waitForExistence(timeout: 10))
        waitForSiteDistance()
        app.buttons["flow.next"].tap()
        app.buttons["method.type.fieldInstrument"].tap()
        app.buttons["flow.next"].tap()
        // An untouched visual form must not advance; no numeric value is needed once these are set.
        app.buttons["flow.next"].tap()
        XCTAssertTrue(app.navigationBars["Measurements"].exists)
        for label in ["Weather Conditions", "Water Color", "Flow Condition"] {
            app.buttons["observations.\(label)"].tap()
            app.buttons["Unknown"].tap()
        }
        reveal(app.switches["lab.pending"])
        setLabPending(true)
        app.buttons["flow.next"].tap()
        app.buttons["flow.next"].tap()
        XCTAssertTrue(app.buttons["review.submit"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["review.submit"].isEnabled, "Unfinished lab work must not submit")
        snapshot("lab-review-blocked")
        app.navigationBars.buttons.firstMatch.tap()
        app.navigationBars.buttons.firstMatch.tap()
        reveal(app.buttons["lab.saveFieldCollection"])
        app.buttons["lab.saveFieldCollection"].tap()
        XCTAssertTrue(app.buttons["Resume"].waitForExistence(timeout: 5))
        let saved = try await waitForSubmission(status: ["DRAFT"], ownerUID: uid)
        let revisionID = try XCTUnwrap(saved.string("current_revision_id"))
        let draftRevisions = try await listDocuments("\(saved.name)/revisions")
        let first = try XCTUnwrap(draftRevisions.first)
        XCTAssertEqual(first.string("collection_stage"), "LAB_PENDING")
        XCTAssertEqual(first.string("revision_status"), "DRAFT")
        snapshot("lab-field-saved")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["Resume"].waitForExistence(timeout: 15))
        app.buttons["Resume"].tap()
        XCTAssertTrue(app.navigationBars["Measurements"].waitForExistence(timeout: 5))
        reveal(app.switches["lab.pending"])
        XCTAssertEqual(app.switches["lab.pending"].value as? String, "1")
        setLabPending(false)
        let chloride = app.textFields["measurement.chloride"]
        reveal(chloride)
        type("12.5", into: chloride)
        dismissKeyboard()
        let method = app.textFields["analysis.chloride.method"]
        reveal(method)
        type("Ion chromatography — emulator fixture", into: method)
        dismissKeyboard()
        XCTAssertEqual(app.keyboards.count, 0, "Done must dismiss the lab method keyboard")
        let analysisTime = app.buttons["Use the time shown for Chloride analysis"]
        reveal(analysisTime)
        analysisTime.tap()
        snapshot("lab-result-completed")
        app.buttons["flow.next"].tap()
        app.buttons["flow.next"].tap()
        XCTAssertTrue(app.staticTexts["Ready to submit"].waitForExistence(timeout: 5))
        app.buttons["review.submit"].tap()
        app.alerts.buttons["Submit"].tap()
        let pending = try await waitForSubmission(status: ["PENDING_REVIEW"], path: saved.name)
        XCTAssertEqual(pending.string("current_revision_id"), revisionID)
        XCTAssertEqual(pending.string("event_id"), saved.string("event_id"))
        XCTAssertEqual(pending.integer("current_revision_no"), 1)
        let revisions = try await listDocuments("\(saved.name)/revisions")
        XCTAssertEqual(revisions.count, 1)
        XCTAssertEqual(revisions.first?.string("collection_stage"), "LAB_COMPLETED")
        XCTAssertNil(revisions.first?.double("temp_c"), "Blank temperature must remain absent")
        let measurements = try await listDocuments("\(saved.name)/revisions/\(revisionID)/measurements")
        XCTAssertEqual(measurements.count, 1, "Only the entered laboratory measurement should exist")
        XCTAssertEqual(measurements.first?.string("parameter_code"), "CHLORIDE_MG_L")
        XCTAssertEqual(measurements.first?.double("entered_value"), 12.5)
        XCTAssertEqual(measurements.first?.string("analysis_stage"), "LAB")
        XCTAssertEqual(measurements.first?.string("method_name"), "Ion chromatography — emulator fixture")
        XCTAssertNotNil(measurements.first?.fields["analyzed_at"]?["timestampValue"])
        snapshot("lab-submitted")
    }

    /// First run through Method at an accessibility text size: every primary action must stay reachable.
    func testLargeTextFirstRunKeepsActionsReachable() async throws {
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityL"]
        app.launch()
        signOutIfRestored()
        if app.buttons["welcome.continue"].waitForExistence(timeout: 5) {
            snapshot("ax-01-welcome")
            XCTAssertTrue(app.buttons["welcome.continue"].isHittable)
            app.buttons["welcome.continue"].tap()
        }
        XCTAssertTrue(app.buttons["auth.submit"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Local Firebase emulators"].exists, "App is not in emulator mode; refusing to create an account")
        app.segmentedControls.buttons["Create Account"].tap()
        type("Ada Reyes", into: app.textFields["Full name"])
        type("ax-\(UUID().uuidString.prefix(8).lowercased())@example.test", into: app.textFields["Email"])
        typePassword("field-sample-2026", into: app.secureTextFields["Password"])
        dismissKeyboard()
        snapshot("ax-02-create-account")
        app.buttons["auth.submit"].tap()

        let start = app.buttons["Start New Observation"]
        XCTAssertTrue(start.waitForExistence(timeout: 20))
        snapshot("ax-03-home")
        XCTAssertTrue(start.isHittable)
        start.tap()
        let site = app.buttons["site.\(siteID)"]
        XCTAssertTrue(site.waitForExistence(timeout: 20))
        site.tap()
        // The footer gives the selected site's full name its own wrapping line at accessibility sizes.
        let footerName = app.staticTexts["Selected site, Spring Creek at Houserville Road Bridge"]
        XCTAssertTrue(footerName.waitForExistence(timeout: 5))
        XCTAssertTrue(app.frame.contains(footerName.frame), "The selected site name must stay on screen")
        snapshot("ax-04-site-picker")
        XCTAssertTrue(app.buttons["site.continue"].isHittable)
        app.buttons["site.continue"].tap()
        let next = app.buttons["flow.next"]
        XCTAssertTrue(next.waitForExistence(timeout: 10))
        // Visit Details correctly blocks until a GPS fix exists.
        waitForSiteDistance()
        snapshot("ax-05-visit-details")
        XCTAssertTrue(next.isHittable)
        next.tap()
        XCTAssertTrue(app.buttons["method.type.fieldInstrument"].waitForExistence(timeout: 5))
        app.buttons["method.type.fieldInstrument"].tap()
        snapshot("ax-06-method")
        XCTAssertTrue(app.buttons["flow.next"].isHittable)
    }

    /// Account: the name can be changed and reaches the research profile through the callable; a draft
    /// survives the app being terminated and relaunched.
    func testNameChangeAndDraftSurvivesRelaunch() async throws {
        app.launch()
        signOutIfRestored()
        if app.buttons["welcome.continue"].waitForExistence(timeout: 5) { app.buttons["welcome.continue"].tap() }
        XCTAssertTrue(app.buttons["auth.submit"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Local Firebase emulators"].exists, "App is not in emulator mode; refusing to create an account")
        app.segmentedControls.buttons["Create Account"].tap()
        type("Sam Ortiz", into: app.textFields["Full name"])
        type("name-\(UUID().uuidString.prefix(8).lowercased())@example.test", into: app.textFields["Email"])
        typePassword("field-sample-2026", into: app.secureTextFields["Password"])
        app.buttons["auth.submit"].tap()
        XCTAssertTrue(app.buttons["Start New Observation"].waitForExistence(timeout: 20))

        // Change the name in Account.
        XCTAssertTrue(app.buttons["Account and settings"].waitForExistence(timeout: 5))
        app.buttons["Account and settings"].tap()
        XCTAssertTrue(app.navigationBars["Account"].waitForExistence(timeout: 5))
        snapshot("20-account")
        app.buttons.containing(NSPredicate(format: "label BEGINSWITH 'Full name'")).firstMatch.tap()
        let field = app.textFields["Full name"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 20) + "Samantha Ortiz")
        snapshot("21-edit-name")
        app.navigationBars.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Samantha Ortiz"].waitForExistence(timeout: 15))
        app.navigationBars["Account"].buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["Samantha Ortiz"].waitForExistence(timeout: 5), "Home should show the new name")

        // The research profile mirror was written by the server callable, not by the client.
        let profiles = try await listDocuments("users")
        XCTAssertTrue(profiles.contains { $0.string("display_name") == "Samantha Ortiz" }, "users/{uid}.display_name was not updated by the callable")

        // Start a draft, pick a site, then terminate and relaunch.
        app.buttons["Start New Observation"].tap()
        let site = app.buttons["site.\(siteID)"]
        XCTAssertTrue(site.waitForExistence(timeout: 20))
        site.tap()
        app.buttons["site.continue"].tap()
        XCTAssertTrue(app.navigationBars["Visit Details"].waitForExistence(timeout: 5))
        app.terminate()
        app.launch()
        let resume = app.buttons["Resume"]
        XCTAssertTrue(resume.waitForExistence(timeout: 15), "Draft was not restored after relaunch")
        XCTAssertTrue(app.staticTexts["Spring Creek at Houserville Road Bridge"].exists)
        snapshot("22-draft-restored")
        resume.tap()
        XCTAssertTrue(app.navigationBars["Visit Details"].waitForExistence(timeout: 5) || app.navigationBars["Choose Site"].waitForExistence(timeout: 2))
    }

    // MARK: - UI helpers

    private func reveal(_ element: XCUIElement) {
        for _ in 0..<14 {
            if element.exists {
                let top = app.navigationBars.firstMatch.frame.maxY
                let footer = app.buttons["flow.next"]
                let bottom = footer.exists ? footer.frame.minY - 72 : app.frame.maxY
                if element.isHittable && element.frame.minY >= top && element.frame.maxY <= bottom { return }
                if element.frame.minY < top { app.swipeDown(); continue }
            }
            app.swipeUp()
        }
        XCTAssertTrue(element.exists && element.isHittable, "Could not reveal \(element)")
    }

    private func setLabPending(_ pending: Bool) {
        let toggle = app.switches["lab.pending"]
        reveal(toggle)
        if toggle.value as? String != (pending ? "1" : "0") {
            // A SwiftUI switch's accessibility frame includes its label; touch the actual thumb.
            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.93, dy: 0.5)).tap()
        }
        XCTAssertEqual(toggle.value as? String, pending ? "1" : "0")
    }

    private func type(_ text: String, into element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 5), "Missing \(element)")
        focus(element)
        dismissKeyboardTip()
        element.typeText(text)
        if !((element.value as? String) ?? "").contains(text) {
            // One retry if a system overlay took the first keystrokes.
            dismissKeyboardTip()
            element.tap()
            element.typeText(text)
        }
        XCTAssertTrue(((element.value as? String) ?? "").contains(text), "Typed text did not reach \(element)")
    }

    /// A tap can land while a just-closed menu is still animating away (the visual-observation
    /// selectors sit right above the measurements), so wait for the keyboard and tap again if needed.
    private func focus(_ element: XCUIElement) {
        for _ in 0..<3 {
            // The bottom action bar (step label + primary button) floats over the scrolling form, so a
            // field near the bottom can be covered: scroll it up into the open area before tapping.
            let bar = app.buttons["flow.next"]
            if bar.exists, element.frame.maxY > bar.frame.minY - 72 { app.swipeUp() }
            element.tap()
            if app.keyboards.firstMatch.waitForExistence(timeout: 2) { return }
        }
        XCTFail("\(element) never received keyboard focus")
    }

    /// Waits for Visit Details to show the GPS distance. The simulator occasionally reports an
    /// unavailable fix on a fresh launch; the app offers Reacquire GPS for exactly that, so use it once.
    private func waitForSiteDistance() {
        let distance = app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'from the site location'")).firstMatch
        if distance.waitForExistence(timeout: 20) { return }
        let reacquire = app.buttons.containing(NSPredicate(format: "label CONTAINS 'Reacquire GPS'")).firstMatch
        XCTAssertTrue(reacquire.waitForExistence(timeout: 2), "No GPS fix and no Reacquire GPS action")
        reacquire.tap()
        XCTAssertTrue(distance.waitForExistence(timeout: 20), "GPS fix did not arrive after Reacquire GPS")
    }

    /// Signed simulator builds offer an automatic strong password on `.newPassword` fields; decline it
    /// so the test's own value is typed, then verify the field received every character.
    private func typePassword(_ text: String, into element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 5))
        element.tap()
        if app.buttons["GenerateStrongPasswordButton"].waitForExistence(timeout: 2) {
            app.buttons["xmark"].tap()
            element.tap()
        }
        element.typeText(text)
        if app.buttons["GenerateStrongPasswordButton"].exists {
            // The sheet can appear after the first keystroke; close it and type the value again.
            app.buttons["xmark"].tap()
            element.tap()
            element.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 40) + text)
        }
        XCTAssertEqual((element.value as? String)?.count, text.count, "Password field did not receive the full value")
    }

    /// A fresh simulator shows a one-time "slide to type" keyboard tip that covers the screen.
    private func dismissKeyboardTip() {
        let tip = app.buttons["Continue"]
        if tip.waitForExistence(timeout: 1) && app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'sliding your finger'")).firstMatch.exists {
            tip.tap()
        }
    }

    private func dismissKeyboard() {
        let done = app.buttons["keyboard.done"]
        if done.exists { done.tap() } else if app.keyboards.count > 0 { app.scrollViews.firstMatch.swipeDown() }
    }

    private func signOutIfRestored() {
        let firstScreens = [app.buttons["welcome.continue"], app.buttons["auth.submit"], app.buttons["identity.confirm"], app.buttons["Account and settings"]]
        let deadline = Date().addingTimeInterval(15)
        while Date() < deadline && !firstScreens.contains(where: \.exists) { usleep(250_000) }
        if app.buttons["identity.confirm"].exists {
            app.buttons["Not you? Sign Out"].tap()
            return
        }
        let account = app.buttons["Account and settings"]
        guard account.exists else { return }
        account.tap()
        let signOut = app.buttons["Sign Out"]
        XCTAssertTrue(app.navigationBars["Account"].waitForExistence(timeout: 5))
        for _ in 0..<8 where !signOut.isHittable { app.swipeUp() }
        signOut.tap()
        app.alerts.buttons["Sign Out"].tap()
    }

    private func snapshot(_ name: String) {
        // Let keyboard and navigation animations finish so the capture shows the settled layout.
        usleep(900_000)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // MARK: - QC Console review API and Auth emulator (emulator only)

    private let qcBase = "http://127.0.0.1:3109"
    private let authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
    private let reviewerEmail = "test.qc.reviewer@emulator.invalid"

    private func postJSON(_ url: URL, body: [String: Any], bearer: String?) async throws -> (Int, [String: Any]) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        return ((response as? HTTPURLResponse)?.statusCode ?? 0, (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:])
    }

    private func signIn(email: String, password: String) async throws -> String {
        let (status, json) = try await postJSON(URL(string: "\(authBase)/accounts:signInWithPassword?key=emulator")!, body: ["email": email, "password": password, "returnSecureToken": true], bearer: nil)
        XCTAssertEqual(status, 200, "Auth emulator sign-in failed for \(email)")
        return try XCTUnwrap(json["idToken"] as? String)
    }

    /// The reviewer identity comes from provision_test_users.mjs, which never sets a password; the
    /// emulator's owner access gives it a local one for this run.
    private func reviewerIDToken() async throws -> String {
        let (_, lookup) = try await postJSON(URL(string: "\(authBase)/projects/\(projectID)/accounts:lookup")!, body: ["email": [reviewerEmail]], bearer: "owner")
        let uid = try XCTUnwrap((lookup["users"] as? [[String: Any]])?.first?["localId"] as? String, "Run `bash scripts/dev.sh ios-ui`, which provisions the emulator reviewer")
        let password = "review-\(UUID().uuidString.prefix(8))"
        let (updated, _) = try await postJSON(URL(string: "\(authBase)/projects/\(projectID)/accounts:update")!, body: ["localId": uid, "password": password], bearer: "owner")
        XCTAssertEqual(updated, 200)
        return try await signIn(email: reviewerEmail, password: password)
    }

    private func review(_ submissionID: String, decision: String, revisionID: String, reason: String?, token: String) async throws -> Int {
        var body: [String: Any] = ["decision": decision, "expectedRevisionId": revisionID]
        if let reason { body["reason"] = reason }
        let (status, _) = try await postJSON(URL(string: "\(qcBase)/api/submissions/\(submissionID)/review")!, body: body, bearer: token)
        return status
    }

    // MARK: - Firestore emulator (owner access bypasses rules; emulator only)

    private struct Document {
        let name: String
        let fields: [String: [String: Any]]
        func string(_ key: String) -> String? { fields[key]?["stringValue"] as? String }
        func integer(_ key: String) -> Int? { (fields[key]?["integerValue"] as? String).flatMap(Int.init) }
        func double(_ key: String) -> Double? {
            (fields[key]?["doubleValue"] as? Double) ?? (fields[key]?["integerValue"] as? String).flatMap(Double.init)
        }
    }

    private var base: String { "http://127.0.0.1:8080/v1/projects/\(projectID)/databases/(default)/documents" }

    private func requireEmulator() async throws {
        var request = URLRequest(url: URL(string: "http://127.0.0.1:8080/")!, timeoutInterval: 3)
        request.httpMethod = "GET"
        do { _ = try await URLSession.shared.data(for: request) } catch {
            throw XCTSkip("Firestore emulator is not running on 127.0.0.1:8080; run `bash scripts/dev.sh ios-ui`.")
        }
        do { _ = try await URLSession.shared.data(for: URLRequest(url: URL(string: "\(qcBase)/review")!, timeoutInterval: 5)) } catch {
            throw XCTSkip("The QC Console is not running on \(qcBase); run `bash scripts/dev.sh ios-ui`.")
        }
    }

    private func send(_ url: URL, method: String = "GET", body: [String: Any]? = nil) async throws -> [String: Any] {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer owner", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200, String(decoding: data, as: UTF8.self))
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func listDocuments(_ path: String) async throws -> [Document] {
        let relative = path.components(separatedBy: "/documents/").last ?? path
        let json = try await send(URL(string: "\(base)/\(relative)")!)
        return (json["documents"] as? [[String: Any]] ?? []).map {
            Document(name: $0["name"] as? String ?? "", fields: $0["fields"] as? [String: [String: Any]] ?? [:])
        }
    }


    private func waitForSubmission(status: Set<String>, path: String? = nil, ownerUID: String? = nil, timeout: TimeInterval = 45) async throws -> Document {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let candidates = try await listDocuments("submissions")
                .filter { $0.string("site_id") == siteID && (path == nil || $0.name == path) && (ownerUID == nil || $0.string("collector_user_id") == ownerUID) }
            if let match = candidates.first(where: { status.contains($0.string("status") ?? "") }) { return match }
            try await Task.sleep(for: .seconds(1))
        }
        XCTFail("Submission did not reach \(status) within \(Int(timeout)) s; is the Functions emulator running?")
        throw CancellationError()
    }
}
