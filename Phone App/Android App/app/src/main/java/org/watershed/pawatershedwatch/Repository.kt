package org.watershed.pawatershedwatch

import kotlinx.coroutines.flow.Flow

data class AuthAccount(val uid: String, val email: String?, val displayName: String)

interface AuthRepository {
    val account: Flow<AuthAccount?>
    suspend fun signIn(email: String, password: String): Result<AuthAccount>
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

interface AttachmentRepository {
    suspend fun add(draft: ObservationDraft, attachment: ObservationAttachment): ObservationDraft
    suspend fun remove(draft: ObservationDraft, attachmentId: AttachmentId): ObservationDraft
}

interface SyncRepository {
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
