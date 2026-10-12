INSERT INTO subscription_plan (name, plan_code, description, price_monthly, price_yearly, currency, duration_days, applicable_roles, features, is_active, 
 is_deleted, created_at, updated_at)
VALUES
(
    'Premium', 'PREMIUM', 'Premium access with higher connection request limits and full platform features.', 9999.00, 99999.00, 'INR', 30, '["STARTUP", "INVESTOR", "B2B"]',
    '{"max_connections": 50}', true, false, NOW(), NOW()
);