INSERT INTO public.otp_config_master (lookup, value, default_value, data_type, unit, description, created_by, created_at, updated_at, is_deleted) VALUES
    ('SENT_OTP_TTL', '180', '180', 'integer', 'second', 'OTP validity duration after being sent', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('RESEND_COOLDOWN_TTL', '60', '60', 'integer', 'second', 'Cooldown before an OTP can be resent', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('MAX_OTP_VERIFY_ATTEMPTS', '3', '3', 'integer', 'number', 'Maximum allowed OTP verification attempts', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('MAX_OTP_RESEND_COUNT_IN_HR', '10', '10', 'integer', 'number', 'Maximum OTP resends allowed per hour', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('OTP_RESEND_COUNT_TTL_IN_HR', '3600', '3600', 'integer', 'second', 'Window for counting OTP resends', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE),
    ('OTP_BLOCK_TTL', '3600', '3600', 'integer', 'second', 'Block duration after exceeding max attempts', 'd617302e-60a1-414c-8275-95a1cd1b9e7e', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE);
