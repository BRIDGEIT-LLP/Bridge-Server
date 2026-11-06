-- Incremental seed for the optional state / city profile fields
-- (migrations/20261106100000_add_state_city_to_user.js). Run ONCE after the migration.
-- Safe to run twice: every insert is guarded by NOT EXISTS.
-- Optional (is_required = false), registration field, not KYC, for STARTUP, INVESTOR and B2B.

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, created_at)
SELECT r.id, 'user', v.field_name, v.display_name, true, false, 'string', true, false, now()
FROM public.company_role_master r
CROSS JOIN (VALUES ('state', 'State'), ('city', 'City')) AS v(field_name, display_name)
WHERE r.role_code IN ('STARTUP', 'INVESTOR', 'B2B')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = v.field_name
);
