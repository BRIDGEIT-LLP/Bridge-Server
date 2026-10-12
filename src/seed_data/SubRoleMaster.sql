INSERT INTO public.sub_role_master
(sub_role_name, sub_role_code, company_role_id, created_by, created_at)
VALUES('User Admin', 'USER_ADMIN', (select id from company_role_master crm where crm.role_code = 'INVESTOR'), (select id from "admin" a where a.email = 'admin@test.com'), now());
INSERT INTO public.sub_role_master
(sub_role_name, sub_role_code, company_role_id, created_by, created_at)
VALUES('User Admin', 'USER_ADMIN', (select id from company_role_master crm where crm.role_code = 'STARTUP'), (select id from "admin" a where a.email = 'admin@test.com'), now());
INSERT INTO public.sub_role_master
(sub_role_name, sub_role_code, company_role_id, created_by, created_at)
VALUES('User Admin', 'USER_ADMIN', (select id from company_role_master crm where crm.role_code = 'B2B'), (select id from "admin" a where a.email = 'admin@test.com'), now());