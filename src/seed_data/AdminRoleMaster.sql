
INSERT INTO public.admin_role_master
(role_name, role_code, role_description, created_by, created_at)
VALUES('Admin', 'ADMIN', 'Full platform administrator', (select id from "admin" a where a.email = 'admin@test.com'), now());

INSERT INTO public.admin_role_master
(role_name, role_code, role_description, created_by, created_at)
VALUES('Super Admin', 'SUPER_ADMIN', 'Highest-privilege platform administrator', (select id from "admin" a where a.email = 'admin@test.com'), now());
