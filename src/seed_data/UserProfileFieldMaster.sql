INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type, is_registration_field, is_kyc_field, created_at)
VALUES
((select id from company_role_master where role_code = 'STARTUP'), 'company', 'company_name', 'Company Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'company', 'company_email', 'Company Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'company', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'company', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'first_name', 'First Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'last_name', 'Last Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'profile_photo', 'Profile Photo', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'organization_name', 'Organization Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'short_bio', 'Short Bio', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'intro_video', 'Intro Video', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'country', 'Country', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'continent', 'Continent', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'state', 'State', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'city', 'City', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'primary_sector', 'Primary Sector', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'linkedin_profile_url', 'Linkedin Profile URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'company_website_url', 'Company Website URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'company_email', 'Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'startup_industry_sector', 'Startup Industry Sector', true, false, 'array', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'funding_stage', 'Funding Stage', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'funding_currency', 'Funding Currency', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'funding_ask_amt_min', 'Funding Ask Amount Min', true, true, 'number', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'funding_ask_amt_max', 'Funding Ask Amount Max', true, true, 'number', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'use_of_funds', 'Use of Funds', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'team_size_min', 'Team Size Min', true, false, 'number', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'team_size_max', 'Team Size Max', true, false, 'number', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'incorporation_certificate', 'Incorporation Certificate', true, true, 'string', true, true, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'pitch_deck_certificate', 'Pitch Deck Certificate', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'business_description', 'Business Description', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'startup_intent', 'Startup Intent', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'STARTUP'), 'user', 'founders', 'Founders & LinkedIn', false, true, 'array', true, false, now());

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type, is_registration_field, is_kyc_field, created_at)
VALUES
((select id from company_role_master where role_code = 'INVESTOR'), 'company', 'company_name', 'Company Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'company', 'company_email', 'Company Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'company', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'company', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'first_name', 'First Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'last_name', 'Last Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'profile_photo', 'Profile Photo', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'organization_name', 'Organization Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'short_bio', 'Short Bio', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'intro_video', 'Intro Video', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'country', 'Country', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'continent', 'Continent', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'state', 'State', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'city', 'City', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'primary_sector', 'Primary Sector', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'linkedin_profile_url', 'Linkedin Profile URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'company_website_url', 'Company Website URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'company_email', 'Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'ticket_currency', 'Ticket Currency', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'ticket_size_amt_min', 'Ticket Size Amt Min', true, true, 'number', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'ticket_size_amt_max', 'Ticket Size Amt Max', true, true, 'number', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'investment_thesis', 'Investment Thesis', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'address', 'Registered Office / Residential Address', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'prefrerred_investment_stage', 'Preferred Investment Stage', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'stage_focus', 'Stage Focus', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'investor_sector_preference', 'Investor Sector Preference', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'geographic_investment_preference', 'Geographic Investment Preference', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'geographic_investment_preference_continent', 'Geographic Investment Preference (Continents)', true, false, 'array', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'investor_type', 'Investor Type', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'investor_portfolio_overview', 'Investor Portfolio Overview', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'number_of_investments_to_date', 'Number of Investments to Date', true, false, 'number', true, false, now()),
((select id from company_role_master where role_code = 'INVESTOR'), 'user', 'investor_intent', 'Investor Intent', true, true, 'string', true, false, now());

INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type, is_registration_field, is_kyc_field, created_at)
VALUES
((select id from company_role_master where role_code = 'B2B'), 'company', 'company_name', 'Company Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'company', 'company_email', 'Company Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'company', 'gst_number', 'GST Number', false, true, 'string', true, true, now()),
((select id from company_role_master where role_code = 'B2B'), 'company', 'cin_number', 'CIN Number', false, true, 'string', true, true, now()),
((select id from company_role_master where role_code = 'B2B'), 'company', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'company', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'first_name', 'First Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'last_name', 'Last Name', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'profile_photo', 'Profile Photo', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'organization_name', 'Organization Name', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'short_bio', 'Short Bio', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'intro_video', 'Intro Video', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'country', 'Country', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'continent', 'Continent', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'state', 'State', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'city', 'City', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'primary_sector', 'Primary Sector', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'linkedin_profile_url', 'Linkedin Profile URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'company_website_url', 'Company Website URL', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'company_email', 'Email', false, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'country_code', 'Country Code', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'mobile_number', 'Mobile Number', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'b2b_sector', 'B2B Sector', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'b2b_sub_sector', 'B2B Sub Sector', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'business_type', 'Business Type', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'b2b_geography_country', 'Geographies (Countries)', true, true, 'array', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'b2b_geography_continent', 'Geographies (Continents)', true, false, 'array', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'address', 'Registered Office / Residential Address', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'revenue_band', 'Revenue Band', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'min_order_quantity', 'Min Order Quantity', true, null, 'number', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'export_rediness', 'Export Readiness', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'industry_vertical', 'Industry Vertical', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'years_in_operation', 'Years in Operation', true, true, 'number', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'operational_capacity_description', 'Operational Capacity Description', true, false, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'products_ervice_Offered', 'Products/Service Offered', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'business_requirements', 'Business Requirements', true, true, 'string', true, false, now()),
((select id from company_role_master where role_code = 'B2B'), 'user', 'b2b_intent', 'B2B Intent', true, true, 'string', true, false, now());


-- ---------------------------------------------------------------------------------------------------------------
-- Registration fields added with the new member-application UI. They are also available as incremental scripts
-- (2026-11-06_add_state_city_fields.sql, 2026-11-06_add_intent_note_field.sql,
-- 2026-11-12_add_startup_raise_details_fields.sql). Every insert is guarded by NOT EXISTS, so this whole file stays
-- safe to re-run. user_profile_field_master is what lets build-profile write these `user` columns, so a field
-- without a row here is silently dropped.
-- ---------------------------------------------------------------------------------------------------------------

-- State / city (optional, all roles)
INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, created_at)
SELECT r.id, 'user', v.field_name, v.display_name, true, false, 'string', true, false, now()
FROM public.company_role_master r
CROSS JOIN (VALUES ('state', 'State'), ('city', 'City')) AS v(field_name, display_name)
WHERE r.role_code IN ('STARTUP', 'INVESTOR', 'B2B')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = v.field_name
);

-- "Anything specific?" note next to the intent (optional, all roles, max 300 characters)
INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, max_length, created_at)
SELECT r.id, 'user', 'intent_note', 'Intent details', true, false, 'string', true, false, 300, now()
FROM public.company_role_master r
WHERE r.role_code IN ('STARTUP', 'INVESTOR', 'B2B')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = 'intent_note'
);

-- Founder "Your raise" details (optional, STARTUP only)
INSERT INTO public.user_profile_field_master
    (role_id, source_table, field_name, display_name, is_editable, is_required, type,
     is_registration_field, is_kyc_field, max_length, min_value, max_value, created_at)
SELECT r.id, 'user', v.field_name, v.display_name, true, false, v.type,
       true, false, v.max_length, v.min_value, v.max_value, now()
FROM public.company_role_master r
CROSS JOIN (VALUES
    ('year_of_incorporation', 'Year of incorporation', 'integer', NULL::int, 1900, 2100),
    ('funds_raised',          'Funding raised so far', 'string',  200,       NULL::int, NULL::int),
    ('co_founders',           'Co-founders',           'string',  300,       NULL::int, NULL::int)
) AS v(field_name, display_name, type, max_length, min_value, max_value)
WHERE r.role_code = 'STARTUP'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profile_field_master m
    WHERE m.role_id = r.id AND m.source_table = 'user' AND m.field_name = v.field_name
);
