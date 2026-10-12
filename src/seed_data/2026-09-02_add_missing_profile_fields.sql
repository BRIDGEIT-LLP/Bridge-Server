-- Incremental seed for the profile columns added by
-- migrations/20260902000000_addMissingProfileFields.js.
--
-- `UserProfileFieldMaster.sql` is the full-install seed; running it again on an existing
-- database would duplicate every row. Run THIS file once instead, AFTER the migration.
-- The NOT EXISTS guard makes it safe to run twice.
--
-- Flag backfill for ALL existing rows (not just these new columns) lives in
-- `2026-09-03_set_registration_kyc_flags.sql`.

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, created_at)
SELECT r.role_id, v.source_table, v.field_name, v.display_name, v.is_editable, v.is_required, v.type,
       v.is_registration_field, v.is_kyc_field, now()
FROM (
    VALUES
        -- ── STARTUP ──
        ('STARTUP', 'user', 'founders', 'Founders & LinkedIn', false, true, 'array', true, false),

        -- ── INVESTOR ──
        ('INVESTOR', 'user', 'ticket_currency', 'Ticket Currency', true, false, 'string', true, false),
        ('INVESTOR', 'user', 'investment_thesis', 'Investment Thesis', true, false, 'string', true, false),
        ('INVESTOR', 'user', 'geographic_investment_preference_continent', 'Geographic Investment Preference (Continents)', true, false, 'array', true, false),
        ('INVESTOR', 'user', 'address', 'Registered Office / Residential Address', true, true, 'string', true, false),

        -- ── B2B ──
        ('B2B', 'user', 'business_type', 'Business Type', true, true, 'string', true, false),
        ('B2B', 'user', 'b2b_geography_country', 'Geographies (Countries)', true, true, 'array', true, false),
        ('B2B', 'user', 'b2b_geography_continent', 'Geographies (Continents)', true, false, 'array', true, false),
        ('B2B', 'user', 'address', 'Registered Office / Residential Address', true, true, 'string', true, false)
) AS v(role_code, source_table, field_name, display_name, is_editable, is_required, type, is_registration_field, is_kyc_field)
JOIN LATERAL (
    SELECT id AS role_id FROM public.company_role_master WHERE role_code = v.role_code
) r ON true
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.role_id AND m.field_name = v.field_name
);
