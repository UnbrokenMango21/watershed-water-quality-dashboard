"""Provision or verify the PA Watershed Watch approved-only ArcGIS service.

Run inside ArcGIS Pro's Python environment while signed in to the target organization.
The private QC staging item is never modified. Public views are created privately and
are shared only after the exact public field/type/read-only contract passes.
"""
from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from publication.arcgis_schema_guard import assert_public_view_safe, public_field_contract  # noqa: E402

SCHEMA_PATH = ROOT / "config" / "arcgis_publication_schema.json"
LEGACY_QC_STAGING_ITEM_ID = "b7775c1bdada4aa8b0787714eca3eb15"


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def plain(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return dict(value)


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
        {"name": "OBJECTID", "alias": "OBJECTID", "type": "esriFieldTypeOID", "nullable": False, "editable": False},
        *[arcgis_field(field) for field in dataset["fields"]],
    ]
    definition: dict[str, Any] = {
        "id": dataset["id"],
        "name": dataset["name"],
        "type": "Table" if dataset.get("table") else "Feature Layer",
        "objectIdField": "OBJECTID",
        "fields": fields,
        "indexes": [{
            "name": f"idx_{dataset['id']}_{dataset['keyField']}",
            "fields": dataset["keyField"],
            "isAscending": True,
            "isUnique": True,
        }],
    }
    if not dataset.get("table"):
        definition.update({
            "geometryType": dataset["geometryType"],
            "hasZ": False,
            "hasM": False,
            "extent": {"xmin": -80.7, "ymin": 39.6, "xmax": -74.6, "ymax": 42.6, "spatialReference": {"wkid": 4326}},
            "drawingInfo": {"renderer": {"type": "simple", "symbol": {
                "type": "esriSMS", "style": "esriSMSCircle", "size": 7,
                "color": [55, 93, 87, 220], "outline": {"color": [255, 255, 255, 230], "width": 1},
            }}},
        })
    return definition


def public_fields(dataset: dict[str, Any]) -> list[str]:
    return list(public_field_contract(dataset))


def exact_owned_item(gis: GIS, title: str):
    owner = gis.users.me.username
    matches = gis.content.search(query=f'title:"{title}" AND owner:{owner}', item_type="Feature Service", max_items=50)
    exact = [item for item in matches if item.title == title and item.owner == owner]
    if len(exact) > 1:
        raise RuntimeError(f"Refusing ambiguous ArcGIS state: multiple owned Feature Services titled {title!r}")
    return exact[0] if exact else None


def dataset_map(flc: FeatureLayerCollection) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for dataset in [*flc.layers, *flc.tables]:
        name = str(dataset.properties.name)
        if name in result:
            raise RuntimeError(f"Duplicate authoritative dataset name {name!r}")
        result[name] = dataset
    return result


def ensure_authoritative_schema(flc: FeatureLayerCollection, schema: dict[str, Any]) -> dict[str, Any]:
    """Non-destructively add fields introduced by newer schema versions, then verify."""
    by_name = dataset_map(flc)
    expected_names = {dataset["name"] for dataset in schema["layers"]}
    if set(by_name) != expected_names:
        raise RuntimeError(
            f"Authoritative dataset names differ from contract. Actual={sorted(by_name)}, expected={sorted(expected_names)}"
        )

    for spec in schema["layers"]:
        layer = by_name[spec["name"]]
        actual_fields = {field["name"]: field for field in layer.properties.fields}
        missing_specs = [field for field in spec["fields"] if field["name"] not in actual_fields]
        if missing_specs:
            response = layer.manager.add_to_definition({"fields": [arcgis_field(field) for field in missing_specs]})
            if not response.get("success"):
                raise RuntimeError(f"Could not add schema fields to {spec['name']}: {response}")
            layer.refresh()
            actual_fields = {field["name"]: field for field in layer.properties.fields}
        for field in spec["fields"]:
            actual = actual_fields.get(field["name"])
            if actual is None:
                raise RuntimeError(f"{spec['name']} is missing required field {field['name']}")
            if actual["type"] != field["type"]:
                raise RuntimeError(
                    f"{spec['name']}.{field['name']} has type {actual['type']}; expected {field['type']}"
                )
    return dataset_map(flc)


def verify_view_item(view_item, dataset_spec: dict[str, Any]) -> None:
    view_flc = FeatureLayerCollection.fromitem(view_item)
    datasets = [*view_flc.layers, *view_flc.tables]
    if len(datasets) != 1:
        raise RuntimeError(f"Public view {view_item.title!r} must contain exactly one dataset")
    assert_public_view_safe(
        dataset_spec,
        service_properties=plain(view_flc.properties),
        dataset_properties=plain(datasets[0].properties),
    )


def share_public(gis: GIS, item) -> None:
    try:
        result = gis.content.share_items(items=[item], everyone=True, org=False)
        if isinstance(result, dict) and result.get("notSharedWith"):
            raise RuntimeError(f"ArcGIS did not share {item.title}: {result}")
    except AttributeError:
        item.share(everyone=True, org=False)


def create_view(flc: FeatureLayerCollection, view_spec: dict[str, Any], dataset_spec: dict[str, Any], actual_dataset) -> Any:
    kwargs = {
        "name": view_spec["name"],
        "allow_schema_changes": False,
        "updateable": False,
        "capabilities": "Query",
        "visible_fields": public_fields(dataset_spec),
        "description": f"Public read-only view of {dataset_spec['name']} from the PA Watershed Watch approved-authoritative service.",
        "tags": "PA Watershed Watch, watershed, water quality, public, approved observations",
        "snippet": f"Public approved-only {dataset_spec['name']} view for the PA Watershed Watch dashboard.",
    }
    actual_id = int(actual_dataset.properties.id)
    if dataset_spec.get("table"):
        kwargs["view_tables"] = [actual_id]
    else:
        kwargs["view_layers"] = [actual_id]
    return flc.manager.create_view(**kwargs)


def main() -> int:
    schema = load_schema()
    gis = GIS("pro")
    print(f"Signed in as: {gis.users.me.username}")
    print(f"Portal: {gis.url}")

    existing_qc = gis.content.get(LEGACY_QC_STAGING_ITEM_ID)
    if existing_qc:
        print(f"Preserving private QC staging unchanged: {existing_qc.title} ({existing_qc.id})")

    service_item = exact_owned_item(gis, schema["serviceTitle"])
    created_service = service_item is None
    if created_service:
        if not gis.content.is_service_name_available(schema["serviceName"], "featureService"):
            raise RuntimeError(
                f"Service name {schema['serviceName']!r} is unavailable but no exact owned authoritative item was found"
            )
        service_item = gis.content.create_service(
            name=schema["serviceName"], service_type="featureService",
            service_description=schema["description"], capabilities="Query,Create,Update",
            wkid=4326, max_record_count=5000,
        )
        service_item.update(item_properties={
            "title": schema["serviceTitle"],
            "snippet": "Private approved-only authoritative watershed observations and materializations.",
            "description": schema["description"],
            "tags": "PA Watershed Watch, watershed, water quality, approved observations, Central Pennsylvania",
        })

    if str(service_item.access).lower() != "private":
        raise RuntimeError("Authoritative service must remain private; refusing to continue")

    flc = FeatureLayerCollection.fromitem(service_item)
    if created_service:
        response = flc.manager.add_to_definition({
            "layers": [dataset_definition(d) for d in schema["layers"] if not d.get("table")],
            "tables": [dataset_definition(d) for d in schema["layers"] if d.get("table")],
        })
        if not response.get("success"):
            raise RuntimeError(f"add_to_definition failed: {response}")
        flc.refresh()
        flc.manager.update_definition({
            "capabilities": "Query,Create,Update",
            "allowGeometryUpdates": True,
            "syncEnabled": False,
            "editorTrackingInfo": {
                "enableEditorTracking": True,
                "enableOwnershipAccessControl": False,
                "allowOthersToUpdate": False,
                "allowOthersToDelete": False,
            },
        })
        flc.refresh()

    actual_by_name = ensure_authoritative_schema(flc, schema)
    configured_views = []
    specs_by_name = {dataset["name"]: dataset for dataset in schema["layers"]}

    for view_spec in schema["publicViews"]:
        dataset_spec = specs_by_name[view_spec["sourceDataset"]]
        actual_dataset = actual_by_name[dataset_spec["name"]]
        view_item = exact_owned_item(gis, view_spec["name"])
        created_view = view_item is None
        if created_view:
            view_item = create_view(flc, view_spec, dataset_spec, actual_dataset)
            if str(view_item.access).lower() != "private":
                raise RuntimeError(f"New view {view_item.title!r} was not created private; refusing to share")

        # Critical order: validate the actual returned hosted-view schema BEFORE any share call.
        verify_view_item(view_item, dataset_spec)
        if created_view:
            share_public(gis, view_item)
            view_item = gis.content.get(view_item.id)
            if str(view_item.access).lower() != "public":
                raise RuntimeError(f"ArcGIS did not make verified view {view_item.title!r} public")
        configured_views.append(view_item)

    print("\nARCGIS PUBLICATION PROVISIONING / VERIFICATION COMPLETE")
    print(f"Authoritative item ID: {service_item.id}")
    print(f"Authoritative FeatureServer: {service_item.url}")
    print("Actual authoritative dataset IDs (resolved by name, never assumed):")
    for key in ("SamplingSites", "ApprovedObservations", "Measurements", "LatestSiteConditions"):
        print(f"  - {key}: {actual_by_name[key].properties.id}")
    print("Public view items:")
    for item in configured_views:
        print(f"  - {item.title}: {item.id} | {item.url} | access={item.access}")
    print("\nNext: bind an item-scoped ArcGIS OAuth app credential to Firebase Functions secrets and run the controlled approval publication proof.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
