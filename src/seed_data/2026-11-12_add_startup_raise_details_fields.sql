-- Incremental seed for the Founder "Your raise" details: year of incorporation, funding raised so far and co-founders
-- (migrations/20261112100000_add_startup_raise_details_to_user.js). Run ONCE after the migration.
-- Safe to run twice: every insert is guarded by NOT EXISTS.
-- Optional (is_required = false), editable registration fields, not KYC, for STARTUP only.
-- user_profile_field_master is also what lets build-profile write the columns, so these rows are required.

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, max_length, min_value, max_value, created_at)
SELECT r.id, 'user', v.field_name, v.display_name, true, false, v.type,
       true, false, v.max_length, v.min_value, v.max_value, now()
FROM public.company_role_master r
CROSS JOIN (VALUES
    ('year_of_incorporation', 'Year of incorporation', 'integer', NULL::int, 1900, 2100),
    ('funds_raised',          'Funding raised so far', 'string',  200,       NULL::int, NULL::int),
    ('co_founders',           'Co-founders',           'string',  300,       NULL::int, NULL::int)
) AS v(field_name, display_name, type, max_length, min_value, max_value)
WHERE r.role_code = 'STARTUP'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = v.field_name
);
