-- The registration "Your profile" step now treats everything in its collapsible "more details (optional,
-- from the previous form)" block as optional. fieldMetadataService.validateUserPayload enforces
-- user_profile_field_master.is_required on POST /users/build-profile, so the flags for those fields have to
-- be relaxed too, otherwise a user who skips the block gets "<field> is required" at the Intent step.
--
-- Safe to re-run. Only is_required is touched.
--   STARTUP  - founders, incorporation_certificate, pitch_deck_certificate
--              (the two documents are uploaded on the Documents step)
--   INVESTOR - address, investor_sector_preference
--   B2B      - address, industry_vertical
--
-- Not relaxed because the new UI still collects them in the main section (or derives them):
--   funding_ask_amt_min/max, ticket_size_amt_min/max (derived from the "Raising" / cheque range in Rs Cr),
--   b2b_sector, b2b_sub_sector, country (defaults to India).

UPDATE public.user_profile_field_master m
SET is_required = false,
    updated_at = now()
FROM public.company_role_master r
WHERE m.role_id = r.id
  AND m.source_table = 'user'
  AND (r.role_code, m.field_name) IN (
      ('STARTUP',  'founders'),
      ('STARTUP',  'incorporation_certificate'),
      ('STARTUP',  'pitch_deck_certificate'),
      ('INVESTOR', 'address'),
      ('INVESTOR', 'investor_sector_preference'),
      ('B2B',      'address'),
      ('B2B',      'industry_vertical')
  );

-- Incorporation certificate and pitch deck are KYC documents now (kyc_info rows, uploaded on the Documents
-- step), no longer profile fields collected at registration.
UPDATE public.user_profile_field_master m
SET is_registration_field = false,
    updated_at = now()
FROM public.company_role_master r
WHERE m.role_id = r.id
  AND m.source_table = 'user'
  AND r.role_code = 'STARTUP'
  AND m.field_name IN ('incorporation_certificate', 'pitch_deck_certificate');
