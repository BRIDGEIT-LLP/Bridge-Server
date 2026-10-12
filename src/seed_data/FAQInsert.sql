INSERT INTO faq (question, answer, is_active, created_at)
VALUES
(
    'What is this platform and who is it for?',
    'This platform connects startups, investors, and B2B businesses, enabling them to discover relevant opportunities, build connections, and collaborate through a structured deal flow process.',
    true,
    NOW()
),
(
    'How do I complete my profile after registration?',
    'Once registered and verified, navigate to your dashboard and click "Complete Profile". Fill in your role-specific details such as funding stage, sector preferences, or business requirements depending on your role.',
    true,
    NOW()
),
(
    'How does the matching system work?',
    'Our matching engine analyses your profile, sector, funding stage, and preferences to suggest the most relevant connections. The more complete your profile, the better your match quality.',
    true,
    NOW()
),
(
    'How do I send or accept a connection request?',
    'Visit a profile you are interested in and click "Connect". The recipient will be notified and can accept, defer, or decline your request. Once accepted, a deal room is created for further communication.',
    true,
    NOW()
),
(
    'What documents are required for KYC verification?',
    'You will need to upload a valid government-issued photo ID such as Aadhaar or PAN card. KYC verification is typically reviewed within 24 hours. You will be notified once your account is verified.',
    true,
    NOW()
);