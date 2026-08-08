"""Harden the Step-5 ArcGIS Pro geodatabase for Phase 6.

Run inside the open ArcGIS Pro project. This script is designed to be idempotent:
it skips GlobalIDs, GUID fields, domains, relationship classes, attachments, and
editor tracking that already exist.

Close Fields/Properties views before running to avoid schema locks.
"""

import os
import arcpy

aprx = arcpy.mp.ArcGISProject("CURRENT")
gdb = os.path.join(aprx.homeFolder, "CentralPA_Watershed.gdb")

if not arcpy.Exists(gdb):
    raise RuntimeError(f"Expected geodatabase not found: {gdb}")

arcpy.env.workspace = gdb

sites = os.path.join(gdb, "SamplingSites")
events = os.path.join(gdb, "SamplingEvents")
measurements = os.path.join(gdb, "Measurements")
flags = os.path.join(gdb, "ValidationFlags")
audits = os.path.join(gdb, "AuditEvents")
core = [sites, events, measurements, flags, audits]

for dataset in core:
    if not arcpy.Exists(dataset):
        raise RuntimeError(f"Missing Phase-5 dataset: {dataset}")


def field_names(dataset):
    return {f.name.lower(): f for f in arcpy.ListFields(dataset)}


def has_globalid(dataset):
    return any(f.type == "GlobalID" for f in arcpy.ListFields(dataset))


def ensure_globalid(dataset):
    if has_globalid(dataset):
        print(f"GlobalID exists: {os.path.basename(dataset)}")
    else:
        arcpy.management.AddGlobalIDs(dataset)
        print(f"Added GlobalID: {os.path.basename(dataset)}")


def ensure_guid_field(dataset, name, alias):
    fields = field_names(dataset)
    if name.lower() not in fields:
        arcpy.management.AddField(dataset, name, "GUID", field_alias=alias)
        print(f"Added GUID field {name}: {os.path.basename(dataset)}")
    else:
        print(f"GUID field exists {name}: {os.path.basename(dataset)}")


def existing_domains():
    return {d.name: d for d in arcpy.da.ListDomains(gdb)}


def ensure_domain(name, description, field_type, values):
    domains = existing_domains()
    if name not in domains:
        arcpy.management.CreateDomain(gdb, name, description, field_type, "CODED")
        print(f"Created domain: {name}")
    current = existing_domains()[name]
    coded = dict(current.codedValues or {})
    for code, label in values:
        if code not in coded:
            arcpy.management.AddCodedValueToDomain(gdb, name, code, label)
            print(f"  Added {code} to {name}")


def assign_domain(dataset, field, domain):
    fields = field_names(dataset)
    if field.lower() not in fields:
        raise RuntimeError(f"Field {field} not found in {dataset}")
    current_domain = fields[field.lower()].domain
    if current_domain == domain:
        print(f"Domain already assigned: {os.path.basename(dataset)}.{field} -> {domain}")
    else:
        arcpy.management.AssignDomainToField(dataset, field, domain)
        print(f"Assigned domain: {os.path.basename(dataset)}.{field} -> {domain}")


def ensure_relationship(name, origin, destination, forward, backward, foreign_key):
    out = os.path.join(gdb, name)
    if arcpy.Exists(out):
        print(f"Relationship exists: {name}")
        return
    arcpy.management.CreateRelationshipClass(
        origin,
        destination,
        out,
        "SIMPLE",
        forward,
        backward,
        "NONE",
        "ONE_TO_MANY",
        "NONE",
        "GlobalID",
        foreign_key,
    )
    print(f"Created relationship: {name}")


def ensure_editor_tracking(dataset):
    desc = arcpy.Describe(dataset)
    if getattr(desc, "editorTrackingEnabled", False):
        print(f"Editor tracking exists: {os.path.basename(dataset)}")
    else:
        arcpy.management.EnableEditorTracking(
            dataset,
            "arcgis_created_by",
            "arcgis_created_at",
            "arcgis_edited_by",
            "arcgis_edited_at",
            "ADD_FIELDS",
            "UTC",
        )
        print(f"Enabled editor tracking: {os.path.basename(dataset)}")


print("PHASE 6: adding GlobalIDs...")
for dataset in core:
    ensure_globalid(dataset)

print("\nPHASE 6: adding GUID foreign keys...")
ensure_guid_field(events, "site_guid", "Site GlobalID Foreign Key")
ensure_guid_field(measurements, "event_guid", "Event GlobalID Foreign Key")
ensure_guid_field(flags, "event_guid", "Event GlobalID Foreign Key")
ensure_guid_field(flags, "measurement_guid", "Measurement GlobalID Foreign Key")
ensure_guid_field(audits, "event_guid", "Event GlobalID Foreign Key")

print("\nPHASE 6: creating coded-value domains...")
ensure_domain("DOM_SiteStatus", "Sampling site lifecycle status", "TEXT", [
    ("ACTIVE", "Active"),
    ("INACTIVE", "Inactive"),
    ("RETIRED", "Retired"),
])

ensure_domain("DOM_WorkflowStatus", "Submission workflow state", "TEXT", [
    ("DRAFT", "Draft"),
    ("SUBMITTED", "Submitted"),
    ("VALIDATING", "Validating"),
    ("PENDING_REVIEW", "Pending Review"),
    ("NEEDS_CORRECTION", "Needs Correction"),
    ("RESUBMITTED", "Resubmitted"),
    ("APPROVED", "Approved"),
    ("REJECTED", "Rejected"),
    ("PUBLISHING", "Publishing"),
    ("PUBLISH_FAILED", "Publish Failed"),
    ("PUBLISHED", "Published"),
])

ensure_domain("DOM_ValidationOutcome", "Automated validation outcome", "TEXT", [
    ("PASS", "Pass"),
    ("PASS_WITH_WARNINGS", "Pass With Warnings"),
    ("FAIL", "Fail"),
])

ensure_domain("DOM_ReviewDecision", "Supervisor review decision", "TEXT", [
    ("APPROVE", "Approve"),
    ("REQUEST_CORRECTION", "Request Correction"),
    ("REJECT", "Reject"),
])

ensure_domain("DOM_WeatherCondition", "Field weather condition", "TEXT", [
    ("CLEAR", "Clear"),
    ("PARTLY_CLOUDY", "Partly Cloudy"),
    ("CLOUDY", "Cloudy"),
    ("RAIN", "Rain"),
    ("SNOW", "Snow"),
    ("FOG", "Fog"),
    ("OTHER", "Other"),
    ("UNKNOWN", "Unknown"),
])

ensure_domain("DOM_TemperatureUnit", "Temperature entry unit", "TEXT", [
    ("C", "Celsius"),
    ("F", "Fahrenheit"),
])

ensure_domain("DOM_Boolean01", "Boolean yes/no stored as short integer", "SHORT", [
    (0, "No"),
    (1, "Yes"),
])

ensure_domain("DOM_TestType", "Collection/test type", "TEXT", [
    ("IN_SITU_FIELD", "In-situ / Field Instrument"),
    ("PENN_STATE_LAB", "Penn State Lab"),
    ("EXTERNAL_LAB", "External Lab"),
    ("FIELD_KIT_COLORIMETRIC", "Field Kit / Colorimetric"),
    ("CONTINUOUS_SENSOR", "Continuous Sensor / Sonde"),
    ("IN_SITU_PSU_LAB", "In-situ/Penn State Lab"),
    ("OTHER", "Other"),
])

ensure_domain("DOM_DataCollectedBy", "Collector category", "TEXT", [
    ("STUDENT_RESEARCHER", "Student/researcher"),
    ("FACULTY_STAFF", "Faculty/staff"),
    ("VOLUNTEER", "Volunteer/community monitor"),
    ("PARTNER_ORG", "Partner organization"),
    ("OTHER", "Other"),
])

ensure_domain("DOM_FlagSeverity", "Validation flag severity", "TEXT", [
    ("ERROR", "Error"),
    ("PLAUSIBILITY_WARNING", "Plausibility Warning"),
    ("ENVIRONMENTAL_ALERT", "Environmental Alert"),
    ("INFO", "Information"),
])

ensure_domain("DOM_FlagCategory", "Validation flag category", "TEXT", [
    ("SCHEMA", "Schema"),
    ("LOCATION", "Location"),
    ("MEASUREMENT", "Measurement"),
    ("METHOD", "Method / Instrument"),
    ("TEMPORAL", "Temporal"),
    ("DUPLICATE", "Duplicate"),
    ("PROVENANCE", "Provenance"),
    ("OTHER", "Other"),
])

ensure_domain("DOM_ActorType", "Audit actor type", "TEXT", [
    ("COLLECTOR", "Collector"),
    ("SUPERVISOR", "Supervisor"),
    ("SYSTEM", "System"),
    ("ADMIN", "Administrator"),
])

print("\nPHASE 6: assigning domains...")
assign_domain(sites, "site_status", "DOM_SiteStatus")
assign_domain(events, "data_collected_by", "DOM_DataCollectedBy")
assign_domain(events, "test_type", "DOM_TestType")
assign_domain(events, "time_known", "DOM_Boolean01")
assign_domain(events, "time_imputed", "DOM_Boolean01")
assign_domain(events, "weather_condition", "DOM_WeatherCondition")
assign_domain(events, "temp_entered_unit", "DOM_TemperatureUnit")
assign_domain(events, "workflow_status", "DOM_WorkflowStatus")
assign_domain(events, "validation_outcome", "DOM_ValidationOutcome")
assign_domain(events, "review_decision", "DOM_ReviewDecision")
assign_domain(measurements, "required_by_protocol", "DOM_Boolean01")
assign_domain(flags, "severity", "DOM_FlagSeverity")
assign_domain(flags, "category", "DOM_FlagCategory")
assign_domain(flags, "resolved", "DOM_Boolean01")
assign_domain(audits, "actor_type", "DOM_ActorType")
assign_domain(audits, "previous_state", "DOM_WorkflowStatus")
assign_domain(audits, "new_state", "DOM_WorkflowStatus")

print("\nPHASE 6: creating relationships...")
ensure_relationship(
    "Sites_Events_Rel", sites, events,
    "Sampling events at this site", "Sampling site for this event", "site_guid"
)
ensure_relationship(
    "Events_Measurements_Rel", events, measurements,
    "Measurements for this event", "Sampling event for this measurement", "event_guid"
)
ensure_relationship(
    "Events_ValidationFlags_Rel", events, flags,
    "Validation flags for this event", "Sampling event for this validation flag", "event_guid"
)
ensure_relationship(
    "Events_AuditEvents_Rel", events, audits,
    "Audit history for this event", "Sampling event for this audit record", "event_guid"
)
ensure_relationship(
    "Measurements_ValidationFlags_Rel", measurements, flags,
    "Validation flags for this measurement", "Measurement for this validation flag", "measurement_guid"
)

print("\nPHASE 6: enabling SamplingEvents attachments...")
attach_table = os.path.join(gdb, "SamplingEvents__ATTACH")
if arcpy.Exists(attach_table):
    print("SamplingEvents attachments already enabled")
else:
    arcpy.management.EnableAttachments(events)
    print("Enabled SamplingEvents attachments")

print("\nPHASE 6: enabling UTC editor tracking...")
for dataset in core:
    ensure_editor_tracking(dataset)

aprx.save()

print("\nPHASE 6 CONFIGURATION COMPLETE")
print(f"Geodatabase: {gdb}")
print("GlobalIDs: SamplingSites, SamplingEvents, Measurements, ValidationFlags, AuditEvents")
print("GUID FKs: SamplingEvents.site_guid; Measurements.event_guid; ValidationFlags.event_guid/measurement_guid; AuditEvents.event_guid")
print("Relationships: Sites_Events_Rel, Events_Measurements_Rel, Events_ValidationFlags_Rel, Events_AuditEvents_Rel, Measurements_ValidationFlags_Rel")
print("Attachments: SamplingEvents")
print("Editor tracking: UTC on all five core datasets")
print("Save/reopen the project and verify before closing Phase 6.")
