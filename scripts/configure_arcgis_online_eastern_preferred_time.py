"""Configure the ArcGIS Online QC staging service to prefer Eastern Time for clients.

ArcGIS Online hosted feature layers always store Date values internally in UTC.
This script does NOT try to change that storage behavior. Instead, it sets the
hosted feature service's preferredTimeReference to Eastern Time so supported
clients work with/display dates in the project-standard Eastern Time zone.

Run inside ArcGIS Pro's Python window while signed in as the hosted item owner.
"""

from arcgis.gis import GIS
from arcgis.features import FeatureLayerCollection

ITEM_ID = "b7775c1bdada4aa8b0787714eca3eb15"
PREFERRED = {
    "timeZone": "Eastern Standard Time",
    "respectsDaylightSaving": True,
}

print("=== PHASE 7: CONFIGURE HOSTED PREFERRED EASTERN TIME ===")

gis = GIS("pro")
item = gis.content.get(ITEM_ID)
if item is None:
    raise RuntimeError(f"Could not access ArcGIS Online item {ITEM_ID}.")

print(f"Item: {item.title}")
print(f"Owner: {item.owner}")

flc = FeatureLayerCollection.fromitem(item)
result = flc.manager.update_definition({"preferredTimeReference": PREFERRED})
print(f"updateDefinition result: {result}")

if not result or not result.get("success", False):
    raise RuntimeError(f"Could not set preferredTimeReference: {result}")

# Refresh and verify at service level.
flc = FeatureLayerCollection.fromitem(item)
props = flc.properties
preferred = getattr(props, "preferredTimeReference", None)

print(f"Service preferredTimeReference: {preferred}")

# Also print the effective layer/table properties. ArcGIS Online may continue to
# expose dateFieldsTimeReference=UTC because hosted Date storage is UTC by design.
for part in list(item.layers) + list(item.tables):
    p = part.properties
    name = getattr(p, "name", str(getattr(p, "id", "unknown")))
    storage_ref = getattr(p, "dateFieldsTimeReference", None)
    preferred_ref = getattr(p, "preferredTimeReference", None)
    print(f"{name}: storage={storage_ref}; preferred={preferred_ref}")

print()
print("DONE")
print("Expected behavior:")
print("- dateFieldsTimeReference may remain UTC (ArcGIS Online hosted storage).")
print("- preferredTimeReference should be Eastern Standard Time with DST enabled.")
