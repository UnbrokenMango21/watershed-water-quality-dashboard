#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def path(relative: str) -> Path:
    return ROOT / relative


def replace(relative: str, old: str, new: str, expected: int = 1) -> None:
    target = path(relative)
    text = target.read_text()
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{relative}: expected {expected} matches, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new))


# The lifecycle emulator fixture predates entered-unit provenance and used canonical
# display units as entered_unit_code. The production validator now correctly rejects
# that. Keep the synthetic lifecycle data aligned with the mobile stable unit IDs.
lifecycle = "tests/review/lifecycle.test.mjs"
replace(
    lifecycle,
    "function measurement(code, value, unit, overrides = {}) {\n",
    """const enteredUnitByCode = {\n  PH: 'ph-standard',\n  DO_MG_L: 'mg-o2-l',\n  CONDUCTIVITY_US_CM: 'us-cm',\n};\n\nfunction measurement(code, value, unit, overrides = {}) {\n""",
)
replace(
    lifecycle,
    "    entered_value: value,\n    entered_unit_code: unit,\n",
    "    entered_value: value,\n    entered_unit_code: enteredUnitByCode[code],\n",
)

# Data dictionary release-policy corrections. These keep historical schema context but
# make Phase 11's locked first-production contract explicit.
data_dictionary = "docs/DATA_DICTIONARY.md"
replace(
    data_dictionary,
    "12. Measurement requiredness is protocol-driven and is not finalized yet.",
    "12. For the Phase 11 first production release, Water Temperature is the only required science measurement. Other supported non-temperature measurements are optional when the field protocol calls for them and receive the same numeric/range/provenance validation when entered.",
)
replace(
    data_dictionary,
    "| `photo_count` | integer | Yes for app | No | Derived from attachments |",
    "| `photo_count` | integer | No in Phase 11 | No | Legacy/future attachment metadata only. Photo capture/import and audio recording/upload are disabled for the first production release and deferred to a later reviewed phase. |",
)
replace(
    data_dictionary,
    "Validation thresholds and mandatory/optional parameter rules are intentionally **not finalized yet**.",
    "Validation thresholds remain versioned in `config/validation_rules.json`. The Phase 11 requiredness policy is locked for the first production release: Water Temperature is required; other supported non-temperature measurements are optional.",
)

print("Phase 11 lifecycle fixture and documentation follow-up applied successfully.")
