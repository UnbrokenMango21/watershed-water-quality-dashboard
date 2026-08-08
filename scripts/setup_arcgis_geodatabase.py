"""Create the Step-5 ArcGIS Pro geodatabase prototype.

Run this from inside an open ArcGIS Pro project using the Python window or a Notebook.
The script is idempotent: it creates missing datasets/fields and skips ones that already exist.
"""

import os
import arcpy

aprx = arcpy.mp.ArcGISProject("CURRENT")
home = aprx.homeFolder
gdb_name = "CentralPA_Watershed.gdb"
gdb = os.path.join(home, gdb_name)

if not arcpy.Exists(gdb):
    arcpy.management.CreateFileGDB(home, gdb_name)
    print(f"Created {gdb}")
else:
    print(f"Using existing {gdb}")

aprx.defaultGeodatabase = gdb
aprx.save()
print(f"Default geodatabase set to: {aprx.defaultGeodatabase}")

sr = arcpy.SpatialReference(4326)  # WGS 1984


def ensure_feature_class(name):
    path = os.path.join(gdb, name)
    if not arcpy.Exists(path):
        arcpy.management.CreateFeatureclass(gdb, name, "POINT", spatial_reference=sr)
        print(f"Created point feature class: {name}")
    else:
        print(f"Feature class exists: {name}")
    return path


def ensure_table(name):
    path = os.path.join(gdb, name)
    if not arcpy.Exists(path):
        arcpy.management.CreateTable(gdb, name)
        print(f"Created table: {name}")
    else:
        print(f"Table exists: {name}")
    return path


def ensure_fields(dataset, field_defs):
    existing = {f.name.lower() for f in arcpy.ListFields(dataset)}
    for field in field_defs:
        name = field[0]
        ftype = field[1]
        length = field[2] if len(field) > 2 else None
        alias = field[3] if len(field) > 3 else None
        if name.lower() in existing:
            continue
        kwargs = {}
        if length and ftype.upper() == "TEXT":
            kwargs["field_length"] = length
        if alias:
            kwargs["field_alias"] = alias
        arcpy.management.AddField(dataset, name, ftype, **kwargs)
        print(f"  Added {name} to {os.path.basename(dataset)}")


sites = ensure_feature_class("SamplingSites")
events = ensure_feature_class("SamplingEvents")
measurements = ensure_table("Measurements")
flags = ensure_table("ValidationFlags")
audits = ensure_table("AuditEvents")

ensure_fields(sites, [
    ("site_id", "TEXT", 36, "Site ID"),
    ("site_code", "TEXT", 32, "Site Code"),
    ("site_name_internal", "TEXT", 160, "Site Name (Internal)"),
    ("site_name_public", "TEXT", 160, "Site Name (Public)"),
    ("landowner_name", "TEXT", 160, "Landowner Name — Private"),
    ("landowner_notes", "TEXT", 1000, "Landowner Notes — Private"),
    ("watershed_name", "TEXT", 120, "Watershed Name"),
    ("site_status", "TEXT", 20, "Site Status"),
    ("latitude", "DOUBLE", None, "Latitude"),
    ("longitude", "DOUBLE", None, "Longitude"),
    ("access_notes_internal", "TEXT", 1000, "Access Notes — Private"),
    ("site_description", "TEXT", 2000, "Site Description"),
    ("created_at", "DATE", None, "Created At"),
    ("updated_at", "DATE", None, "Updated At"),
    ("schema_version", "TEXT", 20, "Schema Version"),
])

ensure_fields(events, [
    ("event_id", "TEXT", 36, "Event ID"),
    ("submission_id", "TEXT", 36, "Submission ID"),
    ("site_id", "TEXT", 36, "Site ID"),
    ("collector_user_id", "TEXT", 128, "Collector User ID — Private"),
    ("data_collected_by", "TEXT", 80, "Data Collected By"),
    ("test_type", "TEXT", 80, "Test Type"),
    ("test_type_other", "TEXT", 200, "Other Test Type"),
    ("method_name", "TEXT", 160, "Method"),
    ("instrument_name", "TEXT", 160, "Instrument / Lab"),
    ("collected_at", "DATE", None, "Collected At"),
    ("submitted_at", "DATE", None, "Submitted At"),
    ("time_known", "SHORT", None, "Time Known"),
    ("time_imputed", "SHORT", None, "Time Imputed"),
    ("latitude", "DOUBLE", None, "Latitude"),
    ("longitude", "DOUBLE", None, "Longitude"),
    ("gps_accuracy_m", "DOUBLE", None, "GPS Accuracy (m)"),
    ("site_distance_m", "DOUBLE", None, "Distance From Site (m)"),
    ("weather_condition", "TEXT", 30, "Weather Condition"),
    ("temp_entered_value", "DOUBLE", None, "Temperature Entered"),
    ("temp_entered_unit", "TEXT", 4, "Temperature Entered Unit"),
    ("temp_f", "DOUBLE", None, "Temp (F)"),
    ("temp_c", "DOUBLE", None, "Temp (C)"),
    ("field_notes_original", "TEXT", 4000, "Field Notes (Original)"),
    ("workflow_status", "TEXT", 30, "Workflow Status"),
    ("validation_outcome", "TEXT", 30, "Validation Outcome"),
    ("completeness_score", "DOUBLE", None, "Completeness Score"),
    ("location_quality_score", "DOUBLE", None, "Location Quality Score"),
    ("method_quality_score", "DOUBLE", None, "Method Quality Score"),
    ("validation_quality_score", "DOUBLE", None, "Validation Quality Score"),
    ("temporal_quality_score", "DOUBLE", None, "Temporal Quality Score"),
    ("historical_quality_score", "DOUBLE", None, "Historical Quality Score"),
    ("overall_quality_score", "DOUBLE", None, "Overall Quality Score"),
    ("anomaly_score", "DOUBLE", None, "Anomaly Score"),
    ("error_flag_count", "LONG", None, "Error Flag Count"),
    ("warning_flag_count", "LONG", None, "Warning Flag Count"),
    ("info_flag_count", "LONG", None, "Info Flag Count"),
    ("review_decision", "TEXT", 30, "Review Decision"),
    ("reviewer_user_id", "TEXT", 128, "Reviewer User ID — Private"),
    ("review_comment", "TEXT", 4000, "Review Comment"),
    ("reviewed_at", "DATE", None, "Reviewed At"),
    ("published_at", "DATE", None, "Published At"),
    ("schema_version", "TEXT", 20, "Schema Version"),
    ("validation_rules_version", "TEXT", 20, "Validation Rules Version"),
    ("quality_algorithm_version", "TEXT", 20, "Quality Algorithm Version"),
    ("mobile_app_version", "TEXT", 30, "Mobile App Version"),
    ("publish_attempt_count", "LONG", None, "Publish Attempt Count"),
    ("last_publish_error_code", "TEXT", 120, "Last Publish Error Code"),
])

ensure_fields(measurements, [
    ("measurement_id", "TEXT", 36, "Measurement ID"),
    ("event_id", "TEXT", 36, "Event ID"),
    ("parameter_code", "TEXT", 40, "Parameter Code"),
    ("display_name", "TEXT", 80, "Display Name"),
    ("value_original", "DOUBLE", None, "Original Value"),
    ("value_current", "DOUBLE", None, "Current Value"),
    ("unit_code", "TEXT", 24, "Unit"),
    ("measurement_method", "TEXT", 160, "Measurement Method"),
    ("instrument_id", "TEXT", 120, "Instrument ID"),
    ("required_by_protocol", "SHORT", None, "Required By Protocol"),
    ("measurement_notes", "TEXT", 1000, "Measurement Notes"),
    ("schema_version", "TEXT", 20, "Schema Version"),
])

ensure_fields(flags, [
    ("flag_id", "TEXT", 36, "Flag ID"),
    ("event_id", "TEXT", 36, "Event ID"),
    ("measurement_id", "TEXT", 36, "Measurement ID"),
    ("rule_id", "TEXT", 80, "Rule ID"),
    ("rule_version", "TEXT", 20, "Rule Version"),
    ("severity", "TEXT", 24, "Severity"),
    ("category", "TEXT", 40, "Category"),
    ("message", "TEXT", 1000, "Message"),
    ("observed_value", "TEXT", 200, "Observed Value Snapshot"),
    ("created_at", "DATE", None, "Created At"),
    ("resolved", "SHORT", None, "Resolved"),
    ("resolution_note", "TEXT", 1000, "Resolution Note"),
])

ensure_fields(audits, [
    ("audit_event_id", "TEXT", 36, "Audit Event ID"),
    ("submission_id", "TEXT", 36, "Submission ID"),
    ("event_id", "TEXT", 36, "Event ID"),
    ("event_type", "TEXT", 50, "Event Type"),
    ("actor_type", "TEXT", 20, "Actor Type"),
    ("actor_user_id", "TEXT", 128, "Actor User ID — Private"),
    ("occurred_at", "DATE", None, "Occurred At"),
    ("previous_state", "TEXT", 30, "Previous State"),
    ("new_state", "TEXT", 30, "New State"),
    ("field_path", "TEXT", 200, "Field Path"),
    ("old_value", "TEXT", 1000, "Old Value Snapshot"),
    ("new_value", "TEXT", 1000, "New Value Snapshot"),
    ("reason", "TEXT", 2000, "Reason"),
    ("schema_version", "TEXT", 20, "Schema Version"),
])

print("\nSTEP 5 PROTOTYPE COMPLETE")
print(f"Geodatabase: {gdb}")
for dataset_name in ["SamplingSites", "SamplingEvents", "Measurements", "ValidationFlags", "AuditEvents"]:
    print(f"  - {dataset_name}")
print("Save the ArcGIS Pro project before closing.")
