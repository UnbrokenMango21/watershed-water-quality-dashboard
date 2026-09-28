# Physical iPhone Happy Path Runbook — 2026-09-28

This runbook guides a human operator through the complete end-to-end lifecycle of a **single real observation**: from physical iPhone collection to automated validation, QC reviewer inspection, immutable correction revision (if needed), authorized human approval, server publication, and public dashboard verification.

---

## Architectural invariants & operating rules

1. **Revisions are immutable**: Submitted scientific revisions cannot be modified. If correction is needed, the collector submits Revision N+1, which preserves Revision N in the record unchanged.
2. **Client trust boundary**: Collector clients author only raw submissions and revisions. Validation flags, review decisions, confidence scores, publication leases, and publication status are strictly server-authored.
3. **Mandatory measurement**: Water Temperature is the only mandatory measurement. All entered values and units are preserved alongside canonical values.
4. **Active reviewer profile gate**: Reviewer reads and review decisions require an active, administrator-provisioned reviewer profile in Firestore (`users/{uid}` with `role: "QC_REVIEWER"` or `"ADMIN"` and `active: true`).
5. **Approved-only publication**: Only the current human-approved revision (`reviewed_revision_id == current_revision_id == revision.revision_id`) is eligible to publish. Approval is distinct from publication success.
6. **Privacy fail-closed**: Collector identities, reviewer identities, field notes, GPS accuracy, and internal workflow IDs are never published to public views or public dashboards.

---

## Phase 1: Physical iPhone install & collector authentication

### Action 1.1: Install release build via TestFlight
* **Operator action**:
  1. Open Apple TestFlight on the designated physical iPhone.
  2. Locate **PA Watershed Watch**.
  3. Verify build metadata: Marketing Version `1.0.0`, Build `17`, Bundle Identifier `org.centralpawatershed.mobile`.
  4. Tap **Install** or **Update**. Launch the application.
* **Stop gate**: The app must launch without crashing. On first launch, the Welcome screen ("Welcome to PA Watershed Watch") must appear.
* **Evidence to record**:
  * iPhone device model and iOS version
  * Installed build number and timestamp
  * Screenshot of the Welcome screen

### Action 1.2: Sign in & confirm collector identity
* **Operator action**:
  1. From the Welcome screen, tap **Get Started** to navigate to Sign In.
  2. Sign in with the designated human collector account (Email/Password or Continue with Google).
  3. On the **Ready to collect** screen, confirm the collector's real full name (e.g., `"Jane Doe"`).
  4. Tap **Confirm Name & Continue** to enter the Home view.
* **Stop gate**: The confirmed name must be a real person name (used as `data_collected_by` on submitted revisions). Email-fragment fallback is prohibited.
* **Evidence to record**:
  * Collector email and confirmed full name
  * Firestore collector UID (`users/{uid}`)
  * Screenshot of the Home view showing the account control

---

## Phase 2: Site selection & visit details

### Action 2.1: Choose official monitoring site
* **Operator action**:
  1. From Home, tap **Start New Observation**.
  2. On **Step 1: Choose Site**, allow location permissions when prompted.
  3. Search for or select the assigned monitoring site from the active catalog list or map pin.
  4. Verify site code, site name, county, and watershed name.
  5. Tap **Continue with This Site**.
* **Stop gate**: The selected site must exist in `siteCatalog` with `active == true`. Collectors cannot create, edit, or relocate sites.
* **Evidence to record**:
  * Selected `site_id`, `site_code`, and `site_name`
  * County and watershed display names

### Action 2.2: Capture visit details & GPS fix
* **Operator action**:
  1. On **Step 2: Visit Details**, verify the date and time in Eastern Time (`America/New_York`).
  2. Tap **Acquire GPS** (or allow automatic acquisition).
  3. Check the reported GPS accuracy (good ≤ 20 m) and distance from the cataloged site location.
  4. Tap **Continue to Method**.
* **Stop gate**: Continuing requires a valid GPS coordinate fix. Distance beyond site tolerance produces a non-blocking warning, not a hard stop.
* **Evidence to record**:
  * Observation timestamp (Eastern)
  * GPS coordinates (`latitude`, `longitude`)
  * GPS accuracy in meters and distance to site in meters

---

## Phase 3: Method, measurements, notes & submission

### Action 3.1: Specify measurement method & equipment
* **Operator action**:
  1. On **Step 3: Method**, answer "How was this observation measured?".
  2. Select the appropriate method choice (e.g., `Field instrument (in situ)` or `Field test kit / colorimetric`).
  3. Enter the specific method details: Instrument / Kit name (maps to `instrument_name`) and Procedure / Sample collection (maps to `method_name`).
  4. Tap **Continue to Measurements**.
* **Stop gate**: Selected test type must map to an approved protocol value.
* **Evidence to record**:
  * Selected `test_type`
  * Stored `instrument_name` and `method_name`

### Action 3.2: Enter water quality measurements
* **Operator action**:
  1. On **Step 4: Measurements**, enter the mandatory **Water Temperature** value and select unit (`°C` or `°F`).
  2. Enter any additional supported parameters measured (e.g., pH, Dissolved Oxygen, Specific Conductivity).
  3. Verify values satisfy hard scientific plausibility boundaries (e.g., temp −5 to 60 °C, pH 0 to 14).
  4. Tap **Continue to Notes**.
* **Stop gate**: Water Temperature is mandatory. The app must block continuation if temperature is missing or outside hard boundaries.
* **Evidence to record**:
  * Entered temperature value and unit (`temp_c` or `temp_f`)
  * All additional entered parameter codes, values, and units

### Action 3.3: Enter field notes & review draft
* **Operator action**:
  1. On **Step 5: Notes**, optionally enter field observations (weather, water clarity, flow conditions).
  2. Tap **Review Observation**.
  3. On **Step 6: Review**, verify the readiness card displays **Ready to submit** (green seal icon).
  4. Check every card: Site, Date/Time, Location, Method, Measurements, Field Notes, and Collector name.
* **Stop gate**: If the card shows **Must fix before submitting** (octagon icon), resolve the blocking issue before proceeding.
* **Evidence to record**:
  * Review screen status (`Ready to submit`)
  * Field notes text (if any)
  * Screenshot of the Review screen

### Action 3.4: Submit observation
* **Operator action**:
  1. Tap **Submit Observation**.
  2. When prompted with the confirmation dialog ("Submit observation? Revision 1 will be locked"), confirm submission.
  3. Observe the transition: Submission status changes from `Waiting to sync` to `Syncing` to `Synced`.
* **Stop gate**: Local draft is locked. Submission document created in Firestore with initial revision (`rev-001` or revision 1) in status `SUBMITTED`.
* **Evidence to record**:
  * Assigned `submission_id` and `revision_id`
  * Submission timestamp
  * SHA-256 `record_hash` from Firestore revision document

---

## Phase 4: Automated validation verification

### Action 4.1: Inspect server validation result
* **Operator action**:
  1. Via administrative read-only query, inspect `submissions/{submissionId}` and `submissions/{submissionId}/revisions/{revisionId}`.
  2. Verify the Firebase Cloud Function `validateSubmittedObservation` processed the document.
  3. Check the resulting submission status:
     * Clean observation: advances to `PENDING_REVIEW`.
     * Plausibility warning: advances to `PENDING_REVIEW` with warning flags.
     * Hard violation: advances to `NEEDS_CORRECTION` with error flags.
* **Stop gate**: Submission must NOT be authored into `APPROVED` or `PUBLISHED` by validation. Collector clients cannot bypass validation.
* **Evidence to record**:
  * Validation rules version (`validation_rules_version`)
  * Quality confidence score (`quality_score`)
  * Resulting status (`PENDING_REVIEW` or `NEEDS_CORRECTION`)
  * List of generated validation flag codes (if any)

---

## Phase 5: QC Console inspection & correction cycle

### Action 5.1: Reviewer sign-in to QC Console
* **Operator action**:
  1. Open the private QC Console (`https://qc-console-dev--central-pa-watershed-dev.us-central1.hosted.app/review`).
  2. Sign in with authorized reviewer credentials.
  3. Verify that the reviewer account holds an active profile (`users/{uid}` with role `QC_REVIEWER` or `ADMIN` and `active: true`).
* **Stop gate**: The console must refuse access or throw an authorization error if the user lacks an active reviewer profile.
* **Evidence to record**:
  * Reviewer email and Auth UID
  * Reviewer role confirmation

### Action 5.2 (Conditional): Request correction & submit Revision N+1
* **Operator action (only if correction is required)**:
  1. In QC Console, select the submission, enter a reviewer comment explaining the needed correction, and click **Request Correction**.
  2. Submission status transitions to `NEEDS_CORRECTION`.
  3. On the physical iPhone: open the app; navigate to the **Observations** tab; select the flagged submission.
  4. Tap **Create Correction Revision**.
  5. Inspect Revision 1 (read-only); make the required measurement correction; enter the mandatory explanation ("What did you check?").
  6. Tap **Resubmit as Revision N+1** (Revision 2).
* **Stop gate**: Revision 1 remains completely unchanged in Firestore. Revision 2 is created with `revision_no: 2` and `parent_revision_id: <rev-1-id>`. Automated validation executes on Revision 2.
* **Evidence to record**:
  * Reviewer correction request comment
  * Immutable Revision 1 record hash
  * New Revision 2 ID and submission timestamp

### Action 5.3: Authorized human approval
* **Operator action**:
  1. In the QC Console, open the current review-ready revision (`PENDING_REVIEW`).
  2. Review all scientific values, field methods, photos/notes, and validation confidence score.
  3. Click **Approve**.
  4. The backend API (`POST /api/submissions/{submissionId}/review`) verifies the reviewer's active profile and writes an approval transaction.
* **Stop gate**: Submission transitions to `APPROVED`. Verify Firestore invariants:
  * `current_revision_id == reviewed_revision_id`
  * `review_decision == "APPROVE"`
  * Revision document content is unchanged.
* **Evidence to record**:
  * Approval timestamp
  * Reviewer UID recorded on the review decision
  * Immutable review audit event document ID (`review-{revision_id}`)

---

## Phase 6: Approved-only ArcGIS publication

### Action 6.1: Verify publication trigger & authoritative write
* **Operator action**:
  1. Verify the publisher trigger `publishApprovedObservation` claims the approval.
  2. Inspect Firestore publication lease document `submissions/{submissionId}/publication/{revisionId}`:
     * `status: "PUBLISHING"` with active lease token
     * On completion: `status: "PUBLISHED"`, `published_at` timestamp recorded.
  3. Inspect private authoritative ArcGIS service `Central_PA_Watershed_Approved_Authoritative`:
     * Layer 0 (`SamplingSites`): site record updated with latest sample timestamp.
     * Layer 1 (`ApprovedObservations`): exactly one new feature created with public `observation_id` and collection geometry.
     * Layer 3 (`Measurements`): normalized measurement rows inserted, including `WATER_TEMP_C`.
     * Layer 2 (`LatestSiteConditions`): materialized row updated with newest approved observation.
* **Stop gate**: Publication must fail closed if the revision is unapproved, rejected, or non-current. Duplicate deliveries must be fenced by the lease token.
* **Evidence to record**:
  * Publication lease token and attempt count
  * Authoritative observation `GlobalID` and `OBJECTID`
  * Generated opaque public `observation_id`
  * Publication audit event ID (`publish-{revision_id}`)

---

## Phase 7: Public dashboard anonymous verification

### Action 7.1: Verify hosted public dashboard display
* **Operator action**:
  1. In a clean browser session (no credentials, incognito), navigate to the hosted public dashboard:  
     `https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/`
  2. **Header KPI Strip**:
     * Verify `Monitoring sites` count reflects the active site.
     * Verify `Latest sample` displays the date of the approved observation.
  3. **Site Browser**:
     * Verify the site appears in the list with status badge `"Reviewed"`.
     * Click the site row to select it.
  4. **Map Surface**:
     * Verify the site marker appears at the exact cataloged coordinates in brand Deep Water with Limestone halo.
     * Verify selecting the site highlights the intersecting USGS HUC-12 watershed boundary in brand Hemlock.
  5. **Site Details & Readings**:
     * Verify approved Water Temperature and all entered parameters render with canonical units.
     * Verify "Reviewed" completeness badge.
  6. **Time Series Graph**:
     * Switch to Time Series view.
     * Verify the newly published point appears on the trend line at the exact collection instant.
     * Click **CSV** export and verify the downloaded file contains public fields only.
* **Stop gate**: Fails closed if any private field (collector name, reviewer UID, submission ID, internal notes) is visible in the UI, network payloads, or exported CSV. Fails if demo mode or synthetic records appear.
* **Evidence to record**:
  * Screenshot of the public dashboard showing the selected site, map marker, and latest readings
  * Downloaded CSV export file
  * Anonymous REST query verification of the 4 public ArcGIS views showing the published record count
