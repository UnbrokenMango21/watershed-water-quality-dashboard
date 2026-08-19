"""Provision the approved-only ArcGIS Online publication service and public-safe views.

Run inside ArcGIS Pro's Python environment while signed in to the target ArcGIS Online
organization. The existing private QC staging item is intentionally never modified.

This script is conservative by design:
- it refuses to overwrite an existing service;
- it creates an empty approved-authoritative service from the versioned schema;
- it creates one public read-only hosted view per dataset so field visibility can be
  independently constrained;
- it prints non-secret item IDs/URLs to copy into deployment configuration.
"""

from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "config" / "arcgis_publication_schema.json"
LEGACY_QC_STAGING_ITEM_ID = "b7775c1bdada4aa8b0787714eca3eb15"


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def arcgis_field(field: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": field["name"],
        "alias": field["alias"],
        "type": field["type"],
        "nullable": True,
        "editable": True,
    }
    if "length" in field:
        result["length"] = field["length"]
    return result


def dataset_definition(dataset: dict[str, Any]) -> dict[str, Any]:
    fields = [
        {
            "name": "OBJECTID",
            "alias": "OBJECTID",
            "type": "esriFieldTypeOID",
            "nullable": False,
            "editable": False,
        },
        *[arcgis_field(field) for field in dataset["fields"]],
    ]
    definition: dict[str, Any] = {
        "id": dataset["id"],
        "name": dataset["name"],
        "type": "Table" if dataset.get("table") else "Feature Layer",
        "objectIdField": "OBJECTID",
        "fields": fields,
        "indexes": [
            {
                "name": f"idx_{dataset['id']}_{dataset['keyField']}",
                "fields": dataset["keyField"],
                "isAscending": True,
                "isUnique": True,
            }
        ],
    }
    if not dataset.get("table"):
        definition.update(
            {
                "geometryType": dataset["geometryType"],
                "hasZ": False,
                "hasM": False,
                "extent": {
                    "xmin": -80.7,
                    "ymin": 39.6,
                    "xmax": -74.6,
                    "ymax": 42.6,
                    "spatialReference": {"wkid": 4326},
                },
                "drawingInfo": {
                    "renderer": {
                        "type": "simple",
                        "symbol": {
                            "type": "esriSMS",
                            "style": "esriSMSCircle",
                            "size": 7,
                            "color": [55, 93, 87, 220],
                            "outline": {"color": [255, 255, 255, 230], "width": 1},
                        },
                    }
                },
            }
        )
    return definition


def public_fields(dataset: dict[str, Any]) -> list[str]:
    return ["OBJECTID", *[field["name"] for field in dataset["fields"] if field.get("public") is True]]


def share_public(gis: GIS, item) -> None:
    # Current ArcGIS API for Python supports ContentManager.share_items; Item.share
    # remains a compatibility fallback for ArcGIS Pro environments on older 2.x APIs.
    try:
        gis.content.share_items(items=[item], everyone=True, org=False)
    except Exception:
        item.share(everyone=True, org=False)


def main() -> int:
    schema = load_schema()
    gis = GIS("pro")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Portal: {gis.url}")

    existing_qc = gis.content.get(LEGACY_QC_STAGING_ITEM_ID)
    if existing_qc:
        print(
            "Preserving existing private QC staging item unchanged: "
            f"{existing_qc.title} ({existing_qc.id})"
        )

    service_name = schema["serviceName"]
    if not gis.content.is_service_name_available(service_name, "featureService"):
        print(
            f"REFUSING TO OVERWRITE: feature service name '{service_name}' already exists.\n"
            "Run scripts/verify_arcgis_publication.py against the existing item or choose a deliberate migration path."
        )
        return 2

    service_item = gis.content.create_service(
        name=service_name,
        service_type="featureService",
        service_description=schema["description"],
        capabilities="Query,Create,Update",
        wkid=4326,
        max_record_count=5000,
    )
    service_item.update(
        item_properties={
            "title": schema["serviceTitle"],
            "snippet": "Approved-only authoritative watershed observations and public materializations.",
            "description": schema["description"],
            "tags": "watershed, water quality, approved observations, Central Pennsylvania, Watershed Watch",
        }
    )

    flc = FeatureLayerCollection.fromitem(service_item)
    layers = [dataset_definition(d) for d in schema["layers"] if not d.get("table")]
    tables = [dataset_definition(d) for d in schema["layers"] if d.get("table")]
    response = flc.manager.add_to_definition({"layers": layers, "tables": tables})
    if not response.get("success"):
        raise RuntimeError(f"add_to_definition failed: {response}")
    flc.refresh()

    # Keep the authoritative store private and editable only by the publishing app/account.
    flc.manager.update_definition(
        {
            "capabilities": "Query,Create,Update",
            "allowGeometryUpdates": True,
            "syncEnabled": False,
            "editorTrackingInfo": {
                "enableEditorTracking": True,
                "enableOwnershipAccessControl": False,
                "allowOthersToUpdate": False,
                "allowOthersToDelete": False,
            },
        }
    )

    created_views = []
    by_id = {dataset["id"]: dataset for dataset in schema["layers"]}
    for view in schema["publicViews"]:
        dataset_id = view.get("sourceLayerId", view.get("sourceTableId"))
        dataset = by_id[dataset_id]
        view_kwargs = {
            "name": view["name"],
            "allow_schema_changes": False,
            "updateable": False,
            "capabilities": "Query",
            "visible_fields": public_fields(dataset),
            "description": f"Public read-only view of {dataset['name']} from the approved-authoritative watershed service.",
            "tags": "watershed, water quality, public, approved observations",
            "snippet": f"Public approved-only {dataset['name']} view for the Central PA Watershed dashboard.",
        }
        if dataset.get("table"):
            view_kwargs["view_tables"] = [dataset_id]
        else:
            view_kwargs["view_layers"] = [dataset_id]
        view_item = flc.manager.create_view(**view_kwargs)
        share_public(gis, view_item)
        created_views.append(view_item)

    print("\nARCGIS PUBLICATION PROVISIONING COMPLETE")
    print(f"Authoritative item ID: {service_item.id}")
    print(f"Authoritative FeatureServer: {service_item.url}")
    print("Public view items:")
    for item in created_views:
        print(f"  - {item.title}: {item.id} | {item.url}")
    print("\nNext: create an ArcGIS OAuth application credential scoped only to this authoritative item")
    print("with feature edit privileges, then bind the client ID/secret to Firebase Functions secrets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
