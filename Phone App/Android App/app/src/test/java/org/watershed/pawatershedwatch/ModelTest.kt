package org.watershed.pawatershedwatch

import org.junit.Assert.assertEquals
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
        assertEquals("Value cannot be negative", measurementError(MeasurementKind.Nitrate, "-1"))
        assertEquals("pH must be from 0 to 14", measurementError(MeasurementKind.Ph, "14.1"))
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
