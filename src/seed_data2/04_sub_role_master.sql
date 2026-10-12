INSERT INTO public.sub_role_master (sub_role_name, sub_role_code, company_role_id, created_by, created_at, updated_at, is_deleted) VALUES
    ('User Admin', 'USER_ADMIN', (SELECT id FROM public.company_role_master WHERE role_code = 'STARTUP'), 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('User Admin', 'USER_ADMIN', (SELECT id FROM public.company_role_master WHERE role_code = 'INVESTOR'), 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('User Admin', 'USER_ADMIN', (SELECT id FROM public.company_role_master WHERE role_code = 'B2B'), 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE);
