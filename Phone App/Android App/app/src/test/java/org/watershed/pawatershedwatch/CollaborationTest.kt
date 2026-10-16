package org.watershed.pawatershedwatch

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CollaborationTest {
    private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

    @Test
    fun retryingTheSameReplyReusesItsLowercaseMessageId() {
        val first = OutgoingMessage.next(null, "submission-1", "  The meter was recalibrated.  ")
        assertTrue(uuid.matches(first.messageId))
        assertEquals("The meter was recalibrated.", first.text)
        assertSame(first, OutgoingMessage.next(first, "submission-1", "The meter was recalibrated."))
        assertNotEquals(first.messageId, OutgoingMessage.next(first, "submission-1", "Different text").messageId)
        assertNotEquals(first.messageId, OutgoingMessage.next(first, "submission-2", "The meter was recalibrated.").messageId)
    }

    @Test
    fun replyTextFollowsServerLimits() {
        assertEquals("Write a message before sending.", messageProblem("   "))
        assertNull(messageProblem("Yes"))
        assertNull(messageProblem("x".repeat(MESSAGE_MAX_CHARS)))
        assertEquals("Messages can be at most 4000 characters.", messageProblem("x".repeat(MESSAGE_MAX_CHARS + 1)))
    }

    @Test
    fun onlyCollectorVisibleMessageKindsAreRecognized() {
        assertEquals(MessageKind.CorrectionRequest, MessageKind.fromBackend("CORRECTION_REQUEST"))
        assertEquals("Request for correction", MessageKind.CorrectionRequest.label)
        assertEquals("Reviewer question", MessageKind.fromBackend("REVIEWER_QUESTION")?.label)
        assertEquals("Review decision", MessageKind.fromBackend("REVIEW_DECISION")?.label)
        assertEquals("Collector comment", MessageKind.fromBackend("COLLECTOR_COMMENT")?.label)
        assertNull("internal notes are never shown to collectors", MessageKind.fromBackend("ADMINISTRATIVE_NOTE"))
        assertEquals("QC reviewer", senderRoleLabel("QC_REVIEWER"))
    }

    @Test
    fun coordinateCorrectionPayloadCarriesSiteAndNoName() {
        val request = CoordinateProposalRequest(CoordinateProposalRequest.newId(), ProposalKind.CoordinateCorrection, "SITE-1", 40.8, -77.8, null, "  Bridge moved  ", "ignored")
        val payload = request.payload()
        assertTrue(uuid.matches(payload["proposalId"] as String))
        assertEquals("COORDINATE_CORRECTION", payload["kind"])
        assertEquals("SITE-1", payload["siteId"])
        assertTrue("unknown accuracy is sent as null", payload.containsKey("gpsAccuracyM") && payload["gpsAccuracyM"] == null)
        assertEquals("Bridge moved", payload["reason"])
        assertFalse(payload.containsKey("proposedSiteName"))
    }

    @Test
    fun newSitePayloadOmitsSiteIdAndRetryKeepsTheProposalId() {
        val request = CoordinateProposalRequest("0b8f0b6e-1f7e-4a3a-9a52-0c1e2f3a4b5c", ProposalKind.NewSite, null, 40.8, -77.8, 6.5, "Upstream tributary access", " Slab Cabin Run ")
        val payload = request.payload()
        assertFalse(payload.containsKey("siteId"))
        assertEquals("Slab Cabin Run", payload["proposedSiteName"])
        assertEquals(6.5, payload["gpsAccuracyM"])
        val retry = request.copy(proposalId = CoordinateProposalRequest.newId())
        assertTrue(retry.sameContent(request))
        assertFalse(retry.copy(reason = "Changed reason").sameContent(request))
    }

    @Test
    fun proposalValidationMatchesServerRules() {
        assertTrue(coordinateProposalProblems(ProposalKind.NewSite, null, 40.8, -77.8, null, "Needed site", "Slab Cabin").isEmpty())
        assertEquals(listOf("Choose the monitoring site to correct."), coordinateProposalProblems(ProposalKind.CoordinateCorrection, null, 40.8, -77.8, 3.0, "Moved bridge", ""))
        assertEquals(listOf("Capture the current GPS position."), coordinateProposalProblems(ProposalKind.CoordinateCorrection, "SITE-1", null, null, null, "Moved bridge", ""))
        assertEquals(listOf("The GPS position is not valid. Capture it again."), coordinateProposalProblems(ProposalKind.CoordinateCorrection, "SITE-1", 0.0, 0.0, null, "Moved bridge", ""))
        assertEquals(listOf("Explain the proposal in 5 to 1000 characters."), coordinateProposalProblems(ProposalKind.CoordinateCorrection, "SITE-1", 40.8, -77.8, null, "abc", ""))
        assertEquals(listOf("Enter a proposed site name of 2 to 160 characters."), coordinateProposalProblems(ProposalKind.NewSite, null, 40.8, -77.8, null, "Needed site", " x "))
        assertEquals(listOf("GPS accuracy must be a nonnegative number of meters, or unknown."), coordinateProposalProblems(ProposalKind.NewSite, null, 40.8, -77.8, -1.0, "Needed site", "Slab Cabin"))
    }
}
