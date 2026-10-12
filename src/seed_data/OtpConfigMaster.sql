
INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('SENT_OTP_TTL', '180', '180', 'integer', 'second', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('RESEND_COOLDOWN_TTL', '60', '60', 'integer', 'second', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('MAX_OTP_VERIFY_ATTEMPTS', '3', '3', 'integer', 'number', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('MAX_OTP_RESEND_COUNT_IN_HR', '10', '10', 'integer', 'number', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('OTP_RESEND_COUNT_TTL_IN_HR', '3600', '3600', 'integer', 'second', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.otp_config_master
(lookup, value, default_value, data_type, unit, created_by, created_at)
VALUES('OTP_BLOCK_TTL', '3600', '3600', 'integer', 'second', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

 