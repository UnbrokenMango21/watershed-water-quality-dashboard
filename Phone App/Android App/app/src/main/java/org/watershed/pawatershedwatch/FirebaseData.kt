package org.watershed.pawatershedwatch

import android.app.Application
import android.net.Uri
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.google.android.gms.tasks.Task
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageException
import com.google.firebase.storage.StorageMetadata
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PAWatershedApplication : Application() {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        installAppCheckProvider()
        val database = WatershedDatabase.open(this)
        graph = AppGraph(this, database)
    }
}

class AppGraph(application: Application, val database: WatershedDatabase) {
    val auth: AuthRepository = FirebaseAuthRepository(FirebaseAuth.getInstance())
    val local = RoomMobileRepository(database)
    val sites: SiteRepository = FirebaseSiteRepository(FirebaseFirestore.getInstance(), database.dao())
    val sync: SyncRepository = FirebaseSyncRepository(
        application, FirebaseAuth.getInstance(), FirebaseFirestore.getInstance(), FirebaseStorage.getInstance(), database.dao(), local,
    )
}

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
    addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
    addOnCanceledListener { continuation.cancel() }
}

class FirebaseAuthRepository(private val auth: FirebaseAuth) : AuthRepository {
    override val account: Flow<AuthAccount?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { current ->
            val user = current.currentUser
            trySend(user?.let { AuthAccount(it.uid, it.email, it.displayName ?: it.email?.substringBefore('@').orEmpty()) })
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    override suspend fun signIn(email: String, password: String): Result<AuthAccount> = runCatching {
        val user = auth.signInWithEmailAndPassword(email.trim(), password).awaitResult().user
            ?: error("Authentication did not return an account")
        AuthAccount(user.uid, user.email, user.displayName ?: user.email?.substringBefore('@').orEmpty())
    }

    override fun signOut() = auth.signOut()
}

class FirebaseSiteRepository(
    private val firestore: FirebaseFirestore,
    private val dao: MobileDao,
) : SiteRepository {
    override suspend fun cached(ownerUid: String): List<Site> {
        require(ownerUid.isNotBlank())
        return dao.sites().map { Site(it.siteId, it.name, it.county, it.watershed, it.latitude, it.longitude, true, "") }
    }

    override suspend fun refresh(ownerUid: String): Result<List<Site>> = runCatching {
        require(ownerUid.isNotBlank())
        val snapshot = firestore.collection("siteCatalog").whereEqualTo("active", true).get(Source.SERVER).awaitResult()
        val sites = snapshot.documents.mapNotNull { it.toSafeSite() }
        dao.putSites(sites.map {
            CachedSiteEntity(it.id, it.name, it.county, it.watershed, it.latitude, it.longitude, true, System.currentTimeMillis())
        })
        sites
    }

    private fun DocumentSnapshot.toSafeSite(): Site? {
        val siteId = getString("site_id")?.takeIf { it == id } ?: return null
        val name = getString("site_name_display")?.takeIf(String::isNotBlank) ?: return null
        val latitude = getDouble("latitude") ?: getGeoPoint("location")?.latitude ?: return null
        val longitude = getDouble("longitude") ?: getGeoPoint("location")?.longitude ?: return null
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return null
        return Site(siteId, name, getString("county_display").orEmpty(), getString("watershed_display").orEmpty(), latitude, longitude, false, "")
    }
}

class FirebaseSyncRepository(
    private val application: Application,
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val storage: FirebaseStorage,
    private val dao: MobileDao,
    private val local: ObservationRepository,
) : SyncRepository {
    override suspend fun enqueue(ownerUid: String, submissionId: SubmissionId, revisionId: RevisionId) {
        dao.putQueue(SyncQueueEntity(submissionId.value, revisionId.value, ownerUid, "WAITING", 0, 0, null))
        val request = OneTimeWorkRequestBuilder<ObservationSyncWorker>()
            .setInputData(workDataOf("ownerUid" to ownerUid, "submissionId" to submissionId.value))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag("observation-sync")
            .build()
        WorkManager.getInstance(application).enqueueUniqueWork("sync-$ownerUid-${submissionId.value}", ExistingWorkPolicy.KEEP, request)
    }

    override suspend fun sync(ownerUid: String, submissionId: SubmissionId): SyncAttempt {
        if (auth.currentUser?.uid != ownerUid) return SyncAttempt(false, true, "Authenticated account does not own this queue item")
        val parent = dao.observation(ownerUid, submissionId.value) ?: return SyncAttempt(false, false, "Local submission is missing")
        val revision = dao.revision(ownerUid, parent.currentRevisionId) ?: return SyncAttempt(false, false, "Local revision is missing")
        val queue = dao.queue(ownerUid, submissionId.value) ?: return SyncAttempt(false, false, "Sync queue item is missing")
        val snapshot = revision.snapshot(
            dao.measurements(ownerUid, revision.revisionId),
            dao.attachments(ownerUid, revision.revisionId).map(LocalAttachmentEntity::asDomain),
        )
        val parentRef = firestore.collection("submissions").document(submissionId.value)
        val revisionRef = parentRef.collection("revisions").document(snapshot.revisionId.value)
        return try {
            dao.updateQueue(ownerUid, submissionId.value, "SYNCING", queue.attempts + 1, 0, null)
            local.updateRemoteState(ownerUid, submissionId, parent.workflowState.enumOr(WorkflowState.Submitted), SyncState.Syncing)
            val remoteParent = parentRef.get(Source.SERVER).awaitResult()
            if (remoteParent.exists()) {
                require(remoteParent.getString("collector_user_id") == ownerUid) { "Remote ownership mismatch" }
                require(remoteParent.getString("event_id") == snapshot.eventId.value) { "Remote event identity mismatch" }
                val remoteStatus = remoteParent.getString("status")
                val remoteRevision = remoteParent.getString("current_revision_id")
                if (remoteRevision == snapshot.revisionId.value && remoteStatus in SERVER_ACK_STATES) {
                    return confirm(ownerUid, submissionId, remoteStatus, remoteParent.getString("review_comment"))
                }
                if (snapshot.correction) require(remoteStatus == "NEEDS_CORRECTION") { "Correction parent is not awaiting correction" }
            } else {
                require(!snapshot.correction) { "Correction parent does not exist" }
                parentRef.set(FirestoreObservationMapper.submission(snapshot, "DRAFT")).awaitResult()
            }

            val remoteRevision = revisionRef.get(Source.SERVER).awaitResult()
            if (!remoteRevision.exists()) {
                revisionRef.set(FirestoreObservationMapper.revision(snapshot, "DRAFT")).awaitResult()
            } else {
                require(remoteRevision.getString("revision_status") == "DRAFT") { "Remote revision is immutable" }
            }
            snapshot.measurements.forEach { value ->
                revisionRef.collection("measurements").document(value.id.value)
                    .set(FirestoreObservationMapper.measurement(snapshot, value)).awaitResult()
            }
            // One unreachable photo must not stop its siblings from uploading. Rules only accept
            // measurement and attachment writes while the revision is still DRAFT, so the status
            // transition below cannot be hoisted above this loop; instead every attachment gets its
            // own attempt and the first failure is rethrown afterwards so the retry can finish the
            // rest without locking the revision on a partial media set.
            val attachmentFailures = mutableListOf<Exception>()
            snapshot.attachments.forEach { attachment ->
                try {
                    val storagePath = attachment.storagePath(snapshot)
                    uploadIfNeeded(attachment, storagePath, snapshot)
                    revisionRef.collection("attachments").document(attachment.id.value)
                        .set(FirestoreObservationMapper.attachment(snapshot, attachment, storagePath)).awaitResult()
                } catch (cancellation: CancellationException) {
                    throw cancellation
                } catch (error: Exception) {
                    attachmentFailures += error
                }
            }
            attachmentFailures.firstOrNull()?.let { throw it }
            require(revisionRef.get(Source.SERVER).awaitResult().exists())
            for (measurement in snapshot.measurements) {
                require(revisionRef.collection("measurements").document(measurement.id.value).get(Source.SERVER).awaitResult().exists())
            }
            for (attachment in snapshot.attachments) {
                require(revisionRef.collection("attachments").document(attachment.id.value).get(Source.SERVER).awaitResult().exists())
            }
            revisionRef.update(mapOf("revision_status" to "SUBMITTED", "submitted_at" to FieldValue.serverTimestamp())).awaitResult()
            val target = if (snapshot.correction) "RESUBMITTED" else "SUBMITTED"
            parentRef.update(
                mapOf(
                    "status" to target,
                    "current_revision_id" to snapshot.revisionId.value,
                    "current_revision_no" to snapshot.revisionNo,
                    "latest_collected_at" to com.google.firebase.Timestamp(java.util.Date(snapshot.collectedAt)),
                    "updated_at" to FieldValue.serverTimestamp(),
                    "submitted_at" to FieldValue.serverTimestamp(),
                    "mobile_app_version" to snapshot.appVersion,
                ),
            ).awaitResult()
            val acknowledged = parentRef.get(Source.SERVER).awaitResult()
            val status = acknowledged.getString("status") ?: target
            require(status in SERVER_ACK_STATES) { "Server did not acknowledge submission" }
            confirm(ownerUid, submissionId, status, acknowledged.getString("review_comment"))
        } catch (error: Exception) {
            val attempts = queue.attempts + 1
            val message = error.message?.take(300)
            dao.updateQueue(ownerUid, submissionId.value, "FAILED", attempts, System.currentTimeMillis() + 30_000, message)
            local.updateRemoteState(ownerUid, submissionId, parent.workflowState.enumOr(WorkflowState.Submitted), SyncState.Failed)
            SyncAttempt(false, error !is IllegalArgumentException && error !is IllegalStateException, message)
        }
    }

    override fun observe(ownerUid: String, onChange: (RemoteSubmissionState) -> Unit): AutoCloseable {
        val registration = firestore.collection("submissions")
            .whereEqualTo("collector_user_id", ownerUid)
            .addSnapshotListener { snapshot, _ ->
                snapshot?.documents?.forEach { document ->
                    val rawStatus = document.getString("status").orEmpty()
                    if (rawStatus !in SERVER_ACK_STATES) return@forEach
                    val status = WorkflowState.fromBackend(rawStatus) ?: return@forEach
                    val validation = document.getLong("error_flag_count")?.let {
                        ValidationSummary(
                            it.toInt(), document.getLong("warning_flag_count")?.toInt() ?: 0,
                            document.getLong("info_flag_count")?.toInt() ?: 0, document.getDouble("overall_quality_score"),
                        )
                    }
                    val base = RemoteSubmissionState(SubmissionId(document.id), status, document.getString("review_comment"), true, validation)
                    val revisionId = document.getString("current_revision_id")
                    if (revisionId.isNullOrBlank()) onChange(base)
                    else document.reference.collection("revisions").document(revisionId).collection("validationFlags")
                        .get(Source.SERVER)
                        .addOnSuccessListener { flags ->
                            onChange(base.copy(flags = flags.documents.mapNotNull { flag ->
                                val severity = flag.getString("severity") ?: return@mapNotNull null
                                ValidationFlag(flag.id, severity, flag.getString("rule_code").orEmpty(), flag.getString("message").orEmpty())
                            }))
                        }
                        .addOnFailureListener { onChange(base) }
                }
            }
        return AutoCloseable { registration.remove() }
    }

    private suspend fun confirm(ownerUid: String, submissionId: SubmissionId, remoteStatus: String?, reason: String?): SyncAttempt {
        val workflow = requireNotNull(WorkflowState.fromBackend(remoteStatus.orEmpty())) { "Unknown server workflow state" }
        dao.updateQueue(ownerUid, submissionId.value, "CONFIRMED", dao.queue(ownerUid, submissionId.value)?.attempts ?: 1, 0, null)
        local.updateRemoteState(ownerUid, submissionId, workflow, SyncState.Synced, reason)
        return SyncAttempt(true, false)
    }

    private suspend fun uploadIfNeeded(attachment: ObservationAttachment, storagePath: String, snapshot: CanonicalObservationSnapshot) {
        val reference = storage.reference.child(storagePath)
        dao.updateAttachmentTransfer(snapshot.ownerUid, attachment.id.value, "UPLOADING", null, null)
        try {
            val exists = try {
                val metadata = reference.metadata.awaitResult()
                require(
                    metadata.getCustomMetadata("ownerUid") == snapshot.ownerUid &&
                        metadata.getCustomMetadata("submissionId") == snapshot.submissionId.value &&
                        metadata.getCustomMetadata("revisionId") == snapshot.revisionId.value &&
                        metadata.getCustomMetadata("attachmentId") == attachment.id.value &&
                        metadata.contentType == attachment.contentType && metadata.sizeBytes == attachment.sizeBytes,
                ) { "Remote attachment identity does not match the queued file" }
                true
            } catch (error: StorageException) {
                if (error.errorCode == StorageException.ERROR_OBJECT_NOT_FOUND) false else throw error
            }
            if (!exists) {
                val file = File(attachment.localPath)
                require(file.isFile && file.length() == attachment.sizeBytes && attachment.sizeBytes in 1..MAX_ATTACHMENT_BYTES) {
                    "Attachment file is missing or changed"
                }
                val metadata = StorageMetadata.Builder()
                    .setContentType(attachment.contentType)
                    .setCustomMetadata("ownerUid", snapshot.ownerUid)
                    .setCustomMetadata("submissionId", snapshot.submissionId.value)
                    .setCustomMetadata("revisionId", snapshot.revisionId.value)
                    .setCustomMetadata("attachmentId", attachment.id.value)
                    .build()
                reference.putFile(Uri.fromFile(file), metadata).awaitResult()
            }
            dao.updateAttachmentTransfer(snapshot.ownerUid, attachment.id.value, "UPLOADED", storagePath, null)
        } catch (error: Exception) {
            dao.updateAttachmentTransfer(snapshot.ownerUid, attachment.id.value, "FAILED", null, error.message?.take(300))
            throw error
        }
    }

    private fun ObservationAttachment.storagePath(snapshot: CanonicalObservationSnapshot): String {
        val extension = when (contentType) {
            "image/jpeg" -> "jpg"
            "image/png" -> "png"
            "image/heic" -> "heic"
            "audio/mp4", "audio/m4a" -> "m4a"
            "application/pdf" -> "pdf"
            else -> error("Unsupported attachment MIME type")
        }
        return "users/${snapshot.ownerUid}/submissions/${snapshot.submissionId.value}/revisions/${snapshot.revisionId.value}/${id.value}.$extension"
    }

    companion object {
        private const val MAX_ATTACHMENT_BYTES = 50L * 1024 * 1024
        private val SERVER_ACK_STATES = setOf(
            "SUBMITTED", "VALIDATING", "PENDING_REVIEW", "NEEDS_CORRECTION", "RESUBMITTED", "APPROVED", "REJECTED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED",
        )
    }
}

class ObservationSyncWorker(application: android.content.Context, params: WorkerParameters) : CoroutineWorker(application, params) {
    override suspend fun doWork(): Result {
        val ownerUid = inputData.getString("ownerUid") ?: return Result.failure()
        val submissionId = inputData.getString("submissionId") ?: return Result.failure()
        val graph = (applicationContext as PAWatershedApplication).graph
        val attempt = graph.sync.sync(ownerUid, SubmissionId(submissionId))
        return when {
            attempt.confirmed -> Result.success()
            attempt.retryable -> Result.retry()
            else -> Result.failure(workDataOf("error" to attempt.message))
        }
    }
}

private fun RevisionEntity.snapshot(measurements: List<LocalMeasurementEntity>, attachments: List<ObservationAttachment>): CanonicalObservationSnapshot {
    val canonicalMeasurements = measurements.mapNotNull { entity ->
        val kind = MeasurementKind.entries.firstOrNull { it.name == entity.kind } ?: return@mapNotNull null
        if (kind == MeasurementKind.Temperature || entity.parameterCode == null || entity.canonicalValue == null || entity.canonicalUnit == null) return@mapNotNull null
        CanonicalMeasurement(
            MeasurementId(entity.measurementId), kind, entity.parameterCode, kind.title,
            entity.rawValue.toDouble(), entity.rawUnitId, Units.byId(entity.rawUnitId)?.menuTitle.orEmpty(), entity.canonicalValue, entity.canonicalUnit,
        )
    }
    return CanonicalObservationSnapshot(
        SubmissionId(submissionId), EventId(eventId), RevisionId(revisionId), revisionNo, ownerUid, SiteId(siteId), createdAt,
        collectedAt, submittedAt, latitude, longitude, accuracyM, collector, testType, testTypeOther, method, instrument, notes,
        tempEnteredValue, tempEnteredUnit, tempC, tempF, canonicalMeasurements, attachments, appVersion, revisionNo > 1,
    )
}

private fun LocalAttachmentEntity.asDomain() = ObservationAttachment(
    id = AttachmentId(attachmentId), ownerUid = ownerUid, submissionId = SubmissionId(submissionId), revisionId = RevisionId(revisionId),
    localPath = localPath, contentType = contentType, sizeBytes = sizeBytes, kind = kind.enumOr(AttachmentKind.OTHER), caption = caption,
    createdAt = createdAt, transferState = transferState.enumOr(AttachmentTransferState.LOCAL_ONLY),
    remoteStoragePath = remoteStoragePath, lastError = lastError,
)
