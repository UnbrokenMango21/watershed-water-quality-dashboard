package org.watershed.pawatershedwatch

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelTest {
    @Test
    fun conversionsPreserveScientificQuantity() {
        assertEquals(68.0, Units.Celsius.convert(20.0, Units.Fahrenheit), 0.0001)
        assertEquals(0.328, Units.UsCm.convert(328.0, Units.MsCm), 0.000001)
        assertEquals(44.285714, Units.MgNL.convert(10.0, Units.MgNo3L), 0.00001)
        assertEquals(
            "17.8 °C · 64.0 °F",
            displayMeasurement(MeasurementValue(MeasurementKind.Temperature, "17.8", Units.Celsius.id)),
        )
    }

    @Test
    fun validationAllowsSignedOrpButRejectsNegativeConcentrations() {
        assertNull(measurementError(MeasurementKind.Orp, "-122.4"))
        assertEquals("cannot be negative", measurementError(MeasurementKind.Nitrate, "-1"))
        assertEquals("must be between 0 and 14 pH", measurementError(MeasurementKind.Ph, "14.1"))
    }

    @Test
    fun hardRangesRejectOutOfRangeValuesWithASpecificMessage() {
        assertEquals(
            "Water Temperature must be between -5 and 60 °C.",
            measurementErrorMessage(MeasurementKind.Temperature, "61"),
        )
        assertEquals(
            "Water Temperature must be between -5 and 60 °C.",
            measurementErrorMessage(MeasurementKind.Temperature, "180", Units.Fahrenheit),
        )
        assertNull(measurementError(MeasurementKind.Temperature, "60"))
        assertNull(measurementError(MeasurementKind.Temperature, "-4.9"))
        assertNull(measurementError(MeasurementKind.Temperature, "32", Units.Fahrenheit))
        assertEquals(
            "Dissolved Oxygen must be between 0 and 50 mg O₂/L.",
            measurementErrorMessage(MeasurementKind.DissolvedOxygen, "50.1"),
        )
        assertNull(measurementError(MeasurementKind.DissolvedOxygen, "50"))
        assertEquals(
            "Dissolved Oxygen Saturation must be between 0 and 300 %.",
            measurementErrorMessage(MeasurementKind.DissolvedOxygenSaturation, "301"),
        )
        assertNull(measurementError(MeasurementKind.DissolvedOxygenSaturation, "300"))
        assertEquals("pH must be between 0 and 14 pH.", measurementErrorMessage(MeasurementKind.Ph, "-0.1"))
        // Parameters with only a documented minimum keep the shared non-negative rule and no upper bound.
        assertNull(measurementError(MeasurementKind.Conductivity, "150000"))
        assertNull(measurementError(MeasurementKind.Flow, "0"))
    }

    @Test
    fun nonNumericIsRejectedAndBlankNeverBlocks() {
        assertEquals("Water Temperature must be a number.", measurementErrorMessage(MeasurementKind.Temperature, "auuidaf"))
        assertEquals("must be a number", measurementError(MeasurementKind.Ph, "7,2"))
        assertNull(measurementError(MeasurementKind.Chloride, ""))
        assertNull(measurementError(MeasurementKind.Chloride, "   "))
        assertNull(measurementErrorMessage(MeasurementKind.Nitrate, ""))
    }

    @Test
    fun labProfileNeedsOneResultBeyondTemperature() {
        val labDraft = ObservationDraft(
            testType = TestType.PennStateLab,
            values = mapOf(MeasurementKind.Temperature to "18"),
        )
        assertTrue(labDraft.requiredComplete)
        assertTrue(labDraft.requiresAdditionalResult)
        assertFalse(labDraft.profileMinimumComplete)

        val withResult = labDraft.copy(values = labDraft.values + (MeasurementKind.Ph to "7.1"))
        assertTrue(withResult.profileMinimumComplete)

        val inSitu = ObservationDraft(
            testType = TestType.FieldInstrument,
            values = mapOf(
                MeasurementKind.Temperature to "18", MeasurementKind.Ph to "7.1",
                MeasurementKind.DissolvedOxygen to "9", MeasurementKind.Conductivity to "300",
            ),
        )
        assertFalse(inSitu.requiresAdditionalResult)
        assertTrue(inSitu.profileMinimumComplete)
    }

    @Test
    fun correctionAppendsSnapshotWithoutMutatingOriginalRevision() {
        val original = listOf(MeasurementValue(MeasurementKind.DissolvedOxygen, "91", Units.MgO2L.id))
        val revisionOne = Revision(1, 1L, WorkflowState.Submitted, "Original", original)
        val corrected = listOf(MeasurementValue(MeasurementKind.DissolvedOxygen, "9.1", Units.MgO2L.id))
        val history = listOf(revisionOne) + Revision(2, 2L, WorkflowState.Resubmitted, "Checked source sheet", corrected)

        assertEquals("91", history.first().measurements.single().value)
        assertEquals("9.1", history.last().measurements.single().value)
        assertTrue(history.map(Revision::number) == listOf(1, 2))
    }
}
