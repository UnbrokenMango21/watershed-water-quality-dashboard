"""Verify the Phase-6 ArcGIS Pro geodatabase configuration.

Run inside the open ArcGIS Pro project after setup_arcgis_phase6.py.
This script performs read-only checks and prints PASS/FAIL results.
"""

import os
import arcpy

aprx = arcpy.mp.ArcGISProject("CURRENT")
gdb = os.path.join(aprx.homeFolder, "CentralPA_Watershed.gdb")
arcpy.env.workspace = gdb

sites = os.path.join(gdb, "SamplingSites")
events = os.path.join(gdb, "SamplingEvents")
measurements = os.path.join(gdb, "Measurements")
flags = os.path.join(gdb, "ValidationFlags")
audits = os.path.join(gdb, "AuditEvents")
core = [sites, events, measurements, flags, audits]

checks = []

def record(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name}" + (f" | {detail}" if detail else ""))

print("\n=== PHASE 6 VERIFICATION ===\n")

# 1. GlobalIDs + GUID fields
for ds in core:
    fields = {f.name.lower(): f for f in arcpy.ListFields(ds)}
    gids = [f for f in fields.values() if f.type == "GlobalID"]
    record(f"GlobalID: {os.path.basename(ds)}", len(gids) == 1, gids[0].name if gids else "missing")

for ds, field in [
    (events, "site_guid"),
    (measurements, "event_guid"),
    (flags, "event_guid"),
    (flags, "measurement_guid"),
    (audits, "event_guid"),
]:
    fields = {f.name.lower(): f for f in arcpy.ListFields(ds)}
    f = fields.get(field.lower())
    record(f"GUID FK: {os.path.basename(ds)}.{field}", f is not None and f.type == "Guid", f.type if f else "missing")

# 2. Relationship classes
expected_rels = [
    "Sites_Events_Rel",
    "Events_Measurements_Rel",
    "Events_ValidationFlags_Rel",
    "Events_AuditEvents_Rel",
    "Measurements_ValidationFlags_Rel",
]
for rel in expected_rels:
    record(f"Relationship: {rel}", arcpy.Exists(os.path.join(gdb, rel)))

# 3. Domains and assignments
expected_domains = {
    "DOM_SiteStatus",
    "DOM_WorkflowStatus",
    "DOM_ValidationOutcome",
    "DOM_ReviewDecision",
    "DOM_WeatherCondition",
    "DOM_TemperatureUnit",
    "DOM_Boolean01",
    "DOM_TestType",
    "DOM_DataCollectedBy",
    "DOM_FlagSeverity",
    "DOM_FlagCategory",
    "DOM_ActorType",
}
actual_domains = {d.name: d for d in arcpy.da.ListDomains(gdb)}
for name in sorted(expected_domains):
    d = actual_domains.get(name)
    detail = f"{len(d.codedValues or {})} coded values" if d else "missing"
    record(f"Domain exists: {name}", d is not None, detail)

assignments = [
    (sites, "site_status", "DOM_SiteStatus"),
    (events, "data_collected_by", "DOM_DataCollectedBy"),
    (events, "test_type", "DOM_TestType"),
    (events, "time_known", "DOM_Boolean01"),
    (events, "time_imputed", "DOM_Boolean01"),
    (events, "weather_condition", "DOM_WeatherCondition"),
    (events, "temp_entered_unit", "DOM_TemperatureUnit"),
    (events, "workflow_status", "DOM_WorkflowStatus"),
    (events, "validation_outcome", "DOM_ValidationOutcome"),
    (events, "review_decision", "DOM_ReviewDecision"),
    (measurements, "required_by_protocol", "DOM_Boolean01"),
    (flags, "severity", "DOM_FlagSeverity"),
    (flags, "category", "DOM_FlagCategory"),
    (flags, "resolved", "DOM_Boolean01"),
    (audits, "actor_type", "DOM_ActorType"),
    (audits, "previous_state", "DOM_WorkflowStatus"),
    (audits, "new_state", "DOM_WorkflowStatus"),
]
for ds, field, expected in assignments:
    fields = {f.name.lower(): f for f in arcpy.ListFields(ds)}
    f = fields.get(field.lower())
    actual = f.domain if f else None
    record(f"Domain assignment: {os.path.basename(ds)}.{field}", actual == expected, actual or "none")

# 4. Attachments + editor tracking
record("SamplingEvents attachment table", arcpy.Exists(os.path.join(gdb, "SamplingEvents__ATTACH")))
record("SamplingEvents attachment relationship", arcpy.Exists(os.path.join(gdb, "SamplingEvents__ATTACHREL")))

for ds in core:
    desc = arcpy.Describe(ds)
    enabled = bool(getattr(desc, "editorTrackingEnabled", False))
    use_utc = getattr(desc, "isTimeInUTC", None)
    detail = f"editorTrackingEnabled={enabled}; isTimeInUTC={use_utc}"
    record(f"Editor tracking: {os.path.basename(ds)}", enabled and use_utc is not False, detail)

failed = [c for c in checks if not c[1]]
print("\n=== SUMMARY ===")
print(f"Total checks: {len(checks)}")
print(f"Passed: {len(checks) - len(failed)}")
print(f"Failed: {len(failed)}")
if failed:
    print("\nFAILED CHECKS:")
    for name, _, detail in failed:
        print(f" - {name}: {detail}")
else:
    print("\nPHASE 6 VERIFIED: ALL CHECKS PASSED")
