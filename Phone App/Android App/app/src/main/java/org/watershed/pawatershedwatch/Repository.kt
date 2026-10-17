package org.watershed.pawatershedwatch

import kotlinx.coroutines.flow.Flow

data class AuthAccount(
    val uid: String,
    val email: String?,
    val displayName: String,
    val emailVerified: Boolean = false,
    /** The name on the Firebase Auth profile, mirrored by the server; null when none was ever set. */
    val profileName: String? = null,
    val hasVerifiedPhone: Boolean = false,
) {
    /** The server requires a verified email (or phone) before it creates or updates the profile. */
    val verified: Boolean get() = (emailVerified && !email.isNullOrBlank()) || hasVerifiedPhone
}

interface AuthRepository {
    val account: Flow<AuthAccount?>
    suspend fun signIn(email: String, password: String): Result<AuthAccount>
    /** Reloads the signed-in account so a just-confirmed email verification is seen. */
    suspend fun reload(): Result<AuthAccount?>
    suspend fun sendEmailVerification(): Result<Unit>
    fun signOut()
}

interface SiteRepository {
    suspend fun cached(ownerUid: String): List<Site>
    suspend fun refresh(ownerUid: String): Result<List<Site>>
}

interface DraftRepository {
    suspend fun loadDraft(ownerUid: String): ObservationDraft?
    suspend fun saveDraft(draft: ObservationDraft)
    suspend fun deleteDraft(ownerUid: String, submissionId: SubmissionId)
}

interface ObservationRepository {
    suspend fun loadRecords(ownerUid: String): List<ObservationRecord>
    suspend fun persistSubmission(draft: ObservationDraft, workflow: WorkflowState, sync: SyncState, revisionNote: String): ObservationRecord
    suspend fun updateRemoteState(
        ownerUid: String,
        submissionId: SubmissionId,
        workflow: WorkflowState,
        sync: SyncState,
        correctionReason: String? = null,
        validation: ValidationSummary? = null,
        flags: List<ValidationFlag> = emptyList(),
    )
}

interface SyncRepository {
    suspend fun saveFieldDraft(snapshot: CanonicalObservationSnapshot)
    suspend fun enqueue(ownerUid: String, submissionId: SubmissionId, revisionId: RevisionId)
    suspend fun sync(ownerUid: String, submissionId: SubmissionId): SyncAttempt
    fun observe(ownerUid: String, onChange: (RemoteSubmissionState) -> Unit): AutoCloseable
}

data class SyncAttempt(val confirmed: Boolean, val retryable: Boolean, val message: String? = null)
data class RemoteSubmissionState(
    val submissionId: SubmissionId,
    val workflow: WorkflowState,
    val correctionReason: String?,
    val serverConfirmed: Boolean,
    val validation: ValidationSummary? = null,
    val flags: List<ValidationFlag> = emptyList(),
)
