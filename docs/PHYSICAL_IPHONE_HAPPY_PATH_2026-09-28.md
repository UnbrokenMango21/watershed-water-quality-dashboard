# Physical iPhone Happy Path Runbook — 2026-09-28

This runbook guides a human operator through the complete end-to-end lifecycle of a **single real observation**: from physical iPhone collection to automated validation, QC reviewer inspection, immutable correction revision (if needed), authorized human approval, server publication, and public dashboard verification.

---

## Architectural invariants & operating rules

1. **Revisions are immutable**: Submitted scientific revisions cannot be modified. If correction is needed, the collector submits Revision N+1, which preserves Revision N in the record unchanged.
2. **Client trust boundary**: Collector clients author only raw submissions and revisions. Validation flags, review decisions, confidence scores, publication leases, and publication status are strictly server-authored.
3. **Mandatory measurement**: Water Temperature is the only confirmed mandatory measurement. All entered values and units are preserved alongside canonical values (`config/production_measurement_catalog.json`).
4. **Active reviewer profile gate**: Reviewer reads and review decisions require an active, administrator-provisioned reviewer profile in Firestore (`users/{uid}` with `role: "QC_REVIEWER"` or `"ADMIN"` and `active: true`).
5. **Approved-only publication**: Only the current human-approved revision (`reviewed_revision_id == current_revision_id == revision.revision_id`) is eligible to publish. Approval is distinct from publication success. Real observation approval is an **independent human scientific decision only if warranted**, never an automated or required pass step.
6. **Privacy fail-closed**: Collector identities, reviewer identities, field notes, GPS accuracy, and internal workflow IDs are never published to public views or public dashboards.
7. **Live publisher state & provenance prerequisite**: The live ArcGIS publisher Cloud Function (`publishApprovedObservation`) is currently **not deployed or enabled yet** (`ENABLE_ARCGIS_PUBLICATION_FUNCTION=false` by default). The public publication proof path (Phases 6 and 7) starts **only after** reviewed configuration and explicit authorization. If no provenance-cleared real observation is available, operators must stop at private workflow evidence; **never substitute `TEST-*` records (such as `TEST-014`) or unprovenanced legacy data for public proof**.

---

## Evidence discipline & privacy protocol

To maintain scientific integrity without compromising participant privacy or operational security:
* **Do NOT commit private operational evidence to the Git repository**: Never record or publish collector emails, reviewer emails, Firebase Auth UIDs, precise GPS coordinates of private sampling sites, raw field notes, internal Firestore document IDs, cryptographic record hashes, or private scientific records in public documentation.
* **Keep sensitive proof in restricted release verification records**: Store unredacted verification artifacts (device identifiers, full-screen captures, internal audit IDs, and high-precision coordinates) in restricted, untracked release archives outside Git.
* **Public repository records must remain anonymous**: Only commit non-sensitive verification results: PASS/FAIL/BLOCKED verdicts, verification timestamps, public site codes, public observation IDs, canonical parameter names/units, and anonymous REST query feature counts.

---

## Phase 1: Physical iPhone install & collector authentication

### Action 1.1: Install release build via TestFlight
* **Operator action**:
  1. Open Apple TestFlight on the designated physical iPhone.
  2. Locate **PA Watershed Watch**.
  3. Verify build metadata against current release authorization records. The current reference configuration is Marketing Version `1.0.0`, Build `17` (provisional pending final release SHA selection), Bundle Identifier `org.centralpawatershed.mobile`.
  4. Tap **Install** or **Update**. Launch the application.
* **Stop gate**: The app must launch without crashing. On first launch, the Welcome screen ("Welcome to PA Watershed Watch") must appear.
* **Evidence to record**:
  * **Public repository log**: Confirm app installed and launched cleanly; Welcome screen appeared on first launch.
  * **Restricted release records (outside Git)**: Device model, iOS version, exact installed build number, and installation timestamp.

### Action 1.2: Sign in & confirm collector identity
* **Operator action**:
  1. From the Welcome screen, tap **Get Started** to navigate to Sign In.
  2. Sign in with the designated human collector account (Email/Password or Continue with Google).
  3. On the **Ready to collect** screen, confirm the collector's real full name (e.g., `"Jane Doe"`).
  4. Tap **Confirm Name & Continue** to enter the Home view.
* **Stop gate**: The confirmed name must be a real person name (used as `data_collected_by` on submitted revisions). Email-fragment fallback is prohibited.
* **Evidence to record**:
  * **Public repository log**: Confirm collector identity was verified and confirmed per protocol; account control rendered on Home.
  * **Restricted release records (outside Git)**: Collector email, confirmed name, Firebase Auth UID (`users/{uid}`), and account panel screenshot.

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
  * **Public repository log**: Selected public `site_code` and watershed name; confirm site is active.
  * **Restricted release records (outside Git)**: Selected `site_id`, catalog document ID, and site catalog attributes.

### Action 2.2: Capture visit details & GPS fix
* **Operator action**:
  1. On **Step 2: Visit Details**, verify the date and time in Eastern Time (`America/New_York`).
  2. Tap **Acquire GPS** (or allow automatic acquisition).
  3. Check the reported GPS accuracy (good ≤ 20 m per `config/validation_rules.json`) and distance from the cataloged site location (default tolerance 30 m).
  4. Tap **Continue to Method**.
* **Stop gate**: Continuing requires a valid GPS coordinate fix. Distance beyond site tolerance produces a non-blocking warning, not a hard stop.
* **Evidence to record**:
  * **Public repository log**: Confirm Eastern timestamp was captured; confirm GPS fix acquired meeting tolerance criteria (accuracy ≤ 20 m).
  * **Restricted release records (outside Git)**: Exact coordinates, GPS accuracy in meters, and distance to site in meters.

---

## Phase 3: Method, measurements, notes & submission

### Action 3.1: Specify measurement method & equipment
* **Operator action**:
  1. On **Step 3: Method**, answer "How was this observation measured?".
  2. Select the appropriate method choice: `Field instrument (in situ)`, `Field test kit / colorimetric`, `Penn State laboratory`, `External laboratory`, or `Other method`.
  3. Enter the specific method details: Instrument / Kit name (maps to `instrument_name`) and Procedure / Sample collection (maps to `method_name`).
  4. Tap **Continue to Measurements**.
* **Stop gate**: Selected test type must map to an approved protocol value from `config/validation_rules.json`.
* **Evidence to record**:
  * **Public repository log**: Selected test type and parameter protocol references.
  * **Restricted release records (outside Git)**: Exact `instrument_name` and `method_name` strings.

### Action 3.2: Enter water quality measurements
* **Operator action**:
  1. On **Step 4: Measurements**, enter the mandatory **Water Temperature** value and select unit (`°C` or `°F`).
  2. Enter any additional supported parameters measured (pH, Dissolved Oxygen, Specific Conductivity, Nitrate, etc.).
  3. Verify values satisfy hard scientific plausibility boundaries from `config/validation_rules.json`:
     * Temperature: hard range −5 to 60 °C (context range 0 to 35 °C)
     * pH: hard range 0 to 14 (aquatic range 6.0 to 9.0)
     * Dissolved Oxygen: hard range 0 to 50 mg/L (environmental alert below 5 mg/L)
     * Dissolved Oxygen Saturation: hard range 0 to 300 %
     * Specific Conductivity, TDS, Chloride, Sulfate, Nitrate, Phosphate, Discharge: non-negative (≥ 0)
  4. Tap **Continue to Notes**.
* **Stop gate**: Water Temperature is the only mandatory measurement. The app must block continuation if temperature is missing or outside hard boundaries.
* **Evidence to record**:
  * **Public repository log**: List of measured parameter codes and canonical units entered.
  * **Restricted release records (outside Git)**: Raw entered measurement values and units.

### Action 3.3: Enter field notes & review draft
* **Operator action**:
  1. On **Step 5: Notes**, optionally enter field observations (weather, water clarity, flow conditions).
  2. Tap **Review Observation**.
  3. On **Step 6: Review**, verify the readiness card displays **Ready to submit** (green seal icon).
  4. Check every card: Site, Date/Time, Location, Method, Measurements, Field Notes, and Collector name.
* **Stop gate**: If the card shows **Must fix before submitting** (octagon icon), resolve the blocking issue before proceeding.
* **Evidence to record**:
  * **Public repository log**: Confirm review screen displayed "Ready to submit" readiness state.
  * **Restricted release records (outside Git)**: Field notes text and Review screen capture.

### Action 3.4: Submit observation
* **Operator action**:
  1. Tap **Submit Observation**.
  2. When prompted with the confirmation dialog ("Submit observation? Revision 1 will be locked"), confirm submission.
  3. Observe the transition: Submission status changes from `Waiting to sync` to `Syncing` to `Synced`.
* **Stop gate**: Local draft is locked. Submission document created in Firestore with initial revision (`revision_no: 1`) in status `SUBMITTED`.
* **Evidence to record**:
  * **Public repository log**: Confirm submission succeeded, draft locked, and status transitioned to `SUBMITTED`.
  * **Restricted release records (outside Git)**: Firestore `submission_id`, initial `revision_id`, submission timestamp, and SHA-256 `record_hash`.

---

## Phase 4: Automated validation verification

### Action 4.1: Inspect server validation result
* **Operator action**:
  1. Via administrative read-only inspection, check that the Firebase Cloud Function `validateSubmittedObservation` processed the document.
  2. Verify the resulting submission status:
     * Clean observation: advances to `PENDING_REVIEW`.
     * Plausibility warning: advances to `PENDING_REVIEW` with warning flags.
     * Hard violation: advances to `NEEDS_CORRECTION` with error flags.
* **Stop gate**: Submission must NOT be authored into `APPROVED` or `PUBLISHED` by validation. Collector clients cannot bypass validation.
* **Evidence to record**:
  * **Public repository log**: Confirm validation completed under rules version `1.1.0`; record resulting status (`PENDING_REVIEW` or `NEEDS_CORRECTION`) and quality score band.
  * **Restricted release records (outside Git)**: Full validation output document, exact score value, and flag codes.

---

## Phase 5: QC Console inspection & correction cycle

### Action 5.1: Reviewer sign-in to QC Console
* **Operator action**:
  1. Open the private QC Console (`https://qc-console-dev--central-pa-watershed-dev.us-central1.hosted.app/review`).
  2. Sign in with authorized reviewer credentials.
  3. Verify that the reviewer account holds an active profile (`users/{uid}` with role `QC_REVIEWER` or `ADMIN` and `active: true`).
* **Stop gate**: The console must refuse access or throw an authorization error if the user lacks an active reviewer profile.
* **Evidence to record**:
  * **Public repository log**: Confirm reviewer authenticated with verified active reviewer profile.
  * **Restricted release records (outside Git)**: Reviewer email and Auth UID.

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
  * **Public repository log**: Confirm Revision 1 remained immutable; confirm Revision 2 created with parent linkage and resubmitted.
  * **Restricted release records (outside Git)**: Reviewer correction comment, Revision 1 hash, Revision 2 ID, and resubmission timestamp.

### Action 5.3: Independent human review decision (approval only if warranted)
* **Operator action**:
  1. In the QC Console, open the current review-ready revision (`PENDING_REVIEW`).
  2. Review all scientific values, field methods, photos/notes, and validation confidence score.
  3. **Exercise independent scientific judgment**: Approval is an independent human evaluation based on scientific protocol compliance and data plausibility; it is **never a mandatory pass step** for the verification runbook.
     * If measurements, sampling conditions, or instrument calibrations are questionable, click **Request Correction** (with specific feedback) or **Reject** (with reason). This successfully validates the private review gate.
     * Click **Approve** **only if warranted** by sound scientific evidence and protocol compliance.
  4. If approved, the backend API (`POST /api/submissions/{submissionId}/review`) verifies the reviewer's active profile and writes an approval transaction.
* **Stop gate**: 
  * If approval is not warranted, the workflow terminates at `NEEDS_CORRECTION` or `REJECTED`, providing complete proof of private review gate enforcement.
  * If approved, submission transitions to `APPROVED`. Verify Firestore invariants:
    * `current_revision_id == reviewed_revision_id`
    * `review_decision == "APPROVE"`
    * Revision document content is unchanged.
* **Evidence to record**:
  * **Public repository log**: Confirm review decision executed via QC Console; record outcome (`APPROVED`, `NEEDS_CORRECTION`, or `REJECTED`); if approved, confirm reviewed revision matches current revision.
  * **Restricted release records (outside Git)**: Reviewer UID, decision timestamp, review comments, and review audit document ID (`review-{revision_id}`).

---

## Phase 6: Approved-only ArcGIS publication (staged gate)

> [!IMPORTANT]
> **Release gate notice: Live publisher prerequisite**
> The live Firebase publisher Cloud Function (`publishApprovedObservation`) is currently **not deployed or enabled** in the live environment (`ENABLE_ARCGIS_PUBLICATION_FUNCTION=false`).
> 
> The public publication and dashboard proof path below (Phases 6 and 7) executes **only after**:
> 1. Reviewed configuration and explicit authorization (setting `ENABLE_ARCGIS_PUBLICATION_FUNCTION=true`, valid item-scoped OAuth secrets, verified FeatureServer URL).
> 2. An authorized human reviewer has approved an observation with **verified, provenance-cleared real scientific origin**.
> 
> **If no provenance-cleared observation is available, STOP AT PHASE 5.** Record the successful private workflow evidence. **Under no circumstances should `TEST-*` fixtures (such as `TEST-014`) or legacy inventory be substituted to force public proof.**

### Action 6.1: Verify publication trigger & authoritative write
* **Operator action** *(conditional on publisher deployment & authorized provenance)*:
  1. Verify the publisher trigger `publishApprovedObservation` claims the approval.
  2. Inspect Firestore publication lease document `submissions/{submissionId}/publication/{revisionId}`:
     * `status: "PUBLISHING"` with active lease token
     * On completion: `status: "PUBLISHED"`, `published_at` timestamp recorded.
  3. Inspect private authoritative ArcGIS service `Central_PA_Watershed_Approved_Authoritative`:
     * Layer 0 (`SamplingSites`): site record updated with latest sample timestamp.
     * Layer 1 (`ApprovedObservations`): exactly one new feature created with public `observation_id` and collection geometry.
     * Layer 3 (`Measurements`): normalized measurement rows inserted, including canonical `WATER_TEMP_C`.
     * Layer 2 (`LatestSiteConditions`): materialized row updated with newest approved observation.
* **Stop gate**: Publication must fail closed if the revision is unapproved, rejected, or non-current. Duplicate deliveries must be fenced by the lease token.
* **Evidence to record**:
  * **Public repository log**: Confirm publication completed to authoritative service; confirm public `observation_id` is opaque.
  * **Restricted release records (outside Git)**: Publication lease token, attempt count, authoritative `OBJECTID`/`GlobalID`, and publication audit ID (`publish-{revision_id}`).

---

## Phase 7: Public dashboard anonymous verification

### Action 7.1: Verify hosted public dashboard display
* **Operator action**:
  1. In a clean browser session (no credentials, incognito), navigate to the hosted public dashboard:  
     `https://public-dashboard-dev--central-pa-watershed-dev.us-central1.hosted.app/`
  2. **If Phase 6 was executed (provenance-cleared real observation published)**:
     * **Header KPI Strip**: Verify `Monitoring sites` count reflects the active site; verify `Latest sample` displays the date of the approved observation.
     * **Site Browser**: Verify the site appears in the list with status badge `"Reviewed"`.
     * **Map Surface**: Verify the site marker appears at the exact cataloged coordinates in brand Deep Water with Limestone halo; verify selecting the site highlights the intersecting USGS HUC-12 watershed boundary in brand Hemlock.
     * **Site Details & Readings**: Verify approved Water Temperature and all entered parameters render with canonical units; verify "Reviewed" completeness badge.
     * **Time Series Graph**: Verify the newly published point appears on the trend line at the exact collection instant; click **CSV** export and verify the downloaded file contains public allowlist fields only.
  3. **If Phase 6 was held at the gate (no publisher or test data only)**:
     * Verify the hosted dashboard remains in its verified, connected zero-data state (`Monitoring sites: 0`, `Latest sample: None yet`, `Watersheds: 0`, zero markers, search disabled, and no synthetic demo fallback).
* **Stop gate**: Fails closed if any private field (collector name, reviewer UID, submission ID, internal notes) is visible in the UI, network payloads, or exported CSV. Fails if demo mode or synthetic records appear.
* **Evidence to record**:
  * **Public repository log**: Confirm hosted dashboard displays approved observation with canonical units (if published) or maintains verified zero-data state (if held at gate); confirm 4 public ArcGIS views report 0 unexpected or private fields; confirm exported CSV contains only allowlisted fields.
  * **Restricted release records (outside Git)**: Verification screenshots and downloaded CSV file.
