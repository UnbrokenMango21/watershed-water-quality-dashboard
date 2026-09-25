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

import argparse
import json
import pathlib
import sys
from typing import Any

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


def verify_public_view(item, collection, dataset, never_public, *, access="private") -> None:
    """Check returned REST metadata, not requested create_view parameters."""
    if item.access != access:
        raise RuntimeError(f"View must be {access} during verification")
    if collection.properties.get("isView") is not True:
        raise RuntimeError("Publication target is not a hosted view")
    if set(str(collection.properties.get("capabilities", "")).split(",")) != {"Query"}:
        raise RuntimeError("Public view service must permit only Query")
    layers = [*collection.layers, *collection.tables]
    if len(layers) != 1:
        raise RuntimeError("Public view must contain exactly one dataset")
    props = layers[0].properties
    if set(str(props.get("capabilities", "")).split(",")) != {"Query"}:
        raise RuntimeError("Public view dataset must permit only Query")
    if props.get("hasAttachments") or props.get("relationships"):
        raise RuntimeError("Public views must not expose attachments or related private records")
    expected = {f["name"]: f["type"] for f in dataset["fields"] if f.get("public") is True}
    expected["OBJECTID"] = "esriFieldTypeOID"
    fields = props.get("fields", [])
    actual = {f["name"]: f["type"] for f in fields}
    if len(actual) != len(fields) or actual != expected:
        raise RuntimeError("Public view fields do not exactly match the public allowlist")
    if set(actual) & set(never_public):
        raise RuntimeError("Public view exposes protected fields")


def share_verified_view(gis, item, collection, dataset, never_public) -> None:
    # Recheck immediately before changing access; never share on a failed check.
    verify_public_view(item, collection, dataset, never_public)
    result = gis.content.share_items(items=[item], everyone=True, org=False)
    if result.get("error") or not result.get("results") or any(entry.get("notSharedWith", []) for entry in result["results"]):
        raise RuntimeError("ArcGIS did not complete public sharing")
    if gis.content.get(item.id).access != "public":
        raise RuntimeError("Public sharing was not confirmed by item readback")


def share_verified_views(gis, views, never_public) -> None:
    for item, collection, dataset in views:
        verify_public_view(item, collection, dataset, never_public)
    for item, collection, dataset in views:
        share_verified_view(gis, item, collection, dataset, never_public)


def main() -> int:
    from arcgis.features import FeatureLayerCollection
    from arcgis.gis import GIS

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--share-public", action="store_true", help="Share only after all returned view schemas pass verification")
    parser.add_argument("--resume-item", help="Resume this exact private, schema-matching authoritative item after interruption")
    args = parser.parse_args()
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
    if args.resume_item:
        service_item = gis.content.get(args.resume_item)
        if not service_item or service_item.owner != gis.users.me.username or service_item.url.rstrip('/').split('/')[-2] != service_name:
            raise RuntimeError("Resume target is not the owned authoritative service")
    else:
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


    if service_item.access != "private":
        raise RuntimeError("Authoritative service must remain private")
    flc = FeatureLayerCollection.fromitem(service_item)
    if not args.resume_item:
        layers = [dataset_definition(d) for d in schema["layers"] if not d.get("table")]
        tables = [dataset_definition(d) for d in schema["layers"] if d.get("table")]
        response = flc.manager.add_to_definition({"layers": layers, "tables": tables})
        if not response.get("success"):
            raise RuntimeError(f"add_to_definition failed: {response}")
    flc = FeatureLayerCollection.fromitem(service_item)
    actual = {int(layer.properties.id): layer for layer in [*flc.layers, *flc.tables]}
    if set(actual) != {d["id"] for d in schema["layers"]}:
        raise RuntimeError("Authoritative dataset IDs do not match; no automatic schema migration")
    for dataset in schema["layers"]:
        props = actual[dataset["id"]].properties
        expected = {f["name"]: f["type"] for f in dataset["fields"]}
        fields = {f["name"]: f["type"] for f in props.fields}
        if any(fields.get(name) != kind for name, kind in expected.items()):
            raise RuntimeError("Authoritative field types do not match; no automatic schema migration")
        if not any(i.get("fields") == dataset["keyField"] and i.get("isUnique") for i in props.get("indexes", [])):
            raise RuntimeError("Authoritative dataset lacks its unique key index")

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
        matches = gis.content.search(f'owner:{gis.users.me.username} AND title:"{view["name"]}"', item_type="Feature Service", max_items=100)
        matches = [item for item in matches if item.title == view["name"]]
        if len(matches) > 1:
            raise RuntimeError("Duplicate publication views require explicit reconciliation")
        view_item = matches[0] if matches else gis.content.create_service(
            name=view["name"], service_type="featureService", is_view=True,
            capabilities="Query", wkid=4326,
            service_description=f"Approved-only public projection of {dataset['name']}."
        )
        if view_item.access != "private" or view_item.owner != gis.users.me.username:
            raise RuntimeError("Provisioning may only resume owned private views")
        view_collection = FeatureLayerCollection.fromitem(view_item)
        if not view_collection.layers and not view_collection.tables:
            # Use the documented REST view definition directly. The installed Python
            # create_view helper assumes item.layers[0], even for table-only views.
            definition = {
                "id": dataset_id, "name": dataset["name"],
                "type": "Table" if dataset.get("table") else "Feature Layer",
                "adminLayerInfo": {"viewLayerDefinition": {
                    "sourceServiceName": service_name,
                    "sourceLayerId": dataset_id,
                    "sourceLayerFields": ",".join(public_fields(dataset)),
                }},
            }
            response = view_collection.manager.add_to_definition({
                "tables" if dataset.get("table") else "layers": [definition]
            })
            if response.get("success") is not True:
                raise RuntimeError("Private view definition failed; sharing remains disabled")
            response = view_collection.manager.update_definition({"capabilities": "Query", "allowSchemaChanges": False})
            if response.get("success") is not True:
                raise RuntimeError("Private view restrictions failed; sharing remains disabled")
            view_collection = FeatureLayerCollection.fromitem(view_item)
        view_layers = [*view_collection.layers, *view_collection.tables]
        if len(view_layers) != 1:
            raise RuntimeError("View must have exactly one source dataset")
        origin = view_layers[0].manager.properties.get("adminLayerInfo", {}).get("viewLayerDefinition", {})
        if origin.get("sourceServiceName") != service_name or origin.get("sourceLayerId") != dataset_id:
            raise RuntimeError("View source does not match the approved-authoritative dataset")
        verify_public_view(view_item, view_collection, dataset, schema["privacy"]["neverPublic"])
        created_views.append((view_item, view_collection, dataset))

    # Validate every view before exposing any. A mismatch leaves new resources
    # private for inspection; it never triggers deletion or weaker visibility.
    if args.share_public:
        share_verified_views(gis, created_views, schema["privacy"]["neverPublic"])

    print("\nARCGIS PUBLICATION PROVISIONING COMPLETE")
    print(f"Authoritative item ID: {service_item.id}")
    print(f"Authoritative FeatureServer: {service_item.url}")
    print("Verified view items (public only with --share-public):")
    for item, _, _ in created_views:
        print(f"  - {item.title}: {item.id} | {item.url}")
    print("\nNext: create an ArcGIS OAuth application credential scoped only to this authoritative item")
    print("with feature edit privileges, then bind the client ID/secret to Firebase Functions secrets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
