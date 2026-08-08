"""Phase 7 helper: set Eastern Time on all date-bearing ArcGIS Pro map members.

Run from the ArcGIS Pro Python window while MyProject is open.

This script:
- Targets the five watershed layers/tables in the current map.
- Detects which datasets actually contain temporal fields.
- Sets the layer/table CIM time reference to Eastern Time.
- Enables daylight-saving and dynamic adjustment rules.
- Applies the time reference to all temporal fields.
- Leaves time filtering disabled (this is a reference time zone only).
- Saves the ArcGIS Pro project.

It is safe to rerun.
"""

import arcpy

TARGETS = {
    "SamplingSites",
    "SamplingEvents",
    "Measurements",
    "ValidationFlags",
    "AuditEvents",
}

WINDOWS_TIME_ZONE = "Eastern Standard Time"
IANA_TIME_ZONE = "America/New_York"
DATE_FIELD_TYPES = {"Date", "DateOnly", "TimeOnly", "TimestampOffset"}


def _has_temporal_fields(map_member):
    """Return a list of temporal field names for a layer or standalone table."""
    try:
        data_source = map_member.dataSource
        return [
            f.name
            for f in arcpy.ListFields(data_source)
            if f.type in DATE_FIELD_TYPES
        ]
    except Exception as exc:
        print(f"WARN | Could not inspect fields for {map_member.name}: {exc}")
        return []


def _new_time_reference():
    ref = arcpy.cim.CreateCIMObjectFromClassName("TimeReference", "V3")
    ref.timeZoneNameID = WINDOWS_TIME_ZONE
    ref.timeZoneIanaID = IANA_TIME_ZONE
    ref.respectsDaylightSavingTime = True
    ref.respectsDynamicAdjustmentRules = True
    return ref


def _configure_time_definition(existing=None):
    time_def = existing
    if time_def is None:
        time_def = arcpy.cim.CreateCIMObjectFromClassName(
            "CIMTimeDataDefinition", "V3"
        )

    time_def.timeReference = _new_time_reference()
    time_def.applyTimeReferenceToAllFields = True

    # We are defining the reference zone only; do not turn on time filtering.
    time_def.useTime = False
    return time_def


def _set_layer_time_zone(layer):
    cim = layer.getDefinition("V3")
    feature_table = getattr(cim, "featureTable", None)
    if feature_table is None:
        raise RuntimeError("Layer CIM has no featureTable")

    feature_table.timeDefinition = _configure_time_definition(
        getattr(feature_table, "timeDefinition", None)
    )
    layer.setDefinition(cim)


def _set_table_time_zone(table):
    cim = table.getDefinition("V3")
    cim.timeDefinition = _configure_time_definition(
        getattr(cim, "timeDefinition", None)
    )
    table.setDefinition(cim)


def main():
    aprx = arcpy.mp.ArcGISProject("CURRENT")
    maps = aprx.listMaps("Map") or aprx.listMaps()
    if not maps:
        raise RuntimeError("No map found in the current ArcGIS Pro project.")
    m = maps[0]

    found = set()
    changed = []
    skipped = []
    failed = []

    print("PHASE 7: applying Eastern Time to date-bearing map members...")
    print(f"Map: {m.name}")
    print(f"Windows zone: {WINDOWS_TIME_ZONE}")
    print(f"IANA zone: {IANA_TIME_ZONE}")
    print("DST: enabled")
    print()

    for lyr in m.listLayers():
        if lyr.name not in TARGETS:
            continue
        found.add(lyr.name)
        fields = _has_temporal_fields(lyr)
        if not fields:
            skipped.append((lyr.name, "no temporal fields"))
            print(f"SKIP | {lyr.name} | no temporal fields")
            continue
        try:
            _set_layer_time_zone(lyr)
            changed.append((lyr.name, fields))
            print(f"PASS | {lyr.name} | Eastern Time applied to: {', '.join(fields)}")
        except Exception as exc:
            failed.append((lyr.name, str(exc)))
            print(f"FAIL | {lyr.name} | {exc}")

    for tbl in m.listTables():
        if tbl.name not in TARGETS:
            continue
        found.add(tbl.name)
        fields = _has_temporal_fields(tbl)
        if not fields:
            skipped.append((tbl.name, "no temporal fields"))
            print(f"SKIP | {tbl.name} | no temporal fields")
            continue
        try:
            _set_table_time_zone(tbl)
            changed.append((tbl.name, fields))
            print(f"PASS | {tbl.name} | Eastern Time applied to: {', '.join(fields)}")
        except Exception as exc:
            failed.append((tbl.name, str(exc)))
            print(f"FAIL | {tbl.name} | {exc}")

    missing = sorted(TARGETS - found)
    for name in missing:
        failed.append((name, "target not present in current map"))
        print(f"FAIL | {name} | target not present in current map")

    aprx.save()

    print("\n=== PHASE 7 TIME-ZONE SUMMARY ===")
    print(f"Changed: {len(changed)}")
    print(f"Skipped (no temporal fields): {len(skipped)}")
    print(f"Failed: {len(failed)}")

    if failed:
        print("\nTIME-ZONE CONFIGURATION INCOMPLETE")
        for name, reason in failed:
            print(f"  - {name}: {reason}")
    else:
        print("\nTIME-ZONE CONFIGURATION COMPLETE")
        print("Eastern Time / America_New_York is applied to all date-bearing watershed map members.")
        print("Daylight-saving adjustment is enabled.")
        print("Project saved. Re-run Share As Web Layer > Analyze.")


main()
