import XCTest
@testable import PAWatershedWatch

final class ModelTests: XCTestCase {
    @MainActor
    func testFieldWorkflowAndTemperatureConversion() {
        let draft = ObservationDraft()
        draft.testType = .fieldInstrument
        draft[valueFor: .temperature] = "20"

        XCTAssertEqual(draft.requiredMeasurements, [.temperature, .ph, .dissolvedOxygen, .conductivity])
        XCTAssertFalse(draft.includesLab)
        XCTAssertEqual(draft.temperatureConversion, "68.0 °F")
        XCTAssertEqual(draft.completedRequiredCount, 1)
    }

    @MainActor
    func testLabWorkflowAllowsPendingResultsWithRequestedAnalytes() {
        let draft = ObservationDraft()
        draft.testType = .pennStateLab
        draft.labResultsPending = true

        XCTAssertTrue(draft.requiredMeasurements.isEmpty)
        XCTAssertTrue(draft.includesLab)
        XCTAssertFalse(draft.requestedAnalytes.isEmpty)
    }

    @MainActor
    func testAllNonRequiredMeasurementsRemainVisibleWithScientificUnits() {
        let draft = ObservationDraft()
        draft.testType = .fieldInstrument

        XCTAssertEqual(draft.optionalMeasurements.count, MeasurementKind.allCases.count - 4)
        XCTAssertTrue(draft.optionalMeasurements.contains(.turbidity))
        XCTAssertTrue(draft.optionalMeasurements.contains(.eColi))
        XCTAssertEqual(MeasurementKind.dissolvedOxygen.defaultUnit, .milligramsOxygenPerLiter)
        XCTAssertEqual(MeasurementKind.conductivity.defaultUnit, .microsiemensPerCentimeter)
        XCTAssertEqual(MeasurementKind.flow.defaultUnit, .cubicMetersPerSecond)
        XCTAssertEqual(MeasurementKind.alkalinity.defaultUnit, .milligramsCaCO3PerLiter)
    }

    @MainActor
    func testUnitChangesConvertValuesWithoutChangingMeasuredQuantity() {
        let draft = ObservationDraft()
        draft[valueFor: .temperature] = "20"
        draft[valueFor: .conductivity] = "328"
        draft[valueFor: .nitrate] = "10"

        XCTAssertTrue(draft.changeUnit(.fahrenheit, for: .temperature))
        XCTAssertEqual(draft[valueFor: .temperature], "68")
        XCTAssertTrue(draft.changeUnit(.millisiemensPerCentimeter, for: .conductivity))
        XCTAssertEqual(draft[valueFor: .conductivity], "0.328")
        XCTAssertTrue(draft.changeUnit(.milligramsNitratePerLiter, for: .nitrate))
        XCTAssertEqual(Double(draft[valueFor: .nitrate])!, 44.28571, accuracy: 0.00001)
    }

    @MainActor
    func testMethodDependentUnitChangeRequiresExplicitClear() {
        let draft = ObservationDraft()
        draft[valueFor: .turbidity] = "12.4"

        XCTAssertFalse(draft.changeUnit(.fnu, for: .turbidity))
        XCTAssertEqual(draft[valueFor: .turbidity], "12.4")
        XCTAssertEqual(draft.selectedUnit(for: .turbidity), .ntu)

        XCTAssertTrue(draft.changeUnit(.fnu, for: .turbidity, clearingValueIfNeeded: true))
        XCTAssertEqual(draft[valueFor: .turbidity], "")
        XCTAssertEqual(draft.selectedUnit(for: .turbidity), .fnu)
    }

    @MainActor
    func testCorrectionCreatesNewRevisionWithoutOverwritingOriginalNotes() {
        let model = AppModel()
        let record = model.records[1]
        model.startCorrection(for: record)
        model.draft?[valueFor: .dissolvedOxygen] = "9.1"
        model.draft?.revisionNote = "Corrected after checking the sonde export and calibration log."

        model.resubmitCorrection(recordID: record.id)

        XCTAssertEqual(model.records[1].revision, 2)
        XCTAssertEqual(model.records[1].revisions.map(\.number), [1, 2])
        XCTAssertEqual(model.records[1].notes, record.notes)
        XCTAssertEqual(model.records[1].workflow, .resubmitted)
        XCTAssertEqual(model.records[1].measurements.first(where: { $0.kind == .dissolvedOxygen })?.unit, .milligramsOxygenPerLiter)
    }
}
