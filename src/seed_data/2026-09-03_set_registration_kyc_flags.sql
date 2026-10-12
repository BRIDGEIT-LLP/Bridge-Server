-- Backfill is_registration_field / is_kyc_field on user_profile_field_master.
-- Fresh installs get these from UserProfileFieldMaster.sql INSERT.
-- Safe to re-run. Matches role + source_table + field_name so user/company
-- duplicates (company_email, mobile_number, country_code) update the right row.
--
-- KYC (is_kyc_field = true):
--   STARTUP  — incorporation_certificate
--   B2B      — gst_number, cin_number
--   INVESTOR — none here (PAN/Aadhaar are kyc_info only)

UPDATE public.user_profile_field_master m
SET is_registration_field = v.is_reg,
    is_kyc_field = v.is_kyc,
    updated_at = now()
FROM (
    VALUES
        -- STARTUP company
        ('STARTUP',  'company', 'company_name',                                    true,  false),
        ('STARTUP',  'company', 'company_email',                                   true,  false),
        ('STARTUP',  'company', 'mobile_number',                                   true,  false),
        ('STARTUP',  'company', 'country_code',                                    true,  false),
        -- STARTUP user
        ('STARTUP',  'user',    'first_name',                                      true,  false),
        ('STARTUP',  'user',    'last_name',                                       true,  false),
        ('STARTUP',  'user',    'profile_photo',                                   true,  false),
        ('STARTUP',  'user',    'organization_name',                               true,  false),
        ('STARTUP',  'user',    'short_bio',                                       true,  false),
        ('STARTUP',  'user',    'country',                                         true,  false),
        ('STARTUP',  'user',    'continent',                                       true,  false),
        ('STARTUP',  'user',    'primary_sector',                                  true,  false),
        ('STARTUP',  'user',    'linkedin_profile_url',                            true,  false),
        ('STARTUP',  'user',    'company_website_url',                             true,  false),
        ('STARTUP',  'user',    'company_email',                                   true,  false),
        ('STARTUP',  'user',    'country_code',                                    true,  false),
        ('STARTUP',  'user',    'mobile_number',                                   true,  false),
        ('STARTUP',  'user',    'startup_industry_sector',                         true,  false),
        ('STARTUP',  'user',    'funding_stage',                                   true,  false),
        ('STARTUP',  'user',    'funding_currency',                                true,  false),
        ('STARTUP',  'user',    'funding_ask_amt_min',                             true,  false),
        ('STARTUP',  'user',    'funding_ask_amt_max',                             true,  false),
        ('STARTUP',  'user',    'use_of_funds',                                    true,  false),
        ('STARTUP',  'user',    'team_size_min',                                   true,  false),
        ('STARTUP',  'user',    'team_size_max',                                   true,  false),
        ('STARTUP',  'user',    'incorporation_certificate',                       true,  true),
        ('STARTUP',  'user',    'pitch_deck_certificate',                          true,  false),
        ('STARTUP',  'user',    'business_description',                            true,  false),
        ('STARTUP',  'user',    'startup_intent',                                  true,  false),
        ('STARTUP',  'user',    'founders',                                        true,  false),
        -- INVESTOR company
        ('INVESTOR', 'company', 'company_name',                                    true,  false),
        ('INVESTOR', 'company', 'company_email',                                   true,  false),
        ('INVESTOR', 'company', 'mobile_number',                                   true,  false),
        ('INVESTOR', 'company', 'country_code',                                    true,  false),
        -- INVESTOR user
        ('INVESTOR', 'user',    'first_name',                                      true,  false),
        ('INVESTOR', 'user',    'last_name',                                       true,  false),
        ('INVESTOR', 'user',    'profile_photo',                                   true,  false),
        ('INVESTOR', 'user',    'organization_name',                               true,  false),
        ('INVESTOR', 'user',    'short_bio',                                       true,  false),
        ('INVESTOR', 'user',    'country',                                         true,  false),
        ('INVESTOR', 'user',    'continent',                                       true,  false),
        ('INVESTOR', 'user',    'primary_sector',                                  true,  false),
        ('INVESTOR', 'user',    'linkedin_profile_url',                            true,  false),
        ('INVESTOR', 'user',    'company_website_url',                             true,  false),
        ('INVESTOR', 'user',    'company_email',                                   true,  false),
        ('INVESTOR', 'user',    'country_code',                                    true,  false),
        ('INVESTOR', 'user',    'mobile_number',                                   true,  false),
        ('INVESTOR', 'user',    'ticket_currency',                                 true,  false),
        ('INVESTOR', 'user',    'ticket_size_amt_min',                             true,  false),
        ('INVESTOR', 'user',    'ticket_size_amt_max',                             true,  false),
        ('INVESTOR', 'user',    'investment_thesis',                               true,  false),
        ('INVESTOR', 'user',    'address',                                         true,  false),
        ('INVESTOR', 'user',    'prefrerred_investment_stage',                     true,  false),
        ('INVESTOR', 'user',    'stage_focus',                                     true,  false),
        ('INVESTOR', 'user',    'investor_sector_preference',                      true,  false),
        ('INVESTOR', 'user',    'geographic_investment_preference',                true,  false),
        ('INVESTOR', 'user',    'geographic_investment_preference_continent',      true,  false),
        ('INVESTOR', 'user',    'investor_type',                                   true,  false),
        ('INVESTOR', 'user',    'investor_portfolio_overview',                     true,  false),
        ('INVESTOR', 'user',    'number_of_investments_to_date',                   true,  false),
        ('INVESTOR', 'user',    'investor_intent',                                 true,  false),
        -- B2B company
        ('B2B',      'company', 'company_name',                                    true,  false),
        ('B2B',      'company', 'company_email',                                   true,  false),
        ('B2B',      'company', 'gst_number',                                      true,  true),
        ('B2B',      'company', 'cin_number',                                      true,  true),
        ('B2B',      'company', 'mobile_number',                                   true,  false),
        ('B2B',      'company', 'country_code',                                    true,  false),
        -- B2B user
        ('B2B',      'user',    'first_name',                                      true,  false),
        ('B2B',      'user',    'last_name',                                       true,  false),
        ('B2B',      'user',    'profile_photo',                                   true,  false),
        ('B2B',      'user',    'organization_name',                               true,  false),
        ('B2B',      'user',    'short_bio',                                       true,  false),
        ('B2B',      'user',    'country',                                         true,  false),
        ('B2B',      'user',    'continent',                                       true,  false),
        ('B2B',      'user',    'primary_sector',                                  true,  false),
        ('B2B',      'user',    'linkedin_profile_url',                            true,  false),
        ('B2B',      'user',    'company_website_url',                             true,  false),
        ('B2B',      'user',    'company_email',                                   true,  false),
        ('B2B',      'user',    'country_code',                                    true,  false),
        ('B2B',      'user',    'mobile_number',                                   true,  false),
        ('B2B',      'user',    'b2b_sector',                                      true,  false),
        ('B2B',      'user',    'b2b_sub_sector',                                  true,  false),
        ('B2B',      'user',    'business_type',                                   true,  false),
        ('B2B',      'user',    'b2b_geography_country',                           true,  false),
        ('B2B',      'user',    'b2b_geography_continent',                         true,  false),
        ('B2B',      'user',    'address',                                         true,  false),
        ('B2B',      'user',    'revenue_band',                                    true,  false),
        ('B2B',      'user',    'min_order_quantity',                              true,  false),
        ('B2B',      'user',    'export_rediness',                                 true,  false),
        ('B2B',      'user',    'industry_vertical',                               true,  false),
        ('B2B',      'user',    'years_in_operation',                              true,  false),
        ('B2B',      'user',    'operational_capacity_description',                true,  false),
        ('B2B',      'user',    'products_ervice_Offered',                         true,  false),
        ('B2B',      'user',    'business_requirements',                           true,  false),
        ('B2B',      'user',    'b2b_intent',                                      true,  false)
) AS v(role_code, source_table, field_name, is_reg, is_kyc)
JOIN public.company_role_master crm ON crm.role_code = v.role_code
WHERE m.role_id = crm.id
  AND m.source_table = v.source_table
  AND m.field_name = v.field_name
  AND m.is_deleted = false;
