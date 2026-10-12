CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public."admin"
(id, "name", email, "password", "role", country_code, mobile_number, created_at)
VALUES(gen_random_uuid(), 'admin', 'admin@test.com', '$2b$10$wmcoo0vW/EJcFjq37y9WQ.Du0elbaIQnEq.YOaeX72MToGMQYE0Gu', 'ADMIN', '+91', '8612345678', now());
---- -- Admin@123456

INSERT INTO public."admin"
(id, "name", email, "password", "role", country_code, mobile_number, created_at)
VALUES(gen_random_uuid(), 'super_admin', 'super_admin@test.com', '$2b$10$wmcoo0vW/EJcFjq37y9WQ.Du0elbaIQnEq.YOaeX72MToGMQYE0Gu', 'SUPER_ADMIN', '+91', '8612345679', now());
---- -- Admin@123456