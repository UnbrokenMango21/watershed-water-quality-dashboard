package org.watershed.pawatershedwatch

import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.suspendCancellableCoroutine
import java.text.Normalizer
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

// Submission discussion and coordinate proposals. Every write goes through a server callable
// (functions/index.mjs); the app only reads the rules-scoped documents it is allowed to see.

/** Message kinds a collector can see. ADMINISTRATIVE_NOTE lives in reviewer-only internalNotes and is never read. */
enum class MessageKind(val backendValue: String, val label: String) {
    CollectorComment("COLLECTOR_COMMENT", "Collector comment"),
    ReviewerQuestion("REVIEWER_QUESTION", "Reviewer question"),
    CorrectionRequest("CORRECTION_REQUEST", "Request for correction"),
    ReviewDecision("REVIEW_DECISION", "Review decision");

    companion object {
        fun fromBackend(value: String?): MessageKind? = entries.firstOrNull { it.backendValue == value }
    }
}

fun senderRoleLabel(role: String?): String = when (role) {
    "QC_REVIEWER" -> "QC reviewer"
    "ADMIN" -> "Administrator"
    "COLLECTOR" -> "Collector"
    else -> "Participant"
}

data class SubmissionMessage(
    val id: String,
    val revisionId: String,
    val senderName: String,
    val senderRole: String,
    val kind: MessageKind,
    val text: String,
    val createdAt: Long?,
    val decision: String? = null,
)

const val MESSAGE_MAX_CHARS = 4000

/** Why a reply cannot be sent yet, or null. Mirrors the sendSubmissionMessage server checks. */
fun messageProblem(text: String): String? = when {
    text.isBlank() -> "Write a message before sending."
    text.length > MESSAGE_MAX_CHARS -> "Messages can be at most $MESSAGE_MAX_CHARS characters."
    else -> null
}

/**
 * A client-generated message ID reused when the same text is retried, so a retry after an
 * ambiguous network failure never posts a duplicate. Different text gets a fresh ID.
 */
data class OutgoingMessage(val submissionId: String, val messageId: String, val text: String) {
    companion object {
        fun next(previous: OutgoingMessage?, submissionId: String, text: String): OutgoingMessage {
            val trimmed = text.trim()
            return if (previous != null && previous.submissionId == submissionId && previous.text == trimmed) previous
            else OutgoingMessage(submissionId, UUID.randomUUID().toString().lowercase(Locale.US), trimmed)
        }
    }
}

enum class ProposalKind(val backendValue: String, val label: String) {
    NewSite("NEW_SITE", "New site"),
    CoordinateCorrection("COORDINATE_CORRECTION", "Coordinate correction");

    companion object {
        fun fromBackend(value: String?): ProposalKind? = entries.firstOrNull { it.backendValue == value }
    }
}

enum class ProposalStatus(val backendValue: String, val label: String) {
    Pending("PENDING", "Pending review"),
    Approved("APPROVED", "Approved"),
    Rejected("REJECTED", "Rejected");

    companion object {
        fun fromBackend(value: String?): ProposalStatus? = entries.firstOrNull { it.backendValue == value }
    }
}

data class Coordinates(val latitude: Double, val longitude: Double) {
    val display: String get() = String.format(Locale.US, "%.5f, %.5f", latitude, longitude)
}

data class CoordinateProposal(
    val id: String,
    val kind: ProposalKind,
    val siteId: String?,
    val proposed: Coordinates,
    val original: Coordinates?,
    val gpsAccuracyM: Double?,
    val reason: String,
    val proposedSiteName: String?,
    val status: ProposalStatus,
    val decisionReason: String?,
    val createdAt: Long?,
    val decidedAt: Long?,
)

/** Exactly the callable payload; validated on the phone with the server's own limits. */
data class CoordinateProposalRequest(
    val proposalId: String,
    val kind: ProposalKind,
    val siteId: String?,
    val latitude: Double,
    val longitude: Double,
    val gpsAccuracyM: Double?,
    val reason: String,
    val proposedSiteName: String?,
) {
    fun payload(): Map<String, Any?> = buildMap {
        put("proposalId", proposalId)
        put("kind", kind.backendValue)
        if (kind == ProposalKind.CoordinateCorrection) put("siteId", siteId)
        put("latitude", latitude)
        put("longitude", longitude)
        put("gpsAccuracyM", gpsAccuracyM)
        put("reason", ProposalText.normalized(reason))
        if (kind == ProposalKind.NewSite) put("proposedSiteName", proposedSiteName?.let(ProposalText::normalized))
    }

    /**
     * Same content (ignoring the ID) means a retry, which must reuse the same proposal ID. Compared on the
     * normalized payload, so a retry that differs only in line breaks or spacing keeps its fingerprint.
     */
    fun sameContent(other: CoordinateProposalRequest?): Boolean = other != null && copy(proposalId = other.proposalId).payload() == other.payload()

    companion object {
        fun newId(): String = UUID.randomUUID().toString().lowercase(Locale.US)
    }
}

/**
 * Text rules mirrored from `profile/coordinate_proposals.mjs` (and iOS SiteProposalText): Unicode NFC,
 * whitespace runs (including line breaks) collapsed to one space, trimmed, lengths counted in code points.
 * The server rejects raw control characters, so line breaks typed in the multi-line reason are sent as spaces.
 */
object ProposalText {
    // JavaScript's \s: ASCII whitespace, Unicode space separators, line/paragraph separators and U+FEFF.
    private val whitespace = Regex("[\\s\\p{Z}\\uFEFF]+")
    private val control = Regex("[\\u0000-\\u001f\\u007f]")

    fun normalized(raw: String): String =
        Normalizer.normalize(raw, Normalizer.Form.NFC).replace(whitespace, " ").trim(' ')

    fun length(value: String): Int = value.codePointCount(0, value.length)

    fun hasControlCharacters(value: String): Boolean = control.containsMatchIn(value)
}

/** Every reason the proposal cannot be sent yet, in form order. Empty means ready. */
fun coordinateProposalProblems(
    kind: ProposalKind,
    siteId: String?,
    latitude: Double?,
    longitude: Double?,
    gpsAccuracyM: Double?,
    reason: String,
    proposedSiteName: String,
): List<String> = buildList {
    if (kind == ProposalKind.CoordinateCorrection && siteId.isNullOrBlank()) add("Choose the monitoring site to correct.")
    if (kind == ProposalKind.NewSite) {
        val name = ProposalText.normalized(proposedSiteName)
        if (ProposalText.hasControlCharacters(name)) add("Remove unsupported characters from the proposed site name.")
        else if (ProposalText.length(name) !in 2..160) add("Enter a proposed site name of 2 to 160 characters.")
    }
    if (latitude == null || longitude == null) add("Capture the current GPS position.")
    else if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0 || (latitude == 0.0 && longitude == 0.0)) {
        add("The GPS position is not valid. Capture it again.")
    }
    if (gpsAccuracyM != null && (!gpsAccuracyM.isFinite() || gpsAccuracyM < 0)) add("GPS accuracy must be a nonnegative number of meters, or unknown.")
    val normalizedReason = ProposalText.normalized(reason)
    if (ProposalText.hasControlCharacters(normalizedReason)) add("Remove unsupported characters from the reason.")
    else if (ProposalText.length(normalizedReason) !in 5..1000) add("Explain the proposal in 5 to 1000 characters.")
}

class CollaborationException(message: String) : Exception(message)

interface CollaborationRepository {
    suspend fun initializeAccount(displayName: String): Result<String>
    suspend fun updateDisplayName(displayName: String, verified: Boolean): Result<String>
    fun observeMessages(submissionId: String, onChange: (List<SubmissionMessage>) -> Unit, onError: (String) -> Unit): AutoCloseable
    suspend fun sendCollectorComment(submissionId: String, revisionId: String, messageId: String, text: String): Result<Unit>
    suspend fun proposeCoordinates(request: CoordinateProposalRequest): Result<ProposalStatus>
    fun observeProposals(uid: String, onChange: (List<CoordinateProposal>) -> Unit, onError: (String) -> Unit): AutoCloseable
}

class FirebaseCollaborationRepository(
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions,
) : CollaborationRepository {

    override suspend fun initializeAccount(displayName: String): Result<String> = call("initializeMyAccount", mapOf("displayName" to displayName.trim()))
        .map { displayName.trim() }

    override suspend fun updateDisplayName(displayName: String, verified: Boolean): Result<String> = runCatching {
        val name = displayName.trim()
        call("updateMyDisplayName", mapOf("displayName" to name)).getOrThrow()
        if (verified) call("initializeMyAccount", mapOf("displayName" to name)).getOrThrow()
        name
    }

    override fun observeMessages(submissionId: String, onChange: (List<SubmissionMessage>) -> Unit, onError: (String) -> Unit): AutoCloseable {
        val registration = firestore.collection("submissions").document(submissionId).collection("messages")
            .orderBy("created_at", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) onError(error.readMessage("The discussion"))
                else if (snapshot != null) onChange(snapshot.documents.mapNotNull { it.toMessage() })
            }
        return AutoCloseable { registration.remove() }
    }

    override suspend fun sendCollectorComment(submissionId: String, revisionId: String, messageId: String, text: String): Result<Unit> = call(
        "sendSubmissionMessage",
        mapOf("submissionId" to submissionId, "revisionId" to revisionId, "messageId" to messageId, "kind" to MessageKind.CollectorComment.backendValue, "text" to text.trim()),
    ).map { }

    override suspend fun proposeCoordinates(request: CoordinateProposalRequest): Result<ProposalStatus> =
        call("proposeSiteCoordinates", request.payload()).map { result ->
            ProposalStatus.fromBackend((result as? Map<*, *>)?.get("status") as? String) ?: ProposalStatus.Pending
        }

    override fun observeProposals(uid: String, onChange: (List<CoordinateProposal>) -> Unit, onError: (String) -> Unit): AutoCloseable {
        // The rules let a collector read only their own proposals, so the query must say so.
        val registration = firestore.collection("siteCoordinateProposals")
            .whereEqualTo("submitted_by_uid", uid)
            .addSnapshotListener { snapshot, error ->
                if (error != null) onError(error.readMessage("Your coordinate proposals"))
                else if (snapshot != null) onChange(snapshot.documents.mapNotNull { it.toProposal() }.sortedByDescending { it.createdAt ?: Long.MAX_VALUE })
            }
        return AutoCloseable { registration.remove() }
    }

    private suspend fun call(name: String, data: Map<String, Any?>): Result<Any?> = runCatching {
        try {
            functions.getHttpsCallable(name).call(data).awaitTask().data
        } catch (error: FirebaseFunctionsException) {
            // The server's own human-readable message (HttpsError) is shown as-is.
            val message = error.message?.trim().orEmpty()
            throw CollaborationException(
                when {
                    error.code == FirebaseFunctionsException.Code.UNAVAILABLE || error.code == FirebaseFunctionsException.Code.DEADLINE_EXCEEDED ->
                        "The server could not be reached. Check your connection and try again."
                    message.isEmpty() || message.equals(error.code.name, ignoreCase = true) -> "The server could not complete this request."
                    else -> message
                },
            )
        } catch (error: FirebaseNetworkException) {
            throw CollaborationException("A network connection is required. Your field records remain on this phone.")
        }
    }
}

private fun FirebaseFirestoreException.readMessage(subject: String): String = when (code) {
    FirebaseFirestoreException.Code.PERMISSION_DENIED -> "$subject is not available to this account yet."
    FirebaseFirestoreException.Code.UNAVAILABLE -> "$subject cannot be loaded while offline."
    else -> "$subject could not be loaded. Try again later."
}

private fun DocumentSnapshot.toMessage(): SubmissionMessage? {
    val kind = MessageKind.fromBackend(getString("kind")) ?: return null
    val text = getString("text") ?: return null
    return SubmissionMessage(
        id = getString("message_id") ?: id,
        revisionId = getString("revision_id").orEmpty(),
        senderName = getString("sender_display_name")?.takeIf(String::isNotBlank) ?: "Unknown sender",
        senderRole = getString("sender_role").orEmpty(),
        kind = kind,
        text = text,
        createdAt = getTimestamp("created_at")?.toDate()?.time,
        decision = getString("decision"),
    )
}

private fun Map<*, *>.coordinates(): Coordinates? {
    val latitude = (get("latitude") as? Number)?.toDouble() ?: return null
    val longitude = (get("longitude") as? Number)?.toDouble() ?: return null
    return Coordinates(latitude, longitude)
}

private fun DocumentSnapshot.toProposal(): CoordinateProposal? {
    val kind = ProposalKind.fromBackend(getString("kind")) ?: return null
    val proposed = (get("proposed_coordinates") as? Map<*, *>)?.coordinates() ?: return null
    return CoordinateProposal(
        id = getString("proposal_id") ?: id,
        kind = kind,
        siteId = getString("site_id"),
        proposed = proposed,
        original = (get("original_coordinates") as? Map<*, *>)?.coordinates(),
        gpsAccuracyM = getDouble("gps_accuracy_m"),
        reason = getString("reason").orEmpty(),
        proposedSiteName = getString("proposed_site_name"),
        status = ProposalStatus.fromBackend(getString("status")) ?: ProposalStatus.Pending,
        decisionReason = getString("decision_reason"),
        createdAt = getTimestamp("created_at")?.toDate()?.time,
        decidedAt = getTimestamp("decided_at")?.toDate()?.time,
    )
}

internal suspend fun <T> Task<T>.awaitTask(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { if (continuation.isActive) continuation.resume(it) }
    addOnFailureListener { if (continuation.isActive) continuation.resumeWithException(it) }
    addOnCanceledListener { continuation.cancel() }
}
