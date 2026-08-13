package org.watershed.pawatershedwatch

import android.content.Context
import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.withTransaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "drafts", indices = [Index("owner_uid")])
data class DraftEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "submission_id") val submissionId: String,
    @ColumnInfo(name = "event_id") val eventId: String,
    @ColumnInfo(name = "revision_id") val revisionId: String,
    @ColumnInfo(name = "revision_no") val revisionNo: Int,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "site_id") val siteId: String?,
    @ColumnInfo(name = "collected_at") val collectedAt: Long,
    val collector: String,
    val latitude: Double?,
    val longitude: Double?,
    @ColumnInfo(name = "accuracy_m") val accuracyM: Double?,
    @ColumnInfo(name = "gps_state") val gpsState: String,
    @ColumnInfo(name = "test_type") val testType: String?,
    @ColumnInfo(name = "test_type_other") val testTypeOther: String,
    val method: String,
    val instrument: String,
    @ColumnInfo(name = "lab_results_pending") val labResultsPending: Boolean,
    @ColumnInfo(name = "requested_analytes") val requestedAnalytes: String,
    val notes: String,
    @ColumnInfo(name = "current_step") val currentStep: Int,
    @ColumnInfo(name = "is_correction") val isCorrection: Boolean,
    @ColumnInfo(name = "source_submission_id") val sourceSubmissionId: String?,
    @ColumnInfo(name = "base_revision") val baseRevision: Int?,
    @ColumnInfo(name = "correction_reason") val correctionReason: String?,
    @ColumnInfo(name = "revision_note") val revisionNote: String,
    @ColumnInfo(name = "last_saved_at") val lastSavedAt: Long,
)

@Entity(tableName = "observations", indices = [Index("owner_uid"), Index("sync_state")])
data class ObservationEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "submission_id") val submissionId: String,
    @ColumnInfo(name = "event_id") val eventId: String,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "site_id") val siteId: String,
    @ColumnInfo(name = "current_revision_id") val currentRevisionId: String,
    @ColumnInfo(name = "current_revision_no") val currentRevisionNo: Int,
    @ColumnInfo(name = "workflow_state") val workflowState: String,
    @ColumnInfo(name = "sync_state") val syncState: String,
    @ColumnInfo(name = "correction_reason") val correctionReason: String?,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "validation_error_count") val validationErrorCount: Int? = null,
    @ColumnInfo(name = "validation_warning_count") val validationWarningCount: Int? = null,
    @ColumnInfo(name = "validation_info_count") val validationInfoCount: Int? = null,
    @ColumnInfo(name = "overall_quality_score") val overallQualityScore: Double? = null,
)

@Entity(tableName = "revisions", indices = [Index("submission_id"), Index("owner_uid")])
data class RevisionEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "revision_id") val revisionId: String,
    @ColumnInfo(name = "submission_id") val submissionId: String,
    @ColumnInfo(name = "event_id") val eventId: String,
    @ColumnInfo(name = "revision_no") val revisionNo: Int,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "site_id") val siteId: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "collected_at") val collectedAt: Long,
    @ColumnInfo(name = "submitted_at") val submittedAt: Long,
    val collector: String,
    val latitude: Double,
    val longitude: Double,
    @ColumnInfo(name = "accuracy_m") val accuracyM: Double,
    @ColumnInfo(name = "test_type") val testType: String,
    @ColumnInfo(name = "test_type_other") val testTypeOther: String?,
    val method: String,
    val instrument: String,
    val notes: String?,
    @ColumnInfo(name = "temp_entered_value") val tempEnteredValue: Double,
    @ColumnInfo(name = "temp_entered_unit") val tempEnteredUnit: String,
    @ColumnInfo(name = "temp_c") val tempC: Double,
    @ColumnInfo(name = "temp_f") val tempF: Double,
    @ColumnInfo(name = "workflow_state") val workflowState: String,
    @ColumnInfo(name = "revision_note") val revisionNote: String,
    @ColumnInfo(name = "app_version") val appVersion: String,
)

@Entity(tableName = "measurements", primaryKeys = ["revision_id", "kind"], indices = [Index("owner_uid")])
data class LocalMeasurementEntity(
    @ColumnInfo(name = "revision_id") val revisionId: String,
    val kind: String,
    @ColumnInfo(name = "measurement_id") val measurementId: String,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "parameter_code") val parameterCode: String?,
    @ColumnInfo(name = "raw_value") val rawValue: String,
    @ColumnInfo(name = "raw_unit_id") val rawUnitId: String,
    @ColumnInfo(name = "canonical_value") val canonicalValue: Double?,
    @ColumnInfo(name = "canonical_unit") val canonicalUnit: String?,
)

@Entity(tableName = "attachments", indices = [Index("revision_id"), Index("owner_uid")])
data class LocalAttachmentEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "attachment_id") val attachmentId: String,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "submission_id") val submissionId: String,
    @ColumnInfo(name = "revision_id") val revisionId: String,
    @ColumnInfo(name = "local_path") val localPath: String,
    @ColumnInfo(name = "content_type") val contentType: String,
    @ColumnInfo(name = "size_bytes") val sizeBytes: Long,
    val kind: String,
    val caption: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "transfer_state") val transferState: String,
    @ColumnInfo(name = "remote_storage_path") val remoteStoragePath: String?,
    @ColumnInfo(name = "last_error") val lastError: String?,
)

@Entity(tableName = "sites")
data class CachedSiteEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "site_id") val siteId: String,
    val name: String,
    val county: String,
    val watershed: String,
    val latitude: Double,
    val longitude: Double,
    val active: Boolean,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(tableName = "sync_queue", indices = [Index("owner_uid"), Index("state")])
data class SyncQueueEntity(
    @androidx.room.PrimaryKey @ColumnInfo(name = "submission_id") val submissionId: String,
    @ColumnInfo(name = "revision_id") val revisionId: String,
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    val state: String,
    val attempts: Int,
    @ColumnInfo(name = "next_attempt_at") val nextAttemptAt: Long,
    @ColumnInfo(name = "last_error") val lastError: String?,
)

@Entity(
    tableName = "validation_flags",
    primaryKeys = ["owner_uid", "revision_id", "flag_id"],
    indices = [Index("owner_uid"), Index("revision_id")],
)
data class ValidationFlagEntity(
    @ColumnInfo(name = "owner_uid") val ownerUid: String,
    @ColumnInfo(name = "revision_id") val revisionId: String,
    @ColumnInfo(name = "flag_id") val flagId: String,
    val severity: String,
    @ColumnInfo(name = "rule_code") val ruleCode: String,
    val message: String,
)

@Dao
interface MobileDao {
    @Query("SELECT * FROM drafts WHERE owner_uid = :ownerUid ORDER BY last_saved_at DESC LIMIT 1")
    suspend fun draft(ownerUid: String): DraftEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putDraft(value: DraftEntity)
    @Query("DELETE FROM drafts WHERE owner_uid = :ownerUid AND submission_id = :submissionId") suspend fun deleteDraft(ownerUid: String, submissionId: String)

    @Query("SELECT * FROM measurements WHERE revision_id = :revisionId AND owner_uid = :ownerUid") suspend fun measurements(ownerUid: String, revisionId: String): List<LocalMeasurementEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putMeasurements(values: List<LocalMeasurementEntity>)
    @Query("DELETE FROM measurements WHERE revision_id = :revisionId AND owner_uid = :ownerUid") suspend fun deleteMeasurements(ownerUid: String, revisionId: String)

    @Query("SELECT * FROM attachments WHERE revision_id = :revisionId AND owner_uid = :ownerUid ORDER BY created_at") suspend fun attachments(ownerUid: String, revisionId: String): List<LocalAttachmentEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putAttachments(values: List<LocalAttachmentEntity>)
    @Query("DELETE FROM attachments WHERE revision_id = :revisionId AND owner_uid = :ownerUid") suspend fun deleteAttachments(ownerUid: String, revisionId: String)
    @Query("DELETE FROM attachments WHERE attachment_id = :attachmentId AND owner_uid = :ownerUid") suspend fun deleteAttachment(ownerUid: String, attachmentId: String)
    @Query("UPDATE attachments SET transfer_state=:state, remote_storage_path=:remotePath, last_error=:error WHERE attachment_id=:attachmentId AND owner_uid=:ownerUid")
    suspend fun updateAttachmentTransfer(ownerUid: String, attachmentId: String, state: String, remotePath: String?, error: String?)

    @Query("SELECT * FROM observations WHERE owner_uid = :ownerUid ORDER BY updated_at DESC") suspend fun observations(ownerUid: String): List<ObservationEntity>
    @Query("SELECT * FROM observations WHERE submission_id = :submissionId AND owner_uid = :ownerUid") suspend fun observation(ownerUid: String, submissionId: String): ObservationEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putObservation(value: ObservationEntity)
    @Query("UPDATE observations SET workflow_state=:workflow, sync_state=:sync, correction_reason=:reason, updated_at=:updatedAt WHERE owner_uid=:ownerUid AND submission_id=:submissionId")
    suspend fun updateObservation(ownerUid: String, submissionId: String, workflow: String, sync: String, reason: String?, updatedAt: Long)
    @Query("UPDATE observations SET validation_error_count=:errors, validation_warning_count=:warnings, validation_info_count=:info, overall_quality_score=:score WHERE owner_uid=:ownerUid AND submission_id=:submissionId")
    suspend fun updateValidation(ownerUid: String, submissionId: String, errors: Int, warnings: Int, info: Int, score: Double?)

    @Query("SELECT * FROM revisions WHERE submission_id = :submissionId AND owner_uid = :ownerUid ORDER BY revision_no") suspend fun revisions(ownerUid: String, submissionId: String): List<RevisionEntity>
    @Query("SELECT * FROM revisions WHERE revision_id = :revisionId AND owner_uid = :ownerUid") suspend fun revision(ownerUid: String, revisionId: String): RevisionEntity?
    @Insert(onConflict = OnConflictStrategy.ABORT) suspend fun insertRevision(value: RevisionEntity)

    @Query("SELECT * FROM sites WHERE active = 1 ORDER BY name") suspend fun sites(): List<CachedSiteEntity>
    @Query("SELECT * FROM sites WHERE site_id = :siteId") suspend fun site(siteId: String): CachedSiteEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putSites(values: List<CachedSiteEntity>)

    @Query("SELECT * FROM sync_queue WHERE submission_id = :submissionId AND owner_uid = :ownerUid") suspend fun queue(ownerUid: String, submissionId: String): SyncQueueEntity?
    @Query("SELECT * FROM sync_queue WHERE owner_uid = :ownerUid AND state != 'CONFIRMED' ORDER BY next_attempt_at") suspend fun pendingQueue(ownerUid: String): List<SyncQueueEntity>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putQueue(value: SyncQueueEntity)
    @Query("UPDATE sync_queue SET state=:state, attempts=:attempts, next_attempt_at=:nextAttemptAt, last_error=:error WHERE owner_uid=:ownerUid AND submission_id=:submissionId")
    suspend fun updateQueue(ownerUid: String, submissionId: String, state: String, attempts: Int, nextAttemptAt: Long, error: String?)

    @Query("SELECT * FROM validation_flags WHERE owner_uid=:ownerUid AND revision_id=:revisionId ORDER BY severity, rule_code")
    suspend fun validationFlags(ownerUid: String, revisionId: String): List<ValidationFlagEntity>
    @Query("DELETE FROM validation_flags WHERE owner_uid=:ownerUid AND revision_id=:revisionId")
    suspend fun deleteValidationFlags(ownerUid: String, revisionId: String)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putValidationFlags(values: List<ValidationFlagEntity>)
}

@Database(
    entities = [DraftEntity::class, ObservationEntity::class, RevisionEntity::class, LocalMeasurementEntity::class, LocalAttachmentEntity::class, CachedSiteEntity::class, SyncQueueEntity::class, ValidationFlagEntity::class],
    version = 4,
    exportSchema = true,
)
abstract class WatershedDatabase : RoomDatabase() {
    abstract fun dao(): MobileDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE sync_queue ADD COLUMN last_error TEXT")
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE attachments ADD COLUMN submission_id TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE attachments ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE attachments ADD COLUMN remote_storage_path TEXT")
                db.execSQL("ALTER TABLE attachments ADD COLUMN last_error TEXT")
            }
        }

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE observations ADD COLUMN validation_error_count INTEGER")
                db.execSQL("ALTER TABLE observations ADD COLUMN validation_warning_count INTEGER")
                db.execSQL("ALTER TABLE observations ADD COLUMN validation_info_count INTEGER")
                db.execSQL("ALTER TABLE observations ADD COLUMN overall_quality_score REAL")
                db.execSQL("CREATE TABLE IF NOT EXISTS validation_flags (owner_uid TEXT NOT NULL, revision_id TEXT NOT NULL, flag_id TEXT NOT NULL, severity TEXT NOT NULL, rule_code TEXT NOT NULL, message TEXT NOT NULL, PRIMARY KEY(owner_uid, revision_id, flag_id))")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_validation_flags_owner_uid ON validation_flags(owner_uid)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_validation_flags_revision_id ON validation_flags(revision_id)")
            }
        }

        fun open(context: Context): WatershedDatabase = try {
            Room.databaseBuilder(context, WatershedDatabase::class.java, "pa_watershed_watch.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                .build()
        } catch (error: Exception) {
            throw LocalStoreUnavailableException(error)
        }
    }
}

class LocalStoreUnavailableException(cause: Throwable) : IllegalStateException("Local scientific records are unavailable; no data was deleted.", cause)

class RoomMobileRepository(private val db: WatershedDatabase) : DraftRepository, ObservationRepository, AttachmentRepository {
    private val dao = db.dao()

    override suspend fun loadDraft(ownerUid: String): ObservationDraft? {
        val entity = dao.draft(ownerUid) ?: return null
        val measurements = dao.measurements(ownerUid, entity.revisionId)
        return entity.toDomain(measurements, dao.attachments(ownerUid, entity.revisionId))
    }

    override suspend fun saveDraft(draft: ObservationDraft) = db.withTransaction {
        require(draft.ownerUid.isNotBlank())
        dao.putDraft(draft.toEntity())
        dao.deleteMeasurements(draft.ownerUid, draft.revisionId.value)
        dao.putMeasurements(draft.localMeasurements())
        dao.deleteAttachments(draft.ownerUid, draft.revisionId.value)
        dao.putAttachments(draft.attachments.map(ObservationAttachment::toEntity))
    }

    override suspend fun deleteDraft(ownerUid: String, submissionId: SubmissionId) {
        val draft = dao.draft(ownerUid)?.takeIf { it.submissionId == submissionId.value } ?: return
        db.withTransaction {
            dao.deleteMeasurements(ownerUid, draft.revisionId)
            dao.deleteAttachments(ownerUid, draft.revisionId)
            dao.deleteDraft(ownerUid, submissionId.value)
        }
    }

    override suspend fun loadRecords(ownerUid: String): List<ObservationRecord> = dao.observations(ownerUid).mapNotNull { parent ->
        val revisions = dao.revisions(ownerUid, parent.submissionId)
        val current = revisions.firstOrNull { it.revisionId == parent.currentRevisionId } ?: return@mapNotNull null
        val site = dao.site(parent.siteId)?.toDomain() ?: Site(parent.siteId, "Cached site unavailable", "", "", 0.0, 0.0, true, "")
        val measurements = dao.measurements(ownerUid, current.revisionId).mapNotNull(LocalMeasurementEntity::toDisplayValue)
        val attachments = dao.attachments(ownerUid, current.revisionId).map(LocalAttachmentEntity::toDomain)
        ObservationRecord(
            id = parent.submissionId,
            eventId = EventId(parent.eventId),
            currentRevisionId = RevisionId(parent.currentRevisionId),
            ownerUid = parent.ownerUid,
            site = site,
            collectedAt = current.collectedAt,
            collector = current.collector,
            testType = TestType.entries.first { it.label == current.testType },
            method = current.method,
            instrument = current.instrument,
            measurements = measurements,
            notes = current.notes.orEmpty(),
            attachments = attachments,
            workflow = parent.workflowState.enumOr(WorkflowState.Submitted),
            sync = parent.syncState.enumOr(SyncState.Waiting),
            revision = parent.currentRevisionNo,
            correctionReason = parent.correctionReason,
            revisions = revisions.map { Revision(it.revisionNo, it.submittedAt, it.workflowState.enumOr(WorkflowState.Submitted), it.revisionNote, emptyList()) },
            latitude = current.latitude,
            longitude = current.longitude,
            accuracyMeters = current.accuracyM,
            validation = parent.validationErrorCount?.let {
                ValidationSummary(it, parent.validationWarningCount ?: 0, parent.validationInfoCount ?: 0, parent.overallQualityScore)
            },
            validationFlags = dao.validationFlags(ownerUid, current.revisionId).map {
                ValidationFlag(it.flagId, it.severity, it.ruleCode, it.message)
            },
        )
    }

    override suspend fun persistSubmission(draft: ObservationDraft, workflow: WorkflowState, sync: SyncState, revisionNote: String): ObservationRecord {
        val snapshot = draft.toCanonicalSnapshot(draft.ownerUid, BuildConfig.VERSION_NAME)
        val existing = dao.observation(draft.ownerUid, draft.submissionId.value)
        if (draft.isCorrection) {
            require(existing != null && existing.eventId == draft.eventId.value) { "Correction must preserve submission and event identity" }
            require(existing.workflowState == WorkflowState.NeedsCorrection.name) { "Correction is not currently requested" }
            require(draft.revisionNo == existing.currentRevisionNo + 1 && revisionNote.isNotBlank()) { "Correction must append the next revision with a source-check note" }
            require(workflow == WorkflowState.Resubmitted) { "Correction must be resubmitted" }
        } else {
            require(existing == null && draft.revisionNo == 1 && workflow == WorkflowState.Submitted) { "New submission identity is already in use" }
        }
        val parent = ObservationEntity(
            snapshot.submissionId.value, snapshot.eventId.value, snapshot.ownerUid, snapshot.siteId.value,
            snapshot.revisionId.value, snapshot.revisionNo, workflow.name, sync.name,
            if (workflow == WorkflowState.Resubmitted) null else existing?.correctionReason, snapshot.submittedAt,
        )
        val revision = snapshot.toEntity(workflow, revisionNote)
        db.withTransaction {
            dao.insertRevision(revision)
            dao.deleteMeasurements(snapshot.ownerUid, snapshot.revisionId.value)
            dao.putMeasurements(snapshot.measurements.map { it.toEntity(snapshot) } + draft.temperatureEntity())
            dao.deleteAttachments(snapshot.ownerUid, snapshot.revisionId.value)
            dao.putAttachments(snapshot.attachments.map(ObservationAttachment::toEntity))
            dao.putObservation(parent)
            dao.putQueue(SyncQueueEntity(snapshot.submissionId.value, snapshot.revisionId.value, snapshot.ownerUid, "WAITING", 0, 0, null))
            dao.deleteDraft(snapshot.ownerUid, snapshot.submissionId.value)
        }
        return requireNotNull(loadRecords(snapshot.ownerUid).firstOrNull { it.id == snapshot.submissionId.value })
    }

    override suspend fun updateRemoteState(
        ownerUid: String,
        submissionId: SubmissionId,
        workflow: WorkflowState,
        sync: SyncState,
        correctionReason: String?,
        validation: ValidationSummary?,
        flags: List<ValidationFlag>,
    ) = db.withTransaction {
        dao.updateObservation(ownerUid, submissionId.value, workflow.name, sync.name, correctionReason, System.currentTimeMillis())
        if (validation != null) dao.updateValidation(ownerUid, submissionId.value, validation.errorCount, validation.warningCount, validation.infoCount, validation.overallQualityScore)
        val currentRevision = dao.observation(ownerUid, submissionId.value)?.currentRevisionId
        if (currentRevision != null && (validation != null || flags.isNotEmpty())) {
            dao.deleteValidationFlags(ownerUid, currentRevision)
            dao.putValidationFlags(flags.map { ValidationFlagEntity(ownerUid, currentRevision, it.id, it.severity, it.ruleCode, it.message) })
        }
    }

    override suspend fun add(draft: ObservationDraft, attachment: ObservationAttachment): ObservationDraft =
        draft.copy(attachments = draft.attachments + attachment).also { saveDraft(it) }

    override suspend fun remove(draft: ObservationDraft, attachmentId: AttachmentId): ObservationDraft {
        val attachment = draft.attachments.firstOrNull { it.id == attachmentId }
        val updated = draft.copy(attachments = draft.attachments.filterNot { it.id == attachmentId })
        saveDraft(updated)
        attachment?.localPath?.let { java.io.File(it) }?.takeIf { it.exists() }?.delete()
        return updated
    }
}

private fun DraftEntity.toDomain(measurements: List<LocalMeasurementEntity>, attachments: List<LocalAttachmentEntity>) = ObservationDraft(
    submissionId = SubmissionId(submissionId), eventId = EventId(eventId), revisionId = RevisionId(revisionId), revisionNo = revisionNo,
    ownerUid = ownerUid, createdAt = createdAt, siteId = siteId, collectedAt = collectedAt, collector = collector,
    latitude = latitude, longitude = longitude, accuracyMeters = accuracyM, gpsState = gpsState.enumOr(GpsState.Acquiring),
    testType = testType?.let { name -> TestType.entries.firstOrNull { it.name == name } }, testTypeOther = testTypeOther,
    method = method, instrument = instrument, labResultsPending = labResultsPending,
    requestedAnalytes = requestedAnalytes.split(',').mapNotNull { name -> MeasurementKind.entries.firstOrNull { it.name == name } }.toSet(),
    values = measurements.associate { it.kind.enumOr(MeasurementKind.Temperature) to it.rawValue },
    unitIds = measurements.associate { it.kind.enumOr(MeasurementKind.Temperature) to it.rawUnitId }, notes = notes,
    attachments = attachments.map(LocalAttachmentEntity::toDomain), currentStep = currentStep, isCorrection = isCorrection,
    sourceRecordId = sourceSubmissionId, baseRevision = baseRevision, correctionReason = correctionReason,
    revisionNote = revisionNote, lastSavedAt = lastSavedAt,
)

private fun ObservationDraft.toEntity() = DraftEntity(
    submissionId.value, eventId.value, revisionId.value, revisionNo, ownerUid, createdAt, siteId, collectedAt, collector,
    latitude, longitude, accuracyMeters, gpsState.name, testType?.name, testTypeOther, method, instrument, labResultsPending,
    requestedAnalytes.joinToString(",") { it.name }, notes, currentStep, isCorrection, sourceRecordId, baseRevision,
    correctionReason, revisionNote, lastSavedAt,
)

private fun ObservationDraft.localMeasurements() = values.map { (kind, raw) ->
    val spec = ProductionMeasurementCatalog.spec(kind)
    val unit = selectedUnit(kind)
    val numeric = raw.toDoubleOrNull()
    val canonical = numeric?.takeIf(Double::isFinite)?.let { unit.convert(it, kind.units.first()) }
    LocalMeasurementEntity(
        revisionId.value, kind.name, CanonicalIds.measurement(revisionId, spec.parameterCode ?: "LOCAL_${kind.name}").value,
        ownerUid, spec.parameterCode, raw, unit.id, canonical, spec.canonicalUnit,
    )
}

private fun ObservationDraft.temperatureEntity(): LocalMeasurementEntity {
    val raw = values[MeasurementKind.Temperature].orEmpty()
    return LocalMeasurementEntity(
        revisionId.value, MeasurementKind.Temperature.name,
        CanonicalIds.measurement(revisionId, "WATER_TEMP_C").value, ownerUid, "WATER_TEMP_C", raw,
        selectedUnit(MeasurementKind.Temperature).id, raw.toDoubleOrNull()?.let { selectedUnit(MeasurementKind.Temperature).convert(it, Units.Celsius) }, "degC",
    )
}

private fun CanonicalObservationSnapshot.toEntity(workflow: WorkflowState, note: String) = RevisionEntity(
    revisionId.value, submissionId.value, eventId.value, revisionNo, ownerUid, siteId.value, createdAt, collectedAt,
    submittedAt, collectorDisplayName, latitude, longitude, gpsAccuracyM, testType, testTypeOther, methodName,
    instrumentName, fieldNotes, temperatureEnteredValue, temperatureEnteredUnit, tempC, tempF, workflow.name, note, appVersion,
)

private fun CanonicalMeasurement.toEntity(snapshot: CanonicalObservationSnapshot) = LocalMeasurementEntity(
    snapshot.revisionId.value, kind.name, id.value, snapshot.ownerUid, parameterCode, enteredValue.toString(),
    enteredUnitId, value, unitCode,
)

private fun ObservationAttachment.toEntity() = LocalAttachmentEntity(
    id.value, ownerUid, submissionId.value, revisionId.value, localPath, contentType, sizeBytes, kind.name, caption,
    createdAt, transferState.name, remoteStoragePath, lastError,
)

private fun LocalAttachmentEntity.toDomain() = ObservationAttachment(
    id = AttachmentId(attachmentId), ownerUid = ownerUid, submissionId = SubmissionId(submissionId), revisionId = RevisionId(revisionId),
    localPath = localPath, contentType = contentType, sizeBytes = sizeBytes, kind = kind.enumOr(AttachmentKind.OTHER), caption = caption,
    createdAt = createdAt, transferState = transferState.enumOr(AttachmentTransferState.LOCAL_ONLY),
    remoteStoragePath = remoteStoragePath, lastError = lastError,
)

private fun LocalMeasurementEntity.toDisplayValue(): MeasurementValue? {
    val kind = MeasurementKind.entries.firstOrNull { it.name == this.kind } ?: return null
    val unit = Units.byId(rawUnitId) ?: kind.units.first()
    return MeasurementValue(kind, rawValue, unit.id)
}

private fun CachedSiteEntity.toDomain() = Site(siteId, name, county, watershed, latitude, longitude, true, "")

internal inline fun <reified T : Enum<T>> String.enumOr(fallback: T): T = enumValues<T>().firstOrNull { it.name == this } ?: fallback
