-- Incremental seed for the optional intro-video profile field
-- (migrations/20261005100000_add_intro_video_to_user.js). Run ONCE after the migration.
-- Safe to run twice: every insert is guarded by NOT EXISTS.
--
-- 1. user_profile_field_master: drives build-profile validation, the self-service
--    write allowlist, and GET /users/profile for STARTUP, INVESTOR and B2B.
--    Optional (is_required = false), registration field, not KYC.
-- 2. permission_master / role_permission_map: FILE.SCAN_VIDEO and FILE.VIDEO_URL for USER.

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, created_at)
SELECT r.id, 'user', 'intro_video', 'Intro Video', true, false, 'string', true, false, now()
FROM public.company_role_master r
WHERE r.role_code IN ('STARTUP', 'INVESTOR', 'B2B')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = 'intro_video'
);

INSERT INTO public.permission_master (permission_key, description, created_by, created_at)
SELECT v.permission_key, v.description, (SELECT id FROM "admin" a WHERE a.email = 'admin@test.com'), now()
FROM (VALUES
    ('FILE.SCAN_VIDEO', 'Scan and upload an intro video'),
    ('FILE.VIDEO_URL', 'Get a signed URL to view an intro video')
) AS v(permission_key, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permission_master p WHERE p.permission_key = v.permission_key
);

INSERT INTO public.role_permission_map
    (user_type, permission_id, created_at, created_by, is_deleted)
SELECT 'USER', p.id, now(), (SELECT id FROM "admin" a WHERE a.email = 'admin@test.com'), false
FROM public.permission_master p
WHERE p.permission_key IN ('FILE.SCAN_VIDEO', 'FILE.VIDEO_URL')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permission_map m
    WHERE m.user_type = 'USER' AND m.permission_id = p.id
);
