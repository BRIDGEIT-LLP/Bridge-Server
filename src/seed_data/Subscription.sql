INSERT INTO subscription_plan
    (plan_name, plan_code, plan_benefits, validity_days, is_active, created_at, created_by)
VALUES
(
    'Monthly Plan',
    'MONTHLY',
    ARRAY[
        'Access to all connection suggestions',
        'Up to 50 active connections per month',
        'Deal Room with document sharing & chat',
        'Email and in-app support'
    ],
    30,
    true,
    NOW(),
    (select id from "admin" a where email = 'admin@test.com')
),
(
    'Yearly Plan',
    'YEARLY',
    ARRAY[
        'Access to all connection suggestions',
        'Up to 50 active connections per month',
        'Deal Room with document sharing & chat',
        'Priority match suggestions',
        'Email and in-app support'
    ],
    365,
    true,
    NOW(),
   (select id from "admin" a where email = 'admin@test.com')
);