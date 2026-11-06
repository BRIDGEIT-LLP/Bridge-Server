-- Incremental seed for the optional "Anything specific?" note next to the intent
-- (migrations/20261106120000_add_intent_note_to_user.js). Run ONCE after the migration.
-- Safe to run twice: guarded by NOT EXISTS.
-- Optional (is_required = false), editable registration field, not KYC, max 300 characters, for STARTUP, INVESTOR and B2B.
-- user_profile_field_master is also what lets build-profile write the column, so this row is required.

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, max_length, created_at)
SELECT r.id, 'user', 'intent_note', 'Intent details', true, false, 'string', true, false, 300, now()
FROM public.company_role_master r
WHERE r.role_code IN ('STARTUP', 'INVESTOR', 'B2B')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = 'intent_note'
);
