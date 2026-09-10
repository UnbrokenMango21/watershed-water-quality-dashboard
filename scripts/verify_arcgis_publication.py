"""Read-only verifier for the PA Watershed Watch ArcGIS publication boundary.

Usage from ArcGIS Pro Python:
    python scripts/verify_arcgis_publication.py <authoritative_item_id>

The verifier never edits content. It resolves authoritative datasets by name, checks
unique publication keys, and applies the same fail-closed public-view schema guard as
the provisioner.
"""
from __future__ import annotations

import json
import pathlib
import sys

from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from publication.arcgis_schema_guard import validate_public_dataset  # noqa: E402

SCHEMA = json.loads((ROOT / "config" / "arcgis_publication_schema.json").read_text(encoding="utf-8"))


def plain(value):
    if value is None:
        return {}
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return dict(value)


def field_names(layer) -> set[str]:
    return {field["name"] for field in layer.properties.fields}


def exact_owned_item(gis: GIS, title: str):
    owner = gis.users.me.username
    matches = gis.content.search(query=f'title:"{title}" AND owner:{owner}', item_type="Feature Service", max_items=50)
    exact = [item for item in matches if item.title == title and item.owner == owner]
    if len(exact) != 1:
        return None
    return exact[0]


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify_arcgis_publication.py <authoritative_item_id>")
        return 2

    gis = GIS("pro")
    item = gis.content.get(sys.argv[1])
    if item is None:
        raise RuntimeError("Authoritative ArcGIS item not found")
    if str(item.access).lower() != "private":
        raise RuntimeError("Authoritative ArcGIS service is not private")

    flc = FeatureLayerCollection.fromitem(item)
    actual_by_name = {}
    failures: list[str] = []
    for layer in [*flc.layers, *flc.tables]:
        name = str(layer.properties.name)
        if name in actual_by_name:
            failures.append(f"Duplicate authoritative dataset name {name!r}")
        actual_by_name[name] = layer

    expected_names = {dataset["name"] for dataset in SCHEMA["layers"]}
    if set(actual_by_name) != expected_names:
        failures.append(
            f"Authoritative dataset names differ from contract: actual={sorted(actual_by_name)}, expected={sorted(expected_names)}"
        )

    for dataset in SCHEMA["layers"]:
        layer = actual_by_name.get(dataset["name"])
        if layer is None:
            continue
        expected_fields = {"OBJECTID", *[field["name"] for field in dataset["fields"]]}
        missing = expected_fields - field_names(layer)
        if missing:
            failures.append(f"{dataset['name']} missing fields: {sorted(missing)}")
        actual_field_types = {field["name"]: field["type"] for field in layer.properties.fields}
        for field in dataset["fields"]:
            if field["name"] in actual_field_types and actual_field_types[field["name"]] != field["type"]:
                failures.append(
                    f"{dataset['name']}.{field['name']} has type {actual_field_types[field['name']]}; expected {field['type']}"
                )
        indexes = list(getattr(layer.properties, "indexes", []) or [])
        key_index = next((
            index for index in indexes
            if str(index.get("fields", "")).replace(" ", "") == dataset["keyField"]
        ), None)
        if key_index is None or not bool(key_index.get("isUnique")):
            failures.append(f"{dataset['name']} key field {dataset['keyField']} is not protected by a unique index")

    authoritative_caps = {part.strip() for part in str(flc.properties.capabilities).split(",") if part.strip()}
    if "Delete" in authoritative_caps:
        failures.append("Authoritative service unexpectedly permits Delete")
    if not {"Query", "Create", "Update"}.issubset(authoritative_caps):
        failures.append(f"Authoritative service lacks required publisher capabilities: {sorted(authoritative_caps)}")

    print(f"Authoritative item: {item.title} ({item.id})")
    print(f"URL: {item.url}")
    print(f"Access: {item.access}")
    print(f"Capabilities: {flc.properties.capabilities}")
    for name in sorted(actual_by_name):
        layer = actual_by_name[name]
        count = layer.query(where="1=1", return_count_only=True)
        print(f"  {name}: id={layer.properties.id} — {count} records")

    specs_by_name = {dataset["name"]: dataset for dataset in SCHEMA["layers"]}
    for view in SCHEMA["publicViews"]:
        match = exact_owned_item(gis, view["name"])
        if match is None:
            failures.append(f"Missing or ambiguous public view item {view['name']}")
            continue
        if str(match.access).lower() != "public":
            failures.append(f"Public view {view['name']} access is {match.access!r}, not public")
        view_flc = FeatureLayerCollection.fromitem(match)
        datasets = [*view_flc.layers, *view_flc.tables]
        if len(datasets) != 1:
            failures.append(f"Public view {view['name']} should contain exactly one dataset")
            continue
        dataset_spec = specs_by_name[view["sourceDataset"]]
        failures.extend(
            f"{view['name']}: {failure}"
            for failure in validate_public_dataset(
                dataset_spec,
                service_properties=plain(view_flc.properties),
                dataset_properties=plain(datasets[0].properties),
            )
        )
        try:
            datasets[0].query(where="1=1", result_record_count=1)
        except Exception as exc:
            failures.append(f"Public view {view['name']} query failed: {exc}")
        print(f"  public view: {match.title} ({match.id}) | {match.url} | access={match.access}")

    if failures:
        print("\nVERIFICATION FAILED")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nVERIFICATION PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
