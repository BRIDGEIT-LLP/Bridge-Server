
INSERT INTO public.company_role_master
(role_name, role_code, role_description, created_by, created_at)
VALUES('Startup', 'STARTUP', 'Startup Role', (select id from "admin" a where a.email = 'admin@test.com'), now());

INSERT INTO public.company_role_master
(role_name, role_code, role_description, created_by, created_at)
VALUES('INVESTOR', 'INVESTOR', 'Investor Role', (select id from "admin" a where a.email = 'admin@test.com'), now());

INSERT INTO public.company_role_master
(role_name, role_code, role_description, created_by, created_at)
VALUES('B2B', 'B2B', 'B2B Role', (select id from "admin" a where a.email = 'admin@test.com'), now());