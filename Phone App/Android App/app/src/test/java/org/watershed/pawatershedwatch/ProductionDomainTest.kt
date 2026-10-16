package org.watershed.pawatershedwatch

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.GeoPoint
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

private const val TWO_DAYS = 2 * 86_400_000L

class ProductionDomainTest {
    private val golden by lazy {
        JSONObject(requireNotNull(javaClass.classLoader?.getResource("mobile_golden.json")).readText())
    }

    @Test
    fun sharedGoldenFixtureSerializesExactly() {
        val case = golden.getJSONArray("serializationCases").getJSONObject(0)
        val input = case.getJSONObject("input")
        val expected = case.getJSONObject("expected")
        val submissionId = SubmissionId(input.getString("submissionId"))
        val revisionId = RevisionId(input.getString("revisionId"))
        val owner = input.getString("ownerUid")
        val draft = ObservationDraft(
            weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown",
            submissionId = submissionId,
            eventId = EventId(input.getString("eventId")),
            revisionId = revisionId,
            revisionNo = 1,
            ownerUid = owner,
            createdAt = Instant.parse(input.getString("createdAt")).toEpochMilli(),
            siteId = input.getString("siteId"),
            collectedAt = Instant.parse(input.getString("collectedAt")).toEpochMilli(),
            collector = input.getString("collectorDisplayName"),
            latitude = input.getDouble("latitude"),
            longitude = input.getDouble("longitude"),
            accuracyMeters = input.getDouble("gpsAccuracyM"),
            gpsState = GpsState.Good,
            testType = TestType.FieldInstrument,
            method = input.getString("methodName"),
            instrument = input.getString("instrumentName"),
            values = mapOf(
                MeasurementKind.Temperature to "68",
                MeasurementKind.Ph to "7.2",
                MeasurementKind.DissolvedOxygen to "9",
                MeasurementKind.Conductivity to "0.35",
                MeasurementKind.Orp to "-0.1224",
            ),
            unitIds = mapOf(
                MeasurementKind.Temperature to Units.Fahrenheit.id,
                MeasurementKind.Ph to Units.Ph.id,
                MeasurementKind.DissolvedOxygen to Units.MgO2L.id,
                MeasurementKind.Conductivity to Units.MsCm.id,
                MeasurementKind.Orp to Units.V.id,
            ),
            notes = input.getString("fieldNotes"),
            attachments = listOf(
                ObservationAttachment(
                    id = AttachmentId("55555555-5555-4555-8555-555555555555"), ownerUid = owner,
                    submissionId = submissionId, revisionId = revisionId, localPath = "/fixtures/photo.jpg",
                    contentType = "image/jpeg", sizeBytes = 2_487_312, kind = AttachmentKind.SITE_PHOTO,
                    caption = "Upstream view", createdAt = Instant.parse("2026-08-08T20:30:00Z").toEpochMilli(),
                ),
            ),
        )
        val snapshot = draft.toCanonicalSnapshot(owner, "1.0.0", Instant.parse(input.getString("submittedAt")).toEpochMilli())
        val path = expected.getJSONArray("attachments").getJSONObject(0).getString("storage_path")
        val submission = FirestoreObservationMapper.submission(snapshot, "SUBMITTED")
        val revision = FirestoreObservationMapper.revision(snapshot, "SUBMITTED")

        // submitted_at is now the trusted server sentinel (firestore.rules requires request.time), so the
        // fixture's client-clock value is compared out and the sentinel asserted separately.
        assertTrue(submission["submitted_at"] is FieldValue)
        assertTrue(revision["submitted_at"] is FieldValue)
        assertEquals(expected.getJSONObject("submission").toValue() - "submitted_at", submission.normalized() - "submitted_at")
        assertEquals(expected.getJSONObject("revision").toValue() - "submitted_at", revision.normalized() - "submitted_at")
        assertEquals(
            expected.getJSONArray("measurements").toValue(),
            snapshot.measurements.map { FirestoreObservationMapper.measurement(snapshot, it).normalized() },
        )
        assertEquals(expected.getJSONArray("attachments").toValue(), snapshot.attachments.map { FirestoreObservationMapper.attachment(snapshot, it, path).normalized() })
        // New revisions are recorded under the current contract, and the golden case pins it.
        assertEquals("0.2.0", snapshot.schemaVersion)
        assertEquals("0.2.0", expected.getJSONObject("revision").getString("schema_version"))
    }

    @Test
    fun revisionQueuedByAnInstalledLegacyBuildReplaysUnderTheOriginalContract() {
        // A row migrated from Room v4: schema_version defaults to 0.1.0 and its measurements carry no provenance.
        val revision = RevisionEntity(
            "r1", "s1", "e1", 1, "owner-a", "SITE-1", 1_000, 2_000, 3_000, "Historical Collector", 40.8, -77.8, 4.0,
            "In-situ / Field Instrument", null, "Calibrated meter", "YSI ProDSS", null, 20.0, "C", 20.0, 68.0,
            "Submitted", "Original", "1.0.0", schemaVersion = "0.1.0",
        )
        val rows = listOf(
            LocalMeasurementEntity("r1", "Ph", CanonicalIds.measurement(RevisionId("r1"), "PH").value, "owner-a", "PH", "7.2", Units.Ph.id, 7.2, "pH"),
            LocalMeasurementEntity("r1", "Nitrate", CanonicalIds.measurement(RevisionId("r1"), "NITRATE_MG_L").value, "owner-a", "NITRATE_MG_L", "1.2", Units.MgNL.id, 1.2, "mg/L as N"),
        )
        val snapshot = revision.snapshot(rows)
        assertEquals("0.1.0", snapshot.schemaVersion)
        assertEquals("0.1.0", FirestoreObservationMapper.submission(snapshot, "DRAFT")["schema_version"])
        val revisionDocument = FirestoreObservationMapper.revision(snapshot, "SUBMITTED")
        assertEquals("0.1.0", revisionDocument["schema_version"])
        assertEquals("YSI ProDSS", revisionDocument["instrument_name"])
        assertEquals(20.0, revisionDocument["temp_c"])
        assertEquals("C", revisionDocument["temp_entered_unit"])

        val legacyKeys = setOf(
            "measurement_id", "parameter_code", "display_name", "value", "unit_code", "entered_value", "entered_unit_code",
            "method_name", "instrument_name", "qualifier", "notes", "entered_at",
        )
        assertEquals(2, snapshot.measurements.size)
        snapshot.measurements.forEach { value ->
            val document = FirestoreObservationMapper.measurement(snapshot, value)
            assertEquals("0.1.0 measurements never carry analysis provenance", legacyKeys, document.keys)
            assertEquals("Calibrated meter", document["method_name"])
            assertEquals("YSI ProDSS", document["instrument_name"])
            assertEquals(Timestamp(java.util.Date(2_000)), document["entered_at"])
        }

        // The same row under the current contract keeps the 0.2.0 shape.
        val current = revision.copy(schemaVersion = "0.2.0").snapshot(rows)
        assertEquals("0.2.0", FirestoreObservationMapper.revision(current, "SUBMITTED")["schema_version"])
        current.measurements.forEach { value ->
            val document = FirestoreObservationMapper.measurement(current, value)
            assertEquals("FIELD", document["analysis_stage"])
            assertTrue(document.containsKey("field_exception_reason"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            FirestoreObservationMapper.revision(revision.copy(schemaVersion = "9.9.9").snapshot(rows), "SUBMITTED")
        }
    }

    @Test
    fun correctionDraftsAreRecordedUnderTheCurrentContract() {
        val correction = validDraft().copy(revisionNo = 2, isCorrection = true, revisionNote = "Checked export")
        assertEquals("0.2.0", correction.toCanonicalSnapshot("owner-a", "1.0.0").schemaVersion)
    }

    @Test
    fun submittedAtIsTheTrustedServerSentinelAndDraftsStayNull() {
        val snapshot = validDraft().toCanonicalSnapshot("owner-a", "1.0.0")
        assertTrue(FirestoreObservationMapper.submission(snapshot, "SUBMITTED")["submitted_at"] is FieldValue)
        assertTrue(FirestoreObservationMapper.submission(snapshot, "RESUBMITTED")["submitted_at"] is FieldValue)
        assertTrue(FirestoreObservationMapper.revision(snapshot, "SUBMITTED")["submitted_at"] is FieldValue)
        assertNull(FirestoreObservationMapper.submission(snapshot, "DRAFT")["submitted_at"])
        assertNull(FirestoreObservationMapper.revision(snapshot, "DRAFT")["submitted_at"])
        // Only submitted_at moves to the server clock; the other timestamps stay client-authored.
        assertTrue(FirestoreObservationMapper.submission(snapshot, "SUBMITTED")["created_at"] is Timestamp)
        assertTrue(FirestoreObservationMapper.revision(snapshot, "SUBMITTED")["collected_at"] is Timestamp)
    }

    @Test
    fun measurementDocumentsCarryEnteredProvenanceBesideCanonicalValues() {
        val base = validDraft()
        val snapshot = base.copy(
            values = base.values + (MeasurementKind.Conductivity to "0.35"),
            unitIds = mapOf(MeasurementKind.Conductivity to Units.MsCm.id),
        ).toCanonicalSnapshot("owner-a", "1.0.0")
        val conductivity = FirestoreObservationMapper.measurement(
            snapshot,
            snapshot.measurements.first { it.parameterCode == "CONDUCTIVITY_US_CM" },
        )

        assertEquals(350.0, conductivity["value"])
        assertEquals("uS/cm", conductivity["unit_code"])
        assertEquals(0.35, conductivity["entered_value"])
        assertEquals("ms-cm", conductivity["entered_unit_code"])
        snapshot.measurements.forEach { value ->
            val document = FirestoreObservationMapper.measurement(snapshot, value)
            assertNotNull(document["entered_value"])
            assertTrue((document["entered_unit_code"] as String).isNotEmpty())
        }
    }

    @Test
    fun fixtureIdentitiesTemperatureAndEasternOffsetsAreStable() {
        assertEquals(TestType.entries.map(TestType::label), golden.getJSONArray("testTypes").toValue())
        assertEquals("f890767f-9220-5b4e-aafd-77f053f17390", CanonicalIds.measurement(RevisionId("33333333-3333-4333-8333-333333333333"), "PH").value)
        assertEquals(32.0, Units.Celsius.convert(0.0, Units.Fahrenheit), 0.0)
        assertEquals(23.0, Units.Celsius.convert(-5.0, Units.Fahrenheit), 0.0)
        assertEquals("2026-01-15T10:00:00-05:00", EasternTime.offsetString(Instant.parse("2026-01-15T15:00:00Z").toEpochMilli()))
        assertEquals("2026-08-08T16:30:00-04:00", EasternTime.offsetString(Instant.parse("2026-08-08T20:30:00Z").toEpochMilli()))
    }

    @Test
    fun canonicalBoundaryRejectsFeatureGatedAndCrossOwnerData() {
        val valid = validDraft()
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.Turbidity to "2")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
        assertThrows(IllegalArgumentException::class.java) { valid.toCanonicalSnapshot("owner-b", "1.0.0") }
        assertTrue(ProductionMeasurementCatalog.spec(MeasurementKind.Turbidity).support == ProductionSupport.FEATURE_GATED)
    }

    @Test
    fun numericBoundaryDistinguishesBlankZeroLocaleAndNegativeOrp() {
        val valid = validDraft()
        // pH is optional: blanking it is skipped, not rejected.
        val blankPh = valid.copy(values = valid.values + (MeasurementKind.Ph to "")).toCanonicalSnapshot("owner-a", "1.0.0")
        assertTrue(blankPh.measurements.none { it.parameterCode == "PH" })
        val snapshot = valid.copy(
            values = valid.values + (MeasurementKind.Ph to "0") + (MeasurementKind.Orp to "-.5"),
        ).toCanonicalSnapshot("owner-a", "1.0.0")
        assertEquals(0.0, snapshot.measurements.first { it.parameterCode == "PH" }.value, 0.0)
        assertEquals(-0.5, snapshot.measurements.first { it.parameterCode == "ORP_MV" }.value, 0.0)
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.Ph to "7,2")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.Ph to "14.1")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
    }

    @Test
    fun labProfileAcceptsTemperatureOnlySubmissionAndStillCarriesOptionalResults() {
        val labDraft = ObservationDraft(
            ownerUid = "owner-a", siteId = "SITE-1", collector = "Collector",
            weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown", latitude = 40.0, longitude = -77.0,
            accuracyMeters = 5.0, gpsState = GpsState.Good, testType = TestType.PennStateLab,
            method = "Grab sample", instrument = "Penn State Agricultural Analytical Services Laboratory",
            values = mapOf(MeasurementKind.Temperature to "18"), collectedAt = System.currentTimeMillis() - TWO_DAYS,
        )
        val temperatureOnly = labDraft.toCanonicalSnapshot("owner-a", "1.0.0")
        assertTrue(temperatureOnly.measurements.isEmpty())
        assertEquals(18.0, temperatureOnly.tempC!!, 0.0)

        val complete = labDraft.copy(
            values = labDraft.values + (MeasurementKind.Nitrate to "1.2"),
            analysisDetails = mapOf(MeasurementKind.Nitrate to labAnalysis(labDraft.collectedAt + 3_600_000)),
        )
        val snapshot = complete.toCanonicalSnapshot("owner-a", "1.0.0")
        assertEquals(listOf("NITRATE_MG_L"), snapshot.measurements.map(CanonicalMeasurement::parameterCode))
        assertEquals(18.0, snapshot.tempC!!, 0.0)
    }

    @Test
    fun temperatureOnlySucceedsForEveryTestType() {
        TestType.entries.forEach { type ->
            val draft = ObservationDraft(
                ownerUid = "owner-a", siteId = "SITE-1", collector = "Collector",
            weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown", latitude = 40.0, longitude = -77.0,
                accuracyMeters = 5.0, gpsState = GpsState.Good, testType = type,
                testTypeOther = if (type == TestType.Other) "Custom protocol" else "",
                method = "Method", instrument = "Instrument",
                values = mapOf(MeasurementKind.Temperature to "20"),
            )
            val snapshot = draft.toCanonicalSnapshot("owner-a", "1.0.0")
            assertTrue("$type should not require any measurement beyond temperature", snapshot.measurements.isEmpty())
            assertEquals(20.0, snapshot.tempC!!, 0.0)
        }
    }

    @Test
    fun optionalMeasurementsAreValidatedWhenPresentButNeverBlockWhenBlank() {
        val base = ObservationDraft(
            ownerUid = "owner-a", siteId = "SITE-1", collector = "Collector",
            weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown", latitude = 40.0, longitude = -77.0,
            accuracyMeters = 5.0, gpsState = GpsState.Good, testType = TestType.FieldInstrument,
            method = "Method", instrument = "Instrument",
            values = mapOf(MeasurementKind.Temperature to "20"),
        )
        // Every optional measurement is blank; submission still succeeds.
        assertTrue(base.toCanonicalSnapshot("owner-a", "1.0.0").measurements.isEmpty())
        // A populated optional measurement outside its hard range still throws.
        assertThrows(IllegalArgumentException::class.java) {
            base.copy(values = base.values + (MeasurementKind.Ph to "15")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
    }

    @Test
    fun hardRangesRejectImpossibleReadingsBeforeSerialization() {
        val valid = validDraft()
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.Temperature to "61")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.DissolvedOxygen to "51")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
        assertEquals(-5.0, valid.copy(values = valid.values + (MeasurementKind.Temperature to "-5")).toCanonicalSnapshot("owner-a", "1.0.0").tempC!!, 0.0)
    }

    @Test
    fun visualOnlyDraftPreservesNullNumericsAndDoesNotInventAnInstrument() {
        val draft = validDraft().copy(values = emptyMap(), method = "", instrument = "")
        val snapshot = draft.toCanonicalSnapshot("owner-a", "1.0.0")
        assertNull(snapshot.tempC); assertNull(snapshot.tempF); assertNull(snapshot.temperatureEnteredValue)
        assertTrue(snapshot.measurements.isEmpty())
        assertEquals("In-situ / Field Instrument", snapshot.methodName)
        assertNull(FirestoreObservationMapper.revision(snapshot, "DRAFT")["instrument_name"])
        assertThrows(IllegalArgumentException::class.java) { draft.copy(waterColor = "").toCanonicalSnapshot("owner-a", "1.0.0") }
    }

    @Test
    fun pendingLaboratoryWorkIsDraftOnlyAndCompletionKeepsOriginalIdentity() {
        val pending = pastDraft().copy(values = emptyMap(), labResultsPending = true, collectionStage = CollectionStage.LAB_PENDING)
        assertThrows(IllegalArgumentException::class.java) { pending.toCanonicalSnapshot("owner-a", "1.0.0") }
        assertEquals("LAB_PENDING", pending.toCanonicalSnapshot("owner-a", "1.0.0", forDraft = true).collectionStage)
        val completed = pending.copy(
            labResultsPending = false, collectionStage = CollectionStage.LAB_COMPLETED, values = mapOf(MeasurementKind.Nitrate to "1.2"),
            analysisDetails = mapOf(MeasurementKind.Nitrate to labAnalysis(pending.collectedAt + 60_000)),
        ).toCanonicalSnapshot("owner-a", "1.0.0")
        assertEquals(pending.submissionId, completed.submissionId); assertEquals(pending.revisionId, completed.revisionId)
        assertNull(completed.tempC); assertEquals("NITRATE_MG_L", completed.measurements.single().parameterCode)
    }

    @Test
    fun waterDepthConvertsLengthAndRejectsNegativeDepth() {
        val draft = validDraft().copy(values = mapOf(MeasurementKind.WaterDepth to "30"), unitIds = mapOf(MeasurementKind.WaterDepth to Units.Centimeters.id))
        val depth = draft.toCanonicalSnapshot("owner-a", "1.0.0").measurements.single()
        assertEquals("WATER_DEPTH_M", depth.parameterCode); assertEquals("m", depth.unitCode)
        assertEquals(0.3, depth.value, 1e-12); assertEquals(30.0, depth.enteredValue, 0.0)
        assertThrows(IllegalArgumentException::class.java) { draft.copy(values = mapOf(MeasurementKind.WaterDepth to "-1")).toCanonicalSnapshot("owner-a", "1.0.0") }
    }

    @Test
    fun fieldParametersRecordFieldStageAtSamplingTime() {
        val snapshot = validDraft().toCanonicalSnapshot("owner-a", "1.0.0")
        snapshot.measurements.forEach { value ->
            val document = FirestoreObservationMapper.measurement(snapshot, value)
            assertEquals("FIELD", document["analysis_stage"])
            assertEquals(Timestamp(java.util.Date(snapshot.collectedAt)), document["analyzed_at"])
            assertEquals(Timestamp(java.util.Date(snapshot.collectedAt)), document["entered_at"])
            assertNull(document["field_exception_reason"])
            assertEquals("Meter", document["method_name"])
            assertEquals("Instrument", document["instrument_name"])
        }
    }

    @Test
    fun laboratoryResultMapsItsOwnProvenanceAndKeepsSamplingTimeAsEnteredAt() {
        val base = pastDraft()
        val analyzedAt = base.collectedAt + 26 * 3_600_000L
        val snapshot = base.copy(
            values = base.values + (MeasurementKind.Chloride to "12.5"),
            analysisDetails = mapOf(
                MeasurementKind.Chloride to AnalysisProvenance(
                    AnalysisStage.LAB, "  EPA 300.0 ion chromatography ", "  ", analyzedAt,
                    fieldExceptionReason = "left over from a field attempt",
                ),
            ),
        ).toCanonicalSnapshot("owner-a", "1.0.0")
        val chloride = FirestoreObservationMapper.measurement(snapshot, snapshot.measurements.single { it.parameterCode == "CHLORIDE_MG_L" })

        assertEquals("LAB", chloride["analysis_stage"])
        assertEquals("EPA 300.0 ion chromatography", chloride["method_name"])
        assertNull("blank instrument is written as null", chloride["instrument_name"])
        assertEquals(Timestamp(java.util.Date(analyzedAt)), chloride["analyzed_at"])
        assertEquals(Timestamp(java.util.Date(base.collectedAt)), chloride["entered_at"])
        assertNull("a LAB result never carries a field exception", chloride["field_exception_reason"])
        assertEquals(12.5, chloride["entered_value"])
        assertEquals(12.5, chloride["value"])
    }

    @Test
    fun laboratoryParameterAnalyzedInTheFieldNeedsADocumentedException() {
        val base = pastDraft()
        val fieldAnalysis = AnalysisProvenance(AnalysisStage.FIELD, "Hach colorimetric kit", "Hach DR900", base.collectedAt + 600_000)
        val withValue = base.copy(values = base.values + (MeasurementKind.Phosphate to "0.4"), analysisDetails = mapOf(MeasurementKind.Phosphate to fieldAnalysis))

        assertEquals("Describe the field-analysis protocol or exception for Phosphate.", withValue.measurementProblem(MeasurementKind.Phosphate))
        val error = assertThrows(IllegalArgumentException::class.java) { withValue.toCanonicalSnapshot("owner-a", "1.0.0") }
        assertEquals("Describe the field-analysis protocol or exception for Phosphate.", error.message)

        val documented = withValue.copy(analysisDetails = mapOf(MeasurementKind.Phosphate to fieldAnalysis.copy(fieldExceptionReason = "  Lab courier unavailable; same-day kit per SOP 4.2 ")))
        val snapshot = documented.toCanonicalSnapshot("owner-a", "1.0.0")
        val phosphate = FirestoreObservationMapper.measurement(snapshot, snapshot.measurements.single { it.parameterCode == "PHOSPHATE_MG_L" })
        assertEquals("FIELD", phosphate["analysis_stage"])
        assertEquals("Lab courier unavailable; same-day kit per SOP 4.2", phosphate["field_exception_reason"])
        assertEquals("Hach DR900", phosphate["instrument_name"])
        assertEquals("Hach colorimetric kit", phosphate["method_name"])

        val tooLong = withValue.copy(analysisDetails = mapOf(MeasurementKind.Phosphate to fieldAnalysis.copy(fieldExceptionReason = "x".repeat(1001))))
        assertNotNull(tooLong.measurementProblem(MeasurementKind.Phosphate))
    }

    @Test
    fun analysisProvenanceMessagesMatchIos() {
        val base = pastDraft().copy(values = mapOf(MeasurementKind.Sulfate to "20"))
        assertEquals("Record the analysis method and time for Sulfate.", base.measurementProblem(MeasurementKind.Sulfate))
        val noTime = base.copy(analysisDetails = mapOf(MeasurementKind.Sulfate to AnalysisProvenance(method = "EPA 300.0")))
        assertEquals("Record the analysis method and time for Sulfate.", noTime.measurementProblem(MeasurementKind.Sulfate))
        val noMethod = base.copy(analysisDetails = mapOf(MeasurementKind.Sulfate to AnalysisProvenance(method = "  ", analyzedAt = base.collectedAt + 60_000)))
        assertEquals("Record the analysis method and time for Sulfate.", noMethod.measurementProblem(MeasurementKind.Sulfate))
        val before = base.copy(analysisDetails = mapOf(MeasurementKind.Sulfate to labAnalysis(base.collectedAt - 2 * 60_000)))
        assertEquals("Analysis time must be on or after sampling and cannot be in the future.", before.measurementProblem(MeasurementKind.Sulfate))
        val future = base.copy(analysisDetails = mapOf(MeasurementKind.Sulfate to labAnalysis(System.currentTimeMillis() + 3_600_000)))
        assertEquals("Analysis time must be on or after sampling and cannot be in the future.", future.measurementProblem(MeasurementKind.Sulfate))
        // A blank laboratory value needs no provenance: missing stays missing.
        assertNull(base.copy(values = mapOf(MeasurementKind.Sulfate to "")).measurementProblem(MeasurementKind.Sulfate))
        // Field parameters never ask for analysis provenance.
        assertNull(validDraft().measurementProblem(MeasurementKind.Ph))
    }

    @Test
    fun cloudDraftOmitsOnlyIncompleteValuesWhileSubmissionRejectsThem() {
        val base = pastDraft()
        val draft = base.copy(
            values = base.values + (MeasurementKind.Nitrate to "1.2") + (MeasurementKind.Chloride to "8"),
            analysisDetails = mapOf(
                MeasurementKind.Nitrate to AnalysisProvenance(method = "EPA 353.2"),
                MeasurementKind.Chloride to labAnalysis(base.collectedAt + 3_600_000),
            ),
        )
        val cloud = draft.toCanonicalSnapshot("owner-a", "1.0.0", forDraft = true)
        val codes = cloud.measurements.map(CanonicalMeasurement::parameterCode)
        assertTrue("incomplete nitrate stays local", "NITRATE_MG_L" !in codes)
        assertTrue("complete chloride synchronizes", "CHLORIDE_MG_L" in codes)
        assertTrue("field readings still synchronize", codes.containsAll(listOf("PH", "DO_MG_L", "CONDUCTIVITY_US_CM")))
        assertEquals(20.0, cloud.tempC!!, 0.0)
        // The local draft itself is untouched: the value remains for the collector to finish.
        assertEquals("1.2", draft.values[MeasurementKind.Nitrate])

        val error = assertThrows(IllegalArgumentException::class.java) { draft.toCanonicalSnapshot("owner-a", "1.0.0") }
        assertEquals("Record the analysis method and time for Nitrate.", error.message)
    }

    private fun pastDraft() = validDraft().copy(collectedAt = System.currentTimeMillis() - TWO_DAYS)

    private fun labAnalysis(analyzedAt: Long) = AnalysisProvenance(AnalysisStage.LAB, "EPA 353.2 cadmium reduction", "Penn State AASL", analyzedAt)

    private fun validDraft() = ObservationDraft(
        ownerUid = "owner-a", siteId = "SITE-1", collector = "Collector",
            weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown", latitude = 40.0, longitude = -77.0,
        accuracyMeters = 5.0, gpsState = GpsState.Good, testType = TestType.FieldInstrument,
        method = "Meter", instrument = "Instrument",
        values = mapOf(
            MeasurementKind.Temperature to "20", MeasurementKind.Ph to "7",
            MeasurementKind.DissolvedOxygen to "9", MeasurementKind.Conductivity to "300",
        ),
    )
}

private fun Map<String, Any?>.normalized(): Map<String, Any?> = mapValues { (_, value) -> value.normalized() }
private fun Any?.normalized(): Any? = when (this) {
    is Timestamp -> toDate().toInstant().toString()
    is GeoPoint -> mapOf("latitude" to latitude, "longitude" to longitude)
    is Map<*, *> -> entries.associate { it.key.toString() to it.value.normalized() }
    is List<*> -> map { it.normalized() }
    is Number -> toDouble()
    else -> this
}
private fun JSONObject.toValue(): Map<String, Any?> = keys().asSequence().associateWith { key -> get(key).jsonValue() }
private fun JSONArray.toValue(): List<Any?> = (0 until length()).map { get(it).jsonValue() }
private fun Any?.jsonValue(): Any? = when (this) {
    JSONObject.NULL -> null
    is JSONObject -> toValue()
    is JSONArray -> toValue()
    is Number -> toDouble()
    else -> this
}
