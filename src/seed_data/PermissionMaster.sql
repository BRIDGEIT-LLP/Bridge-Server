-- Permission catalog. permission_key values must stay in sync with
-- src/utils/constant.js PERMISSIONS. Modules prefixed with ADMIN_ are
-- granted to ROLES.ADMIN codes in RolePermissionMap.sql; every other
-- module is granted to ROLES.USER codes.

INSERT INTO public.permission_master (permission_key, description, created_by, created_at) VALUES
('AUTH.VERIFY_OTP', 'Verify OTP for email or phone channel', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('AUTH.RESEND_OTP', 'Resend OTP for email or phone channel', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('AUTH.MFA_TRIGGER_OTP', 'Trigger MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('AUTH.MFA_VERIFY_OTP', 'Verify MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('AUTH.MFA_RESEND_OTP', 'Resend MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('AUTH.SWITCH_ROLE', 'Switch active role within the current company', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('USER.BUILD_PROFILE', 'Create user profile', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('USER.VIEW_PROFILE', 'View own user profile', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('USER.UPDATE_PROFILE', 'Update own user profile', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('USER.SEARCH', 'Search user profiles', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('USER.VIEW_ROLE_DETAILS', 'View role-specific details for a user', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('FILE.SCAN_IMAGE', 'Scan and upload an image', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.SCAN_DOCUMENT', 'Scan and upload a document', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.SAVE_KYC_INFO', 'Save KYC document info', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.PREVIEW', 'Preview a stored file', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.GET_KYC_DOCS', 'Fetch own KYC documents', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.SCAN_VIDEO', 'Scan and upload an intro video', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('FILE.VIDEO_URL', 'Get a signed URL to view an intro video', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('MATCHING.VIEW_PROFILES', 'View ranked match profiles', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('SUBSCRIPTION.VIEW_PLANS', 'View all active subscription plans', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SUBSCRIPTION.SELECT_PLAN', 'Select a subscription plan', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SUBSCRIPTION.VIEW_MY_SUBSCRIPTION', 'View own active subscription', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('CONNECTION.SEND_REQUEST', 'Send a connection request', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CONNECTION.CHANGE_STATUS', 'Change a connection request status', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CONNECTION.VIEW_SENT', 'View sent connection requests', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CONNECTION.VIEW_RECEIVED', 'View received connection requests', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('SESSION.VIEW_ACTIVE', 'View active sessions', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SESSION.VIEW_LIMIT_STATUS', 'View session limit status', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SESSION.LOGOUT', 'Log out current session', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SESSION.LOGOUT_ALL', 'Log out all sessions', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SESSION.REVOKE_SELECTED', 'Revoke selected sessions', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SESSION.REVOKE', 'Revoke a specific session', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('MEETING.CREATE', 'Create a meeting', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('MEETING.VIEW_UPCOMING', 'View upcoming meeting for a deal room', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('MEETING.VIEW_DETAIL', 'View meeting details', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('MEETING.VIEW_LIST', 'View all meetings for a deal room', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('MEETING.UPDATE', 'Update a meeting', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('CHAT.VIEW_MESSAGES', 'View deal room chat messages', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CHAT.MARK_READ', 'Mark chat messages as read', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CHAT.UPLOAD_MEDIA', 'Upload chat media', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CHAT.VIEW_SHARED_FILES', 'View shared files in deal room chat', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('CHAT.VIEW_MEDIA', 'Stream a chat media attachment', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('FAQ.VIEW', 'View published FAQs', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('DEAL_ROOM.VIEW_LIST', 'View own deal rooms', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM.CLOSE', 'Close a deal room', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM.ARCHIVE', 'Archive a deal room', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM.UNARCHIVE', 'Unarchive a deal room', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM.VIEW_PENDING_STAGE_REQUEST', 'View pending stage update request', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM.EXPORT', 'Export deal room chat and media', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('DEAL_ROOM_TERM_SHEET.VIEW_CURRENT', 'View current term sheet', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM_TERM_SHEET.VIEW_HISTORY', 'View term sheet history', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('DEAL_ROOM_OFFER.VIEW_THREAD', 'View funding offer thread', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM_OFFER.VIEW_ALL', 'View all funding offer negotiation threads', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM_OFFER.VIEW_CURRENT', 'View current funding offer', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('DEAL_ROOM_OFFER.VIEW_DRAFT', 'View own draft funding offer', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_AUTH.MFA_TRIGGER_OTP', 'Trigger admin MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_AUTH.MFA_VERIFY_OTP', 'Verify admin MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_AUTH.MFA_RESEND_OTP', 'Resend admin MFA OTP', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_USER.LIST', 'List company users', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER.VIEW_DETAIL', 'View a single user''s role-shaped profile and suspension history', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER.VIEW_KYC_DOCS', 'View a user''s KYC documents', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER.SUSPENSION_ACTION', 'Suspend or activate a user', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER.SWITCH_ROLE_ACTION', 'Approve or reject a pending switched role', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER.SWITCHED_ROLE_LIST', 'List users who have switched/added a role', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_KYC.DOCUMENT_ACTION', 'Approve or reject a KYC document', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_KYC.REVIEW_ACTION', 'Final KYC review action', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_USER_LIMIT.VIEW', 'View a user''s limit configuration', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_USER_LIMIT.UPDATE', 'Update a user''s limit configuration', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_FAQ.LIST', 'List all FAQs for admin', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_FAQ.CREATE', 'Create an FAQ', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_FAQ.UPDATE', 'Update an FAQ', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_CONFIG.VIEW_OTP_CONFIG', 'View OTP configuration', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_CONFIG.UPDATE_OTP_CONFIG', 'Update OTP configuration', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_CONFIG.RESET_OTP_CONFIG', 'Reset OTP config to default', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('ADMIN_MANAGEMENT.LIST', 'List staff accounts', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.VIEW', 'View a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.CREATE', 'Create a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.UPDATE', 'Update a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.DELETE', 'Delete a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.SUSPEND', 'Suspend a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_MANAGEMENT.ACTIVATE', 'Reactivate a staff account', (select id from "admin" a where a.email = 'admin@test.com'), now()),

('USER.VIEW_DASHBOARD', 'View own dashboard stat cards', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('ADMIN_DASHBOARD.VIEW', 'View admin dashboard', (select id from "admin" a where a.email = 'admin@test.com'), now()),
('SUPER_ADMIN_DASHBOARD.VIEW', 'View super admin dashboard', (select id from "admin" a where a.email = 'admin@test.com'), now());