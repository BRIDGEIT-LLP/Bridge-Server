INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.VERIFY_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.RESEND_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.MFA_TRIGGER_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.MFA_VERIFY_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.MFA_RESEND_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'AUTH.SWITCH_ROLE'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.BUILD_PROFILE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.VIEW_PROFILE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.UPDATE_PROFILE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.SEARCH'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.VIEW_ROLE_DETAILS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.SCAN_IMAGE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.SCAN_DOCUMENT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.SAVE_KYC_INFO'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.PREVIEW'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.GET_KYC_DOCS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.VIDEO_URL'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FILE.SCAN_VIDEO'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MATCHING.VIEW_PROFILES'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CONNECTION.SEND_REQUEST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CONNECTION.CHANGE_STATUS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CONNECTION.VIEW_SENT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CONNECTION.VIEW_RECEIVED'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.VIEW_ACTIVE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.VIEW_LIMIT_STATUS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.LOGOUT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.LOGOUT_ALL'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.REVOKE_SELECTED'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.REVOKE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MEETING.CREATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MEETING.VIEW_UPCOMING'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MEETING.VIEW_DETAIL'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MEETING.VIEW_LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'MEETING.UPDATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CHAT.VIEW_MESSAGES'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CHAT.MARK_READ'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CHAT.UPLOAD_MEDIA'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CHAT.VIEW_SHARED_FILES'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'CHAT.VIEW_MEDIA'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'FAQ.VIEW'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.VIEW_LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.CLOSE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.ARCHIVE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.UNARCHIVE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.VIEW_PENDING_STAGE_REQUEST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM.EXPORT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_TERM_SHEET.VIEW_CURRENT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_TERM_SHEET.VIEW_HISTORY'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_OFFER.VIEW_THREAD'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_OFFER.VIEW_ALL'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_OFFER.VIEW_CURRENT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'DEAL_ROOM_OFFER.VIEW_DRAFT'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_TRIGGER_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_TRIGGER_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_VERIFY_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_VERIFY_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_RESEND_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_AUTH.MFA_RESEND_OTP'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.VIEW_DETAIL'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.VIEW_DETAIL'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.VIEW_KYC_DOCS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.VIEW_KYC_DOCS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SUSPENSION_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SUSPENSION_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SWITCH_ROLE_ACTION'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SWITCH_ROLE_ACTION'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SWITCHED_ROLE_LIST'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER.SWITCHED_ROLE_LIST'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_KYC.DOCUMENT_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_KYC.DOCUMENT_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_KYC.REVIEW_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_KYC.REVIEW_ACTION'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER_LIMIT.VIEW'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER_LIMIT.VIEW'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER_LIMIT.UPDATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_USER_LIMIT.UPDATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.LIST'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.CREATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.CREATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.UPDATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_FAQ.UPDATE'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.LOGOUT'), '2026-07-27 15:07:25.398', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.VIEW_LIMIT_STATUS'), '2026-07-27 15:07:25.398', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.LOGOUT'), '2026-07-27 15:07:25.398', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'SESSION.VIEW_LIMIT_STATUS'), '2026-07-27 15:07:25.398', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'FILE.PREVIEW'), '2026-07-27 15:20:41.177', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'FILE.PREVIEW'), '2026-07-27 15:20:41.177', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'USER.SEARCH'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'USER.SEARCH'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'USER.VIEW_ROLE_DETAILS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'USER.VIEW_ROLE_DETAILS'), '2026-07-27 14:10:40.426', (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SUBSCRIPTION.VIEW_PLANS'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SUBSCRIPTION.SELECT_PLAN'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'SUBSCRIPTION.VIEW_MY_SUBSCRIPTION'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_CONFIG.VIEW_OTP_CONFIG'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_CONFIG.UPDATE_OTP_CONFIG'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.LIST'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.VIEW'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.CREATE'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.UPDATE'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.DELETE'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.SUSPEND'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_MANAGEMENT.ACTIVATE'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO public.role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_CONFIG.RESET_OTP_CONFIG'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('USER', (SELECT id FROM permission_master WHERE permission_key = 'USER.VIEW_DASHBOARD'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_DASHBOARD.VIEW'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'ADMIN_DASHBOARD.VIEW'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);
INSERT INTO role_permission_map
(user_type, permission_id, created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by)
VALUES('SUPER_ADMIN', (SELECT id FROM permission_master WHERE permission_key = 'SUPER_ADMIN_DASHBOARD.VIEW'), now(), (select id from "admin" a where email = 'admin@test.com'), NULL, NULL, false, NULL, NULL);