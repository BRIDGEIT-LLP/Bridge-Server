-- STARTUP Industry Sector is no longer asked in registration (the About you Sectors chips cover it).
-- Fresh installs get this from UserProfileFieldMaster.sql; run this once on existing databases.
UPDATE public.user_profile_field_master m
SET is_required = false,
    updated_at = now()
FROM public.company_role_master crm
WHERE m.role_id = crm.id
  AND crm.role_code = 'STARTUP'
  AND m.source_table = 'user'
  AND m.field_name = 'startup_industry_sector'
  AND m.is_deleted = false;
