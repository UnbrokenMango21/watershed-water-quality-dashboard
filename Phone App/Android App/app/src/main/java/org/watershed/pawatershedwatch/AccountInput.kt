package org.watershed.pawatershedwatch

import java.text.Normalizer

/** Matches the server-owned profile name contract; an email fragment is never attribution. */
object CollectorName {
    fun normalized(raw: String): String {
        require(raw.none { it.code < 32 || it.code == 127 }) { "Full name cannot contain control characters." }
        val name = Normalizer.normalize(raw, Normalizer.Form.NFC).trim().replace(Regex("[\\s\\p{Z}]+"), " ")
        require(name.codePointCount(0, name.length) in 2..80) { "Enter your full name in 2 to 80 characters." }
        return name
    }
}

/** Recovery never reveals whether the address is registered. */
fun passwordResetConfirmation(email: String) = "If an account uses ${email.trim()}, a password reset email is on its way. Check your inbox and spam folder."
