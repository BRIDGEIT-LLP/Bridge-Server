INSERT INTO public.trial_config_master (lookup, value, default_value, data_type, unit, description, created_by, created_at, updated_at, is_deleted) VALUES
    ('free_trial_day', '7', '7', 'integer', 'day', 'Number of free trial days granted to a new user', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('free_trial_connection_limit', '3', '3', 'integer', 'number', 'Connection requests allowed per billing window on the free tier', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('premium_connection_limit', '50', '50', 'integer', 'number', 'Connection requests allowed per billing window with an active subscription', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('manual_extension', 'true', 'true', 'boolean', 'flag', 'Allows support to extend active trials', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('auto_downgrade', 'true', 'true', 'boolean', 'flag', 'Move to free tier on expiry', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('expiry_notification', 'true', 'true', 'boolean', 'flag', 'Email alerts 48h before trial end', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE);
