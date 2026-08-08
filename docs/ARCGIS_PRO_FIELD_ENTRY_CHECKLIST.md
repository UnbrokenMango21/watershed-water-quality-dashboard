# ArcGIS Pro Field Entry Checklist

Use this while creating the Phase 5 prototype in ArcGIS Pro.

## SamplingSites
Point, WGS 1984
- site_id Text 36
- site_code Text 32
- site_name_internal Text 160
- site_name_public Text 160
- landowner_name Text 160
- landowner_notes Text 1000
- watershed_name Text 120
- site_status Text 20
- latitude Double
- longitude Double
- access_notes_internal Text 1000
- site_description Text 2000
- created_at Date
- updated_at Date
- schema_version Text 20

## SamplingEvents
Point, WGS 1984
- event_id Text 36
- submission_id Text 36
- site_id Text 36
- collector_user_id Text 128
- data_collected_by Text 80
- test_type Text 80
- test_type_other Text 200
- method_name Text 160
- instrument_name Text 160
- collected_at Date
- submitted_at Date
- time_known Short Integer
- time_imputed Short Integer
- latitude Double
- longitude Double
- gps_accuracy_m Double
- site_distance_m Double
- weather_condition Text 30
- temp_entered_value Double
- temp_entered_unit Text 4
- temp_f Double
- temp_c Double
- field_notes_original Text 4000
- workflow_status Text 30
- validation_outcome Text 30
- completeness_score Double
- location_quality_score Double
- method_quality_score Double
- validation_quality_score Double
- temporal_quality_score Double
- historical_quality_score Double
- overall_quality_score Double
- anomaly_score Double
- error_flag_count Long Integer
- warning_flag_count Long Integer
- info_flag_count Long Integer
- review_decision Text 30
- reviewer_user_id Text 128
- review_comment Text 4000
- reviewed_at Date
- published_at Date
- schema_version Text 20
- validation_rules_version Text 20
- quality_algorithm_version Text 20
- mobile_app_version Text 30
- publish_attempt_count Long Integer
- last_publish_error_code Text 120

## Measurements
Table
- measurement_id Text 36
- event_id Text 36
- parameter_code Text 40
- display_name Text 80
- value_original Double
- value_current Double
- unit_code Text 24
- measurement_method Text 160
- instrument_id Text 120
- required_by_protocol Short Integer
- measurement_notes Text 1000
- schema_version Text 20

## ValidationFlags
Table
- flag_id Text 36
- event_id Text 36
- measurement_id Text 36
- rule_id Text 80
- rule_version Text 20
- severity Text 24
- category Text 40
- message Text 1000
- observed_value Text 200
- created_at Date
- resolved Short Integer
- resolution_note Text 1000

## AuditEvents
Table
- audit_event_id Text 36
- submission_id Text 36
- event_id Text 36
- event_type Text 50
- actor_type Text 20
- actor_user_id Text 128
- occurred_at Date
- previous_state Text 30
- new_state Text 30
- field_path Text 200
- old_value Text 1000
- new_value Text 1000
- reason Text 2000
- schema_version Text 20
