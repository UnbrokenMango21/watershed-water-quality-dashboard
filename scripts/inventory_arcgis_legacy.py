"""Read-only ArcGIS Pro inventory for legacy watershed items and the unresolved 117-site dataset.

Run from ArcGIS Pro's Python environment while signed in to the organization that owns
or can access the legacy watershed content:

    python scripts/inventory_arcgis_legacy.py

The script performs no edits, sharing changes, schema changes, deletes, or publishes.
It inventories accessible watershed-related items, profiles hosted feature-service
layers/tables, and writes a local JSON evidence file for migration planning.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from datetime import datetime, timezone
from typing import Any

from arcgis.features import FeatureLayerCollection
from arcgis.gis import GIS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "artifacts" / "arcgis_inventory"
KNOWN_QC_STAGING_ITEM_ID = "b7775c1bdada4aa8b0787714eca3eb15"
KEYWORDS = (
    "watershed",
    "water quality",
    "waterquality",
    "sampling",
    "monitoring",
    "central pa",
    "central pennsylvania",
    "watershed watch",
)
ITEM_ID_RE = re.compile(r"\b[a-fA-F0-9]{32}\b")
SERVICE_URL_RE = re.compile(r"https?://[^\s\"']+/(?:FeatureServer|MapServer)(?:/\d+)?", re.IGNORECASE)


def prop(obj: Any, name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, name)
    except Exception:
        try:
            return obj.get(name, default)
        except Exception:
            return default


def as_iso(epoch_ms: Any) -> str | None:
    try:
        if epoch_ms is None:
            return None
        return datetime.fromtimestamp(float(epoch_ms) / 1000.0, tz=timezone.utc).isoformat()
    except Exception:
        return None


def item_text(item: Any) -> str:
    tags = prop(item, "tags", []) or []
    type_keywords = prop(item, "typeKeywords", []) or []
    return " ".join(
        [
            str(prop(item, "title", "")),
            str(prop(item, "snippet", "")),
            str(prop(item, "description", "")),
            " ".join(str(value) for value in tags),
            " ".join(str(value) for value in type_keywords),
        ]
    ).lower()


def watershed_relevance(item: Any) -> int:
    text = item_text(item)
    return sum(5 for keyword in KEYWORDS if keyword in text)


def recursively_find_references(value: Any) -> tuple[set[str], set[str]]:
    item_ids: set[str] = set()
    service_urls: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key, child in node.items():
                key_lower = str(key).lower()
                if key_lower in {"itemid", "item_id", "webmap", "webmapid"} and isinstance(child, str):
                    if ITEM_ID_RE.fullmatch(child.strip()):
                        item_ids.add(child.strip())
                visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)
        elif isinstance(node, str):
            for match in ITEM_ID_RE.findall(node):
                item_ids.add(match)
            for match in SERVICE_URL_RE.findall(node):
                service_urls.add(match.rstrip(".,;)]}"))

    visit(value)
    return item_ids, service_urls


def field_profile(layer: Any) -> dict[str, Any]:
    fields = prop(layer.properties, "fields", []) or []
    return {
        "field_count": len(fields),
        "fields": [
            {
                "name": field.get("name"),
                "alias": field.get("alias"),
                "type": field.get("type"),
                "domain": (field.get("domain") or {}).get("name"),
            }
            for field in fields
        ],
    }


def dataset_profile(layer: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "id": int(prop(layer.properties, "id", -1)),
        "name": str(prop(layer.properties, "name", "")),
        "geometry_type": prop(layer.properties, "geometryType", None),
        "capabilities": str(prop(layer.properties, "capabilities", "")),
        "has_attachments": bool(prop(layer.properties, "hasAttachments", False)),
        **field_profile(layer),
    }
    try:
        record["record_count"] = int(layer.query(where="1=1", return_count_only=True))
    except Exception as exc:
        record["record_count"] = None
        record["count_error"] = str(exc)
    extent = prop(layer.properties, "extent", None)
    if extent:
        try:
            record["extent"] = dict(extent)
        except Exception:
            record["extent"] = str(extent)
    return record


def profile_feature_service(item: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"layers": [], "tables": []}
    try:
        collection = FeatureLayerCollection.fromitem(item)
        result["service_url"] = prop(item, "url", None)
        result["service_capabilities"] = str(prop(collection.properties, "capabilities", ""))
        result["layers"] = [dataset_profile(layer) for layer in collection.layers]
        result["tables"] = [dataset_profile(table) for table in collection.tables]
    except Exception as exc:
        result["profile_error"] = str(exc)
    return result


def sharing_profile(item: Any) -> dict[str, Any]:
    try:
        shared = item.shared_with
        return {
            "everyone": bool(shared.get("everyone", False)),
            "org": bool(shared.get("org", False)),
            "groups": [
                {"id": prop(group, "id", None), "title": prop(group, "title", None)}
                for group in (shared.get("groups", []) or [])
            ],
        }
    except Exception as exc:
        return {"error": str(exc)}


def base_item_record(item: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "item_id": prop(item, "id", None),
        "title": prop(item, "title", None),
        "type": prop(item, "type", None),
        "owner": prop(item, "owner", None),
        "url": prop(item, "url", None),
        "created_utc": as_iso(prop(item, "created", None)),
        "modified_utc": as_iso(prop(item, "modified", None)),
        "tags": list(prop(item, "tags", []) or []),
        "type_keywords": list(prop(item, "typeKeywords", []) or []),
        "sharing": sharing_profile(item),
        "relevance_score": watershed_relevance(item),
        "is_known_private_qc_staging": prop(item, "id", None) == KNOWN_QC_STAGING_ITEM_ID,
    }
    try:
        data = item.get_data(try_json=True)
    except TypeError:
        try:
            data = item.get_data()
        except Exception:
            data = None
    except Exception:
        data = None
    item_ids, service_urls = recursively_find_references(data)
    record["referenced_item_ids"] = sorted(item_ids)
    record["referenced_service_urls"] = sorted(service_urls)
    return record


def candidate_score(record: dict[str, Any]) -> int:
    score = int(record.get("relevance_score") or 0)
    service = record.get("feature_service") or {}
    datasets = [*(service.get("layers") or []), *(service.get("tables") or [])]
    if any(dataset.get("record_count") == 117 for dataset in datasets):
        score += 1000
    if sum(int(dataset.get("record_count") or 0) for dataset in datasets) == 117:
        score += 500
    if record.get("type") in {"Feature Service", "Web Map", "Dashboard", "Web Mapping Application"}:
        score += 25
    if record.get("is_known_private_qc_staging"):
        score -= 10000
    return score


def deduplicate_items(items: list[Any]) -> list[Any]:
    by_id: dict[str, Any] = {}
    for item in items:
        item_id = str(prop(item, "id", ""))
        if item_id:
            by_id[item_id] = item
    return list(by_id.values())


def main() -> int:
    gis = GIS("pro")
    username = gis.users.me.username
    print("=== LEGACY ARCGIS INVENTORY (READ-ONLY) ===")
    print(f"Portal: {gis.url}")
    print(f"Signed in as: {username}")

    # Search owned content broadly, then add organization-accessible keyword results.
    # Filtering/ranking is local so no item is mutated merely because it looks relevant.
    owned = gis.content.search(query=f"owner:{username}", max_items=1000)
    keyword_hits: list[Any] = []
    for keyword in ("watershed", '"water quality"', '"Watershed Watch"'):
        try:
            keyword_hits.extend(gis.content.search(query=keyword, max_items=250))
        except Exception as exc:
            print(f"WARN | search '{keyword}' failed: {exc}")

    items = deduplicate_items([*owned, *keyword_hits])
    records: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        record = base_item_record(item)
        if record["type"] == "Feature Service":
            record["feature_service"] = profile_feature_service(item)
        record["candidate_score"] = candidate_score(record)
        # Keep everything owned by the signed-in user for complete evidence; retain
        # organization results only when they have watershed relevance or a 117-count match.
        is_owned = record.get("owner") == username
        if is_owned or record["candidate_score"] > 0:
            records.append(record)
        print(f"Scanned {index}/{len(items)}: {record.get('title')} ({record.get('type')})")

    records.sort(key=lambda record: (-int(record.get("candidate_score") or 0), str(record.get("title") or "")))
    likely = [record for record in records if int(record.get("candidate_score") or 0) >= 500]

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "portal": gis.url,
        "signed_in_user": username,
        "known_qc_staging_item_id": KNOWN_QC_STAGING_ITEM_ID,
        "scan_counts": {
            "owned_items": len(owned),
            "keyword_result_items_before_dedupe": len(keyword_hits),
            "unique_accessible_items_scanned": len(items),
            "records_retained": len(records),
            "strong_117_candidates": len(likely),
        },
        "strong_117_candidates": likely,
        "items": records,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = OUTPUT_DIR / f"arcgis_legacy_inventory_{stamp}.json"
    output.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    print("\n=== SUMMARY ===")
    print(f"Retained records: {len(records)}")
    print(f"Strong 117-record candidates: {len(likely)}")
    for candidate in likely[:10]:
        print(
            f"  - score={candidate['candidate_score']} | {candidate.get('title')} | "
            f"{candidate.get('type')} | {candidate.get('item_id')}"
        )
    print(f"Evidence report: {output}")
    print("No ArcGIS content was modified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
