"""Pure validation helpers for PA Watershed Watch public ArcGIS views.

This module intentionally has no ArcGIS Python dependency so the privacy contract can
run in ordinary CI. Provisioning and independent verification both call the same guard.
"""
from __future__ import annotations

from typing import Any

FORBIDDEN_CAPABILITIES = {"Create", "Update", "Delete", "Editing", "Sync"}


def public_field_contract(dataset: dict[str, Any]) -> dict[str, str]:
    return {
        "OBJECTID": "esriFieldTypeOID",
        **{
            field["name"]: field["type"]
            for field in dataset["fields"]
            if field.get("public") is True
        },
    }


def _capabilities(value: Any) -> set[str]:
    return {part.strip() for part in str(value or "").split(",") if part.strip()}


def validate_public_dataset(
    dataset: dict[str, Any],
    *,
    service_properties: dict[str, Any],
    dataset_properties: dict[str, Any],
) -> list[str]:
    """Return privacy/schema failures. Empty means the view is safe to share."""
    failures: list[str] = []
    expected = public_field_contract(dataset)
    fields = dataset_properties.get("fields") or []
    actual = {field.get("name"): field.get("type") for field in fields if field.get("name")}

    missing = set(expected) - set(actual)
    unexpected = set(actual) - set(expected)
    if missing:
        failures.append(f"missing public fields: {sorted(missing)}")
    if unexpected:
        failures.append(f"unexpected fields: {sorted(unexpected)}")
    for name in sorted(set(expected) & set(actual)):
        if actual[name] != expected[name]:
            failures.append(f"field {name} has type {actual[name]!r}; expected {expected[name]!r}")

    service_caps = _capabilities(service_properties.get("capabilities"))
    dataset_caps = _capabilities(dataset_properties.get("capabilities"))
    for label, caps in (("service", service_caps), ("dataset", dataset_caps)):
        if "Query" not in caps:
            failures.append(f"{label} does not expose Query capability")
        forbidden = sorted(caps & FORBIDDEN_CAPABILITIES)
        if forbidden:
            failures.append(f"{label} exposes forbidden capabilities: {forbidden}")

    if dataset_properties.get("hasAttachments") is True:
        failures.append("attachments are exposed")
    if service_properties.get("syncEnabled") is True:
        failures.append("public view unexpectedly has sync enabled")
    if service_properties.get("isView") is False:
        failures.append("item is not reported as a hosted view")

    return failures


def assert_public_view_safe(
    dataset: dict[str, Any],
    *,
    service_properties: dict[str, Any],
    dataset_properties: dict[str, Any],
) -> None:
    failures = validate_public_dataset(
        dataset,
        service_properties=service_properties,
        dataset_properties=dataset_properties,
    )
    if failures:
        raise RuntimeError(
            f"Public ArcGIS view for {dataset['name']} failed closed: " + "; ".join(failures)
        )
