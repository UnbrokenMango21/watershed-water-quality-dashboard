package org.watershed.pawatershedwatch

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountInputTest {
    @Test
    fun fullNameIsNormalizedWithoutUsingEmailAsAttribution() {
        assertEquals("Ada Lovelace", CollectorName.normalized("  Ada   Lovelace  "))
        assertEquals("Café Rivera", CollectorName.normalized("Cafe\u0301\u00a0Rivera"))
        assertEquals("A B", CollectorName.normalized("  A\tB  ".replace("\t", " ")))
    }

    @Test
    fun controlCharactersAreRejectedEvenWhenWhitespaceCouldBeCollapsed() {
        assertTrue(runCatching { CollectorName.normalized("Ada\nLovelace") }.isFailure)
        assertTrue(runCatching { CollectorName.normalized("Ada\u0000Lovelace") }.isFailure)
        assertTrue(runCatching { CollectorName.normalized("Ada\u007fLovelace") }.isFailure)
    }

    @Test
    fun nameLengthUsesUnicodeCodePointsAndServerBounds() {
        assertEquals("É" + "x".repeat(79), CollectorName.normalized("E\u0301" + "x".repeat(79)))
        assertTrue(runCatching { CollectorName.normalized("A") }.isFailure)
        assertTrue(runCatching { CollectorName.normalized("x".repeat(81)) }.isFailure)
    }

    @Test
    fun passwordResetTextDoesNotDiscloseAccountExistence() {
        val notice = passwordResetConfirmation("  sample@example.org  ")
        assertTrue(notice.contains("If an account uses sample@example.org"))
        assertTrue(notice.contains("inbox and spam"))
        assertFalse(notice.contains("Account found"))
    }
}
