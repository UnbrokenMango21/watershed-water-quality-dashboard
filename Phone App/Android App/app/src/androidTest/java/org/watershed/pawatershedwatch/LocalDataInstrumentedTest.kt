package org.watershed.pawatershedwatch

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LocalDataInstrumentedTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val db = Room.inMemoryDatabaseBuilder(context, WatershedDatabase::class.java).allowMainThreadQueries().build()
    private val repository = RoomMobileRepository(db)

    @get:Rule
    val migration = MigrationTestHelper(InstrumentationRegistry.getInstrumentation(), WatershedDatabase::class.java)

    @After
    fun close() = db.close()

    @Test
    fun ownerIsolationRetryIdentityAndCorrectionHistorySurviveRoom() = runBlocking {
        db.dao().putSites(listOf(CachedSiteEntity("SITE-1", "Spring Creek at Houserville Road Bridge", "Centre County", "Spring Creek", 40.8, -77.8, true, 1)))
        val original = validDraft("owner-a")
        repository.saveDraft(original)

        assertEquals(original, repository.loadDraft("owner-a"))
        assertNull(repository.loadDraft("owner-b"))
        val submitted = repository.persistSubmission(original, WorkflowState.Submitted, SyncState.Waiting, "Original field record")
        assertEquals(original.eventId, submitted.eventId)
        assertEquals(original.revisionId, submitted.currentRevisionId)
        assertEquals(CanonicalIds.measurement(original.revisionId, "DO_MG_L").value, db.dao().measurements("owner-a", original.revisionId.value).first { it.parameterCode == "DO_MG_L" }.measurementId)
        assertEquals(original.revisionId.value, db.dao().queue("owner-a", original.submissionId.value)?.revisionId)
        assertEquals(0, repository.loadRecords("owner-b").size)

        repository.updateRemoteState("owner-a", original.submissionId, WorkflowState.NeedsCorrection, SyncState.Synced, "Verify dissolved oxygen transcription")
        val revision2 = original.copy(
            revisionId = RevisionId.new(), revisionNo = 2, isCorrection = true, baseRevision = 1,
            sourceRecordId = original.submissionId.value, correctionReason = "Verify dissolved oxygen transcription",
            revisionNote = "Checked original instrument export", values = original.values + (MeasurementKind.DissolvedOxygen to "9.1"),
        )
        repository.saveDraft(revision2)
        val corrected = repository.persistSubmission(revision2, WorkflowState.Resubmitted, SyncState.Waiting, revision2.revisionNote)

        assertEquals(original.submissionId.value, corrected.id)
        assertEquals(original.eventId, corrected.eventId)
        assertEquals(2, corrected.revision)
        assertEquals(listOf(1, 2), db.dao().revisions("owner-a", original.submissionId.value).map(RevisionEntity::revisionNo))
        assertEquals(9.0, db.dao().measurements("owner-a", original.revisionId.value).first { it.parameterCode == "DO_MG_L" }.rawValue.toDouble(), 0.0)
        assertEquals(9.1, db.dao().measurements("owner-a", revision2.revisionId.value).first { it.parameterCode == "DO_MG_L" }.rawValue.toDouble(), 0.0)
    }

    @Test
    fun migrationTwoToFourPreservesRowsAndAddsAttachmentAndValidationContracts() {
        val name = "migration-${System.nanoTime()}"
        migration.createDatabase(name, 2).apply {
            execSQL("INSERT INTO attachments (attachment_id, owner_uid, revision_id, local_path, content_type, kind, caption, created_at, transfer_state) VALUES ('a1','owner-a','r1','/tmp/a.jpg','image/jpeg','SITE_PHOTO',NULL,1,'LOCAL_ONLY')")
            close()
        }
        migration.runMigrationsAndValidate(name, 4, true, WatershedDatabase.MIGRATION_2_3, WatershedDatabase.MIGRATION_3_4).use { migrated ->
            migrated.query("SELECT submission_id, size_bytes, remote_storage_path, last_error FROM attachments WHERE attachment_id='a1'").use { cursor ->
                assertNotNull(cursor)
                cursor.moveToFirst()
                assertEquals("", cursor.getString(0))
                assertEquals(0L, cursor.getLong(1))
                assertNull(cursor.getString(2))
                assertNull(cursor.getString(3))
            }
        }
        context.deleteDatabase(name)
    }

    @Test
    fun migrationFourToFivePreservesHistoricalTemperatureAndAllowsMissingNewValues() {
        val name = "science-migration-${System.nanoTime()}"
        migration.createDatabase(name, 4).apply {
            execSQL("INSERT INTO revisions (revision_id, submission_id, event_id, revision_no, owner_uid, site_id, created_at, collected_at, submitted_at, collector, latitude, longitude, accuracy_m, test_type, test_type_other, method, instrument, notes, temp_entered_value, temp_entered_unit, temp_c, temp_f, workflow_state, revision_note, app_version) VALUES ('r1','s1','e1',1,'owner-a','site1',1,2,3,'Historical Collector',40.8,-77.8,4,'Penn State Lab',NULL,'Grab sample','Lab',NULL,20,'C',20,68,'Submitted','Original','1.0.0')")
            close()
        }
        migration.runMigrationsAndValidate(name, 5, true, WatershedDatabase.MIGRATION_4_5).use { migrated ->
            migrated.query("SELECT collector, temp_c, weather_condition FROM revisions WHERE revision_id='r1'").use { cursor ->
                assertTrue(cursor.moveToFirst()); assertEquals("Historical Collector", cursor.getString(0)); assertEquals(20.0, cursor.getDouble(1), 0.0); assertEquals("", cursor.getString(2))
            }
            migrated.execSQL("UPDATE revisions SET temp_entered_value=NULL,temp_entered_unit=NULL,temp_c=NULL,temp_f=NULL WHERE revision_id='r1'")
            migrated.query("SELECT temp_c FROM revisions WHERE revision_id='r1'").use { cursor -> cursor.moveToFirst(); assertTrue(cursor.isNull(0)) }
        }
        context.deleteDatabase(name)
    }

    @Test
    fun pendingLabDraftAndVisualOnlySubmissionPersistWithoutInventedTemperature() = runBlocking {
        db.dao().putSites(listOf(CachedSiteEntity("SITE-1", "Test site", "Centre", "Spring Creek", 40.8, -77.8, true, 1)))
        val pending = validDraft("owner-a").copy(values = emptyMap(), labResultsPending = true, collectionStage = CollectionStage.LAB_PENDING, fieldCollectedAt = 123)
        repository.saveDraft(pending)
        assertEquals(pending, repository.loadDraft("owner-a"))
        val ready = pending.copy(labResultsPending = false, collectionStage = CollectionStage.LAB_COMPLETED, labCompletedAt = 456)
        val record = repository.persistSubmission(ready, WorkflowState.Submitted, SyncState.Waiting, "Completed")
        assertEquals(pending.submissionId.value, record.id); assertTrue(record.measurements.isEmpty())
        assertNull(db.dao().revision("owner-a", ready.revisionId.value)?.tempC)
        assertEquals("Unknown", record.waterColor)
    }

    @Test
    fun fieldGpsRejectsStaleAndZeroFallbackCoordinates() {
        val current = android.location.Location("test").apply {
            latitude = 40.7934; longitude = -77.86; accuracy = 4.2f; time = System.currentTimeMillis()
        }
        assertTrue(isUsableFieldFix(current))
        assertFalse(isUsableFieldFix(android.location.Location(current).apply { time -= 31_000 }))
        assertFalse(isUsableFieldFix(android.location.Location(current).apply { latitude = 0.0; longitude = 0.0 }))
    }

    private fun validDraft(owner: String) = ObservationDraft(
        weatherCondition = "Unknown", waterColor = "Unknown", flowCondition = "Unknown",
        ownerUid = owner, siteId = "SITE-1", collector = "Maya Chen", latitude = 40.7934, longitude = -77.86,
        accuracyMeters = 4.2, gpsState = GpsState.Good, testType = TestType.FieldInstrument,
        method = "Calibrated multiparameter field meter", instrument = "YSI ProDSS · Unit 4412",
        values = mapOf(
            MeasurementKind.Temperature to "20", MeasurementKind.Ph to "7.2",
            MeasurementKind.DissolvedOxygen to "9", MeasurementKind.Conductivity to "350",
        ),
        unitIds = mapOf(
            MeasurementKind.Temperature to Units.Celsius.id,
            MeasurementKind.Ph to Units.Ph.id,
            MeasurementKind.DissolvedOxygen to Units.MgO2L.id,
            MeasurementKind.Conductivity to Units.UsCm.id,
        ),
    )
}
