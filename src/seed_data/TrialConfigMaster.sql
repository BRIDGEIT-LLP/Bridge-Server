
INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('free_trial_day', '7', '7', 'integer', 'day', 'Number of free trial days granted to a new user', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('free_trial_connection_limit', '3', '3', 'integer', 'number', 'Connection requests allowed per billing window on the free tier', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('premium_connection_limit', '50', '50', 'integer', 'number', 'Connection requests allowed per billing window with an active subscription', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('manual_extension', 'true', 'true', 'boolean', 'flag', 'Manual Extension - allows support to extend active trials', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('auto_downgrade', 'true', 'true', 'boolean', 'flag', 'Auto Downgrade - move to free tier on expiry', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('expiry_notification', 'true', 'true', 'boolean', 'flag', 'Expiry Notifications - email alerts 48h before end', (select id from "admin" a where a.email = 'super_admin@test.com'), now());

INSERT INTO public.trial_config_master
(lookup, value, default_value, data_type, unit, description, created_by, created_at)
VALUES('aws_service_enabled', 'true', 'true', 'boolean', 'flag', 'AWS Service Enabled - indicates if AWS services are enabled', (select id from "admin" a where a.email = 'super_admin@test.com'), now());
