"""Verify the private ArcGIS Online QC staging service after Phase 7 publication.

Run inside ArcGIS Pro's Python window while signed in to the Penn State portal.
The script is read-only: it does not edit the hosted service.
"""

from arcgis.gis import GIS

ITEM_ID = "b7775c1bdada4aa8b0787714eca3eb15"
EXPECTED_TITLE = "Central_PA_Watershed_QC_Staging"
EXPECTED = {
    10: "SamplingSites",
    20: "SamplingEvents",
    30: "Measurements",
    40: "ValidationFlags",
    50: "AuditEvents",
}
EXPECTED_GUID_FIELDS = {
    10: ["GlobalID"],
    20: ["GlobalID", "site_guid"],
    30: ["GlobalID", "event_guid"],
    40: ["GlobalID", "event_guid", "measurement_guid"],
    50: ["GlobalID", "event_guid"],
}
EXPECTED_DOMAIN_FIELDS = {
    10: ["site_status"],
    20: ["data_collected_by", "test_type", "time_known", "time_imputed", "weather_condition", "temp_entered_unit", "workflow_status", "validation_outcome", "review_decision"],
    40: ["severity", "category", "resolved"],
    50: ["actor_type", "previous_state", "new_state"],
}
EXPECTED_RELATION_PAIRS = {
    (10, 20),
    (20, 30),
    (20, 40),
    (20, 50),
    (30, 40),
}

passed = 0
failed = 0
warnings = 0


def pass_check(label, detail=""):
    global passed
    passed += 1
    suffix = f" | {detail}" if detail else ""
    print(f"PASS | {label}{suffix}")


def fail_check(label, detail=""):
    global failed
    failed += 1
    suffix = f" | {detail}" if detail else ""
    print(f"FAIL | {label}{suffix}")


def warn_check(label, detail=""):
    global warnings
    warnings += 1
    suffix = f" | {detail}" if detail else ""
    print(f"WARN | {label}{suffix}")


def prop(obj, name, default=None):
    try:
        return getattr(obj, name)
    except Exception:
        try:
            return obj.get(name, default)
        except Exception:
            return default


print("=== PHASE 7 ARCGIS ONLINE VERIFICATION ===")
print("Connecting through the ArcGIS Pro signed-in portal...")
gis = GIS("pro")
item = gis.content.get(ITEM_ID)

if item is None:
    raise RuntimeError(f"Could not access ArcGIS Online item {ITEM_ID} through the ArcGIS Pro login.")

print(f"Item: {item.title}")
print(f"Owner: {item.owner}")
print(f"URL: {item.url}")
print()

if item.title == EXPECTED_TITLE:
    pass_check("Hosted item title", item.title)
else:
    fail_check("Hosted item title", item.title)

# Sharing/privacy
try:
    shared = item.shared_with
    everyone = bool(shared.get("everyone", False))
    org = bool(shared.get("org", False))
    groups = shared.get("groups", []) or []
    if not everyone and not org and not groups:
        pass_check("Item sharing is owner-only/private")
    else:
        fail_check("Item sharing is owner-only/private", f"everyone={everyone}; org={org}; groups={len(groups)}")
except Exception as exc:
    warn_check("Could not read sharing state", str(exc))

# Collect published layers/tables by service ID.
all_parts = list(item.layers) + list(item.tables)
by_id = {int(p.properties.id): p for p in all_parts}

for sid, expected_name in EXPECTED.items():
    p = by_id.get(sid)
    if p is None:
        fail_check(f"Service ID {sid} exists", expected_name)
        continue
    actual_name = str(p.properties.name)
    if actual_name == expected_name:
        pass_check(f"Service ID {sid}", actual_name)
    else:
        fail_check(f"Service ID {sid}", f"expected {expected_name}; got {actual_name}")

# Ensure no production data has been loaded.
for sid, expected_name in EXPECTED.items():
    p = by_id.get(sid)
    if p is None:
        continue
    try:
        count = p.query(return_count_only=True)
        if count == 0:
            pass_check(f"{expected_name} is empty", "0 records")
        else:
            fail_check(f"{expected_name} is empty", f"{count} records")
    except Exception as exc:
        fail_check(f"Query {expected_name}", str(exc))

# IDs and GUID foreign keys.
for sid, names in EXPECTED_GUID_FIELDS.items():
    p = by_id.get(sid)
    if p is None:
        continue
    fields = {f["name"]: f for f in p.properties.fields}
    for name in names:
        f = fields.get(name)
        if not f:
            fail_check(f"{EXPECTED[sid]}.{name} exists")
            continue
        ftype = f.get("type", "")
        expected_type = "esriFieldTypeGlobalID" if name == "GlobalID" else "esriFieldTypeGUID"
        if ftype == expected_type:
            pass_check(f"{EXPECTED[sid]}.{name}", ftype)
        else:
            fail_check(f"{EXPECTED[sid]}.{name}", f"expected {expected_type}; got {ftype}")

# Coded-value domains survived publication.
for sid, names in EXPECTED_DOMAIN_FIELDS.items():
    p = by_id.get(sid)
    if p is None:
        continue
    fields = {f["name"]: f for f in p.properties.fields}
    for name in names:
        domain = (fields.get(name) or {}).get("domain")
        if domain and domain.get("type") == "codedValue":
            values = domain.get("codedValues", []) or []
            pass_check(f"Domain: {EXPECTED[sid]}.{name}", f"{len(values)} coded values")
        else:
            fail_check(f"Domain: {EXPECTED[sid]}.{name}", "coded-value domain missing")

# Relationships: infer origin/destination pairs from relatedTableId on each published part.
relation_pairs = set()
for sid, p in by_id.items():
    rels = prop(p.properties, "relationships", []) or []
    for rel in rels:
        related_id = int(prop(rel, "relatedTableId", -1))
        role = str(prop(rel, "role", "")).lower()
        if related_id < 0:
            continue
        if "origin" in role:
            relation_pairs.add((sid, related_id))
        elif "destination" in role:
            relation_pairs.add((related_id, sid))
        else:
            relation_pairs.add(tuple(sorted((sid, related_id))))

for pair in sorted(EXPECTED_RELATION_PAIRS):
    if pair in relation_pairs or tuple(sorted(pair)) in relation_pairs:
        pass_check("Relationship", f"{EXPECTED[pair[0]]} -> {EXPECTED[pair[1]]}")
    else:
        fail_check("Relationship", f"{EXPECTED[pair[0]]} -> {EXPECTED[pair[1]]}")

# Attachments on SamplingEvents.
events = by_id.get(20)
if events is not None:
    has_attachments = bool(prop(events.properties, "hasAttachments", False))
    if has_attachments:
        pass_check("SamplingEvents attachments enabled")
    else:
        fail_check("SamplingEvents attachments enabled")

# Editing / sync / geometry behavior at service/layer level.
service_props = getattr(item, "_hydrated", False)
try:
    # Layer capabilities are often the most reliable published indicator.
    if events is not None:
        caps = str(prop(events.properties, "capabilities", ""))
        capset = {c.strip().lower() for c in caps.split(",") if c.strip()}
        if "create" in capset and "update" in capset and "delete" not in capset:
            pass_check("QC editing capabilities", caps)
        else:
            fail_check("QC editing capabilities", caps)

        allow_geom = prop(events.properties, "allowGeometryUpdates", None)
        if allow_geom is False:
            pass_check("Geometry updates disabled")
        elif allow_geom is None:
            warn_check("Geometry-update property not exposed by API")
        else:
            fail_check("Geometry updates disabled", f"allowGeometryUpdates={allow_geom}")

        sync_enabled = bool(prop(events.properties, "syncEnabled", False))
        if not sync_enabled:
            pass_check("Sync disabled")
        else:
            fail_check("Sync disabled", "syncEnabled=True")
except Exception as exc:
    warn_check("Could not fully inspect editing configuration", str(exc))

# Date-field timezone metadata. ArcGIS commonly exposes this as dateFieldsTimeReference.
for sid, expected_name in EXPECTED.items():
    p = by_id.get(sid)
    if p is None:
        continue
    date_fields = [f for f in p.properties.fields if f.get("type") == "esriFieldTypeDate"]
    if not date_fields:
        continue
    tref = prop(p.properties, "dateFieldsTimeReference", None)
    if tref:
        tz = str(prop(tref, "timeZone", ""))
        daylight = prop(tref, "respectsDaylightSaving", None)
        text = f"timeZone={tz}; respectsDaylightSaving={daylight}"
        if "Eastern" in tz and daylight is True:
            pass_check(f"Eastern Time metadata: {expected_name}", text)
        elif "Eastern" in tz:
            warn_check(f"Eastern Time metadata: {expected_name}", text)
        else:
            fail_check(f"Eastern Time metadata: {expected_name}", text)
    else:
        warn_check(f"Date time-reference metadata not exposed: {expected_name}")

print()
print("=== SUMMARY ===")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Warnings: {warnings}")

if failed == 0:
    print("PHASE 7 ONLINE VERIFICATION PASSED")
else:
    print("PHASE 7 ONLINE VERIFICATION NEEDS ATTENTION")
