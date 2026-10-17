"""Read-only verifier for the approved-authoritative ArcGIS publication service.

Usage from ArcGIS Pro Python:
    python scripts/verify_arcgis_publication.py <authoritative_item_id>

The verifier never edits content. It confirms schema, privacy boundaries and public
view queryability before the Firebase publisher is enabled.
"""

from __future__ import annotations

import json
import pathlib
import sys

from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS
from provision_arcgis_publication import verify_public_view

ROOT = pathlib.Path(__file__).resolve().parents[1]
RESOURCES = json.loads((ROOT / "config" / "arcgis_resources.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((ROOT / "config" / "arcgis_publication_schema.json").read_text(encoding="utf-8"))


def field_names(layer) -> set[str]:
    return {field["name"] for field in layer.properties.fields}


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify_arcgis_publication.py <authoritative_item_id>")
        return 2
    gis = GIS("pro")
    item = gis.content.get(sys.argv[1])
    if item is None:
        raise RuntimeError("Authoritative ArcGIS item not found")
    flc = FeatureLayerCollection.fromitem(item)
    actual = {int(layer.properties.id): layer for layer in [*flc.layers, *flc.tables]}
    failures: list[str] = []
    if item.id != RESOURCES["authoritative"]["itemId"] or item.url != RESOURCES["authoritative"]["featureServiceUrl"]:
        failures.append("Authoritative item/URL differs from recorded resources")
    if set(actual) != {d["id"] for d in SCHEMA["layers"]}:
        failures.append("Authoritative service has unexpected or missing datasets")
    if item.access != "private":
        failures.append("Authoritative item must remain private")

    for dataset in SCHEMA["layers"]:
        layer = actual.get(dataset["id"])
        if layer is None:
            failures.append(f"Missing dataset {dataset['id']} {dataset['name']}")
            continue
        expected_fields = {"OBJECTID", *[field["name"] for field in dataset["fields"]]}
        missing = expected_fields - field_names(layer)
        if layer.properties.name != dataset["name"] or any(next((f["type"] for f in layer.properties.fields if f["name"] == expected["name"]), None) != expected["type"] for expected in dataset["fields"]):
            failures.append(f"{dataset['name']} name or field types do not match")
        if missing:
            failures.append(f"{dataset['name']} missing fields: {sorted(missing)}")
        indexes = list(getattr(layer.properties, "indexes", []) or [])
        key_index = next((
            index for index in indexes
            if str(index.get("fields", "")).replace(" ", "") == dataset["keyField"]
        ), None)
        if key_index is None or not bool(key_index.get("isUnique")):
            failures.append(f"{dataset['name']} key field {dataset['keyField']} is not protected by a unique index")

    if "Delete" in str(flc.properties.capabilities):
        failures.append("Authoritative service unexpectedly permits Delete")

    print(f"Authoritative item: {item.title} ({item.id})")
    print(f"URL: {item.url}")
    print(f"Capabilities: {flc.properties.capabilities}")
    for dataset_id, layer in sorted(actual.items()):
        count = layer.query(where="1=1", return_count_only=True)
        print(f"  {dataset_id}: {layer.properties.name} — {count} records")

    # Locate expected public views owned by the signed-in user and verify that fields
    # classified never-public are absent from the view layer/table schemas.
    never_public = set(SCHEMA["privacy"]["neverPublic"])
    for view in SCHEMA["publicViews"]:
        dataset_id = view.get("sourceLayerId", view.get("sourceTableId"))
        resource = next(v for v in RESOURCES["publicViews"].values() if v["sourceLayerId"] == dataset_id)
        match = gis.content.get(resource["itemId"])
        if match is None:
            failures.append(f"Missing public view item {view['name']}")
            continue
        view_flc = FeatureLayerCollection.fromitem(match)
        datasets = [*view_flc.layers, *view_flc.tables]
        if len(datasets) != 1:
            failures.append(f"Public view {view['name']} should contain exactly one dataset")
            continue
        dataset_id = view.get("sourceLayerId", view.get("sourceTableId"))
        dataset = next(d for d in SCHEMA["layers"] if d["id"] == dataset_id)
        try:
            if match.owner != item.owner or datasets[0].url != resource["url"]:
                raise RuntimeError("Public view ownership/URL differs from recorded resources")
            origin = datasets[0].manager.properties.get("adminLayerInfo", {}).get("viewLayerDefinition", {})
            if origin.get("sourceServiceName") != SCHEMA["serviceName"] or origin.get("sourceLayerId") != dataset_id:
                raise RuntimeError("View points to an unexpected authoritative source")
            verify_public_view(match, view_flc, dataset, never_public, access="public")
            # Authenticated query success does not prove public accessibility.
            anonymous = GIS()
            anonymous_item = anonymous.content.get(match.id)
            anonymous_flc = FeatureLayerCollection.fromitem(anonymous_item)
            verify_public_view(anonymous_item, anonymous_flc, dataset, never_public, access="public")
            [*anonymous_flc.layers, *anonymous_flc.tables][0].query(where="1=1", result_record_count=1)
        except Exception as exc:
            failures.append(f"Public view {view['name']} verification failed: {exc}")
        print(f"  public view: {match.title} ({match.id})")

    if failures:
        print("\nVERIFICATION FAILED")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nVERIFICATION PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
