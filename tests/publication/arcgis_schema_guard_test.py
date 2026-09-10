import unittest

from publication.arcgis_schema_guard import validate_public_dataset


DATASET = {
    "name": "ApprovedObservations",
    "fields": [
        {"name": "public_observation_id", "type": "esriFieldTypeString", "public": True},
        {"name": "site_id", "type": "esriFieldTypeString", "public": True},
        {"name": "collector_user_id", "type": "esriFieldTypeString", "public": False},
    ],
}


def safe_service(**overrides):
    return {"capabilities": "Query", "isView": True, "syncEnabled": False, **overrides}


def safe_dataset(**overrides):
    return {
        "capabilities": "Query",
        "hasAttachments": False,
        "fields": [
            {"name": "OBJECTID", "type": "esriFieldTypeOID"},
            {"name": "public_observation_id", "type": "esriFieldTypeString"},
            {"name": "site_id", "type": "esriFieldTypeString"},
        ],
        **overrides,
    }


class PublicViewGuardTests(unittest.TestCase):
    def test_exact_public_contract_passes(self):
        self.assertEqual(
            validate_public_dataset(DATASET, service_properties=safe_service(), dataset_properties=safe_dataset()),
            [],
        )

    def test_private_or_extra_field_fails_closed(self):
        props = safe_dataset(fields=[*safe_dataset()["fields"], {"name": "collector_user_id", "type": "esriFieldTypeString"}])
        failures = validate_public_dataset(DATASET, service_properties=safe_service(), dataset_properties=props)
        self.assertTrue(any("unexpected fields" in failure for failure in failures))

    def test_wrong_field_type_fails_closed(self):
        fields = safe_dataset()["fields"]
        fields[1] = {"name": "public_observation_id", "type": "esriFieldTypeInteger"}
        failures = validate_public_dataset(DATASET, service_properties=safe_service(), dataset_properties=safe_dataset(fields=fields))
        self.assertTrue(any("expected 'esriFieldTypeString'" in failure for failure in failures))

    def test_editing_attachments_and_sync_fail_closed(self):
        failures = validate_public_dataset(
            DATASET,
            service_properties=safe_service(capabilities="Query,Update", syncEnabled=True),
            dataset_properties=safe_dataset(capabilities="Query,Create", hasAttachments=True),
        )
        joined = " | ".join(failures)
        self.assertIn("Update", joined)
        self.assertIn("Create", joined)
        self.assertIn("attachments", joined)
        self.assertIn("sync enabled", joined)


if __name__ == "__main__":
    unittest.main()
