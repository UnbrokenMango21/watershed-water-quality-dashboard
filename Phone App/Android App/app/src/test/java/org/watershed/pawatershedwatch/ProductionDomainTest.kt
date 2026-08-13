package org.watershed.pawatershedwatch

import com.google.firebase.Timestamp
import com.google.firebase.firestore.GeoPoint
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

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

        assertEquals(expected.getJSONObject("submission").toValue(), FirestoreObservationMapper.submission(snapshot, "SUBMITTED").normalized())
        assertEquals(expected.getJSONObject("revision").toValue(), FirestoreObservationMapper.revision(snapshot, "SUBMITTED").normalized())
        assertEquals(expected.getJSONArray("measurements").toValue(), snapshot.measurements.map { FirestoreObservationMapper.measurement(snapshot, it).normalized() })
        assertEquals(expected.getJSONArray("attachments").toValue(), snapshot.attachments.map { FirestoreObservationMapper.attachment(snapshot, it, path).normalized() })
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
        assertThrows(IllegalArgumentException::class.java) {
            valid.copy(values = valid.values + (MeasurementKind.Ph to "")).toCanonicalSnapshot("owner-a", "1.0.0")
        }
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

    private fun validDraft() = ObservationDraft(
        ownerUid = "owner-a", siteId = "SITE-1", collector = "Collector", latitude = 40.0, longitude = -77.0,
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
