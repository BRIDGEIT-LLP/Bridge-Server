-- Sector is now one shared multi-select field for every role, stored in user.primary_sector and used by
-- the matching engine. The role-specific sector columns are no longer collected at registration, so their
-- flags are relaxed (fieldMetadataService.validateUserPayload enforces is_required on build-profile).
-- Safe to re-run. Only is_required is touched.
--   STARTUP  - startup_industry_sector
--   INVESTOR - investor_sector_preference
--   B2B      - b2b_sector

UPDATE public.user_profile_field_master m
SET is_required = false,
    updated_at = now()
FROM public.company_role_master r
WHERE m.role_id = r.id
  AND m.source_table = 'user'
  AND (r.role_code, m.field_name) IN (
      ('STARTUP',  'startup_industry_sector'),
      ('INVESTOR', 'investor_sector_preference'),
      ('B2B',      'b2b_sector')
  );
