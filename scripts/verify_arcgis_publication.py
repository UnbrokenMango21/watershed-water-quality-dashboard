"""Read-only verifier for the approved-authoritative ArcGIS publication service.
Usage from ArcGIS Pro Python: python scripts/verify_arcgis_publication.py <authoritative_item_id>
"""
from __future__ import annotations
import json
import pathlib
import sys
from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "config" / "arcgis_publication_schema.json").read_text(encoding="utf-8"))
def field_names(layer) -> set[str]: return {field["name"] for field in layer.properties.fields}

def main() -> int:
    if len(sys.argv) != 2: print("Usage: verify_arcgis_publication.py <authoritative_item_id>"); return 2
    gis = GIS("pro"); item = gis.content.get(sys.argv[1])
    if item is None: raise RuntimeError("Authoritative ArcGIS item not found")
    flc = FeatureLayerCollection.fromitem(item); actual = {int(layer.properties.id):layer for layer in [*flc.layers,*flc.tables]}; failures: list[str] = []
    for dataset in SCHEMA["layers"]:
        layer = actual.get(dataset["id"])
        if layer is None: failures.append(f"Missing dataset {dataset['id']} {dataset['name']}"); continue
        missing = {"OBJECTID", *[f["name"] for f in dataset["fields"]]} - field_names(layer)
        if missing: failures.append(f"{dataset['name']} missing fields: {sorted(missing)}")
    if "Delete" in str(flc.properties.capabilities): failures.append("Authoritative service unexpectedly permits Delete")
    print(f"Authoritative item: {item.title} ({item.id})"); print(f"URL: {item.url}"); print(f"Capabilities: {flc.properties.capabilities}")
    for dataset_id, layer in sorted(actual.items()): print(f"  {dataset_id}: {layer.properties.name} — {layer.query(where='1=1', return_count_only=True)} records")
    never_public = set(SCHEMA["privacy"]["neverPublic"])
    for view in SCHEMA["publicViews"]:
        matches = gis.content.search(query=f'title:"{view["name"]}" AND owner:{gis.users.me.username}', max_items=10); match = next((candidate for candidate in matches if candidate.title == view["name"]), None)
        if match is None: failures.append(f"Missing public view item {view['name']}"); continue
        view_flc = FeatureLayerCollection.fromitem(match); datasets = [*view_flc.layers,*view_flc.tables]
        if len(datasets) != 1: failures.append(f"Public view {view['name']} should contain exactly one dataset"); continue
        leaked = never_public & field_names(datasets[0])
        if leaked: failures.append(f"Public view {view['name']} exposes protected fields: {sorted(leaked)}")
        try: datasets[0].query(where="1=1", result_record_count=1)
        except Exception as exc: failures.append(f"Public view {view['name']} query failed: {exc}")
        print(f"  public view: {match.title} ({match.id})")
    if failures:
        print("\nVERIFICATION FAILED")
        for failure in failures: print(f"  - {failure}")
        return 1
    print("\nVERIFICATION PASSED"); return 0

if __name__ == "__main__": sys.exit(main())
