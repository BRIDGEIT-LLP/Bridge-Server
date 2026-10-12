const OTP_MESSAGES = {
    SUCCESS: 'OTP is sent over email and phone number',
    EMAIL_VALIDATION_FAILED: 'Invalid email format',
    PHONE_NUMBER_VALIDATION_FAILED: 'Invalid phone number format',
    BLOCKED: "Too many attempts. Blocked for 1 hour",
    RESEND_TIMER: "Please wait 60 seconds before resend",
    MAX_RESEND: "Maximum resend attempts reached",
    OTP_GENERATION_FAILED: 'Error encountered while generating and sending OTP.',
    OTP_VERIFICATION_FAILED: 'Error encountered while verifying OTP.',
    OTP_VERIFY_SUCCESS: "OTP verified successfully",
    OTP_SEND_SUCCESS: "OTP sent successfully",
    OTP_SEND_FAILED: "failed to send OTP"
};

const OTP_PURPOSE = {
    REGISTRATION: 'registration',
    LOGIN_MFA: 'login_mfa',
    ADMIN_MFA: 'admin_mfa',
    RESET_PASSWORD: 'reset_password'
};

const REGISTRATION_MESSAGES = {
    COMPANY_CREATION_FAILED: 'Error encountered while creating company.',
    REGISTRATION_SUCCESS: 'Registration successful'
};

const GST_MESSAGES = {
    INVALID_FORMAT: 'gstin must be a valid 15-character GSTIN',
    VERIFY_SUCCESS: 'GSTIN verified successfully',
    VERIFY_FAILED: 'GSTIN could not be verified. Please check the number and try again.',
    NOT_VERIFIED_FOR_REGISTRATION: 'GSTIN could not be verified. Company registration cannot proceed.',
    VERIFICATION_SERVICE_ERROR: 'Error encountered while verifying GSTIN. Please try again.',
    ALREADY_SET: 'GST Number cannot be changed once it has been saved.'
};

const CIN_MESSAGES = {
    INVALID_FORMAT: 'cin must be a valid 21-character CIN',
    VERIFY_SUCCESS: 'CIN verified successfully',
    VERIFY_FAILED: 'CIN could not be verified. Please check the number and try again.',
    NOT_VERIFIED_FOR_REGISTRATION: 'CIN could not be verified. Company registration cannot proceed.',
    VERIFICATION_SERVICE_ERROR: 'Error encountered while verifying CIN. Please try again.',
    ALREADY_SET: 'CIN Number cannot be changed once it has been saved.'
};

const AUTH_MESSAGES = {
    ACCESS_TOKEN_UNAUTHORIZED: 'Unauthorized: No access token provided',
    FORBIDDEN: 'Forbidden',
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCESS_TOKEN_EXPIRED: 'Unauthorized: Access token has expired',
    UNAUTHORIZED: 'Unauthorized',
    TOKEN_REFRESH_SUCCESS: 'Token refreshed successfully',
    TOKEN_REFRESH_FAILED: 'Error encountered while refreshing token',
    LOGIN_SUCCESS: 'Login successful',
    LOGIN_FAILED: 'Error encountered while logging in',
    PASSWORD_RESET_SUCCESS: 'Password updated successfully',
    PASSWORD_RESET_FAILED: 'Error encountered while updating password'
};

const ROLE_FIELD_METADATA_MESSAGES = {
    CREATE_SUCCESS: 'Role field metadata created successfully',
    UPDATE_SUCCESS: 'Role field metadata updated successfully',
    DELETE_SUCCESS: 'Role field metadata deleted successfully',
    NOT_FOUND: 'Role field metadata not found',
    DUPLICATE_FIELD: 'Field already exists for this role and source table',
    INVALID_ROLE: 'Specified role does not exist',
    FETCH_FAILED: 'Error encountered while fetching role field metadata',
    CREATE_FAILED: 'Error encountered while creating role field metadata',
    UPDATE_FAILED: 'Error encountered while updating role field metadata',
    DELETE_FAILED: 'Error encountered while deleting role field metadata'
};

const USER_MESSAGES = {
    CREATE_SUCCESS: 'User profile created successfully',
    CREATE_FAILED: 'Error encountered while creating user profile',
    UPDATE_SUCCESS: 'User profile updated successfully',
    UPDATE_FAILED: 'Error encountered while updating user profile',
    EMAIL_ALREADY_EXISTS: 'A user with this email already exists',
    ROLE_NOT_FOUND: 'Company role not found for this account',
    PROFILE_NOT_COMPLETED: 'Profile for the switching role is not completed.',
    PROFILE_PENDING_APPROVAL: 'Profile for the switching role is still pending approval.',
    PROFILE_REJECTED: 'Profile for the switching role has been rejected.',
    VALIDATION_FAILED: 'Validation failed for the submitted fields',
    USER_LISTING_FAILURE: 'Error encountered while fetching user list',
    USER_LISTING_SUCCESS: 'User list fetched successfully',
    SWITCHED_ROLE_LISTING_SUCCESS: 'Users with switched roles fetched successfully',
    SWITCHED_ROLE_LISTING_FAILURE: 'Error encountered while fetching users with switched roles',
    USER_NOT_FOUND: 'User not found',
    SEARCH_QUERY_REQUIRED: 'q query parameter is required and must be a non-empty string',
    SEARCH_SUCCESS: 'User search results fetched successfully',
    SEARCH_FAILED: 'Error encountered while searching users',
    USER_ID_REQUIRED: 'userId query parameter is required and must be a valid UUID',
    COMPANY_ID_REQUIRED: 'companyId query parameter is required and must be a valid UUID',
    ROLE_ID_REQUIRED: 'roleId query parameter is required and must be a positive integer',
    ROLE_DETAILS_SUCCESS: 'User role details fetched successfully',
    ROLE_DETAILS_FAILED: 'Error encountered while fetching user role details'
};

const LOGIN_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid Credentials',
    VALID_CREDENTIALS: 'Logged in successfully',
    USER_NOT_FOUND: 'User not found'
};

const KYC_MESSAGES = {
    FETCH_SUCCESS: 'Fetched KYC documents successfully',
    FETCH_FAILED: 'Error encountered while fetching KYC documents',
    KYC_LISTING_SUCCESS: 'KYC documents fetched successfully',
    KYC_LISTING_FAILED: 'Error encountered while fetching KYC documents',
    DOCUMENT_ACTION_SUCCESS: 'KYC document status updated successfully',
    DOCUMENT_ACTION_FAILED: 'Error encountered while updating KYC document status',
    REVIEW_ACTION_SUCCESS: 'KYC review status updated successfully',
    REVIEW_ACTION_FAILED: 'Error encountered while updating KYC review status',
    DOCUMENT_NOT_FOUND: 'KYC document not found',
    DUPLICATE_SUBMISSION: 'This document was already submitted. Please refresh and try again.',
};

const ENCRYPT_DECRYPT_MESSAGES = {
    ENCRYPT_FAILED: 'Error encountered while encrypting data',
    DECRYPT_FAILED: 'Error encountered while decrypting data',
    ENCRYPT_SUCCESS: 'Data encrypted successfully',
    DECRYPT_SUCCESS: 'Data decrypted successfully'
};

const ADMIN_MESSAGES = {
    INVALID_CREDENTIALS: 'Invalid Credentials',
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGIN_FAILED: 'Error encountered while logging in'
};

const ADMIN_MANAGEMENT_MESSAGES = {
    CREATE_SUCCESS: 'Admin created successfully',
    CREATE_FAILED: 'Error encountered while creating admin',
    UPDATE_SUCCESS: 'Admin updated successfully',
    UPDATE_FAILED: 'Error encountered while updating admin',
    DELETE_SUCCESS: 'Admin deleted successfully',
    DELETE_FAILED: 'Error encountered while deleting admin',
    SUSPEND_SUCCESS: 'Admin suspended successfully',
    SUSPEND_FAILED: 'Error encountered while suspending admin',
    ACTIVATE_SUCCESS: 'Admin activated successfully',
    ACTIVATE_FAILED: 'Error encountered while activating admin',
    LIST_SUCCESS: 'Admin list fetched successfully',
    LIST_FAILED: 'Error encountered while fetching admin list',
    DETAIL_SUCCESS: 'Admin details fetched successfully',
    DETAIL_FAILED: 'Error encountered while fetching admin details',
    NOT_FOUND: 'Admin not found',
    EMAIL_ALREADY_EXISTS: 'An admin with this email already exists',
    CANNOT_SELF_ACTION: 'You cannot perform this action on your own account',
    ALREADY_DELETED: 'Admin is already deleted',
    ALREADY_SUSPENDED: 'Admin is already suspended',
    ALREADY_ACTIVE: 'Admin is already active',
    CANNOT_ACTION_DELETED: 'Cannot perform this action on a deleted admin',
    INVALID_ROLE: 'Only ADMIN role accounts can be managed through this endpoint',
    ACCOUNT_SUSPENDED: 'Your admin account has been suspended. Please contact a super admin.'
};

// ── Admin Profile (self-service) ──────────────────────────────────────────────
const ADMIN_PROFILE_MESSAGES = {
    FETCH_SUCCESS: 'Admin profile retrieved successfully',
    FETCH_FAILED: 'Error encountered while fetching admin profile',
    UPDATE_SUCCESS: 'Admin profile updated successfully',
    UPDATE_FAILED: 'Error encountered while updating admin profile',
    NOT_FOUND: 'Admin profile not found',
    NO_CHANGES: 'No valid fields provided for update'
};

const MATCHING_MESSAGES = {
    MATCH_SUCCESS: 'Matches retrieved successfully',
    MATCH_FAILED: 'Error encountered while retrieving matches',
    PROFILE_NOT_FOUND: 'Profile not found',
    NO_MATCHES_FOUND: 'No matching profiles found'
};

const SESSION_MESSAGES = {
    SESSION_LISTING_SUCCESS: 'Active sessions fetched successfully',
    SESSION_LISTING_FAILED: 'Failed to fetch active sessions',
    SESSION_REVOKE_SUCCESS: 'Session revoked successfully',
    SESSION_REVOKE_FAILED: 'Failed to revoke session',
    SESSION_NOT_FOUND: 'Session not found',
    LOGOUT_ALL_SUCCESS: 'All sessions revoked. Please log in again.',
    LOGOUT_ALL_FAILED: 'Failed to revoke all sessions',
    LOGOUT_SUCCESS: 'Logged out successfully',
    LOGOUT_FAILED: 'Failed to log out',
    SESSION_CREATE_SUCCESS: 'Session created successfully',
    SESSION_CREATE_FAILED: 'Failed to create session',
    SESSION_LIMIT_REACHED: 'Maximum number of active devices reached. Please choose a device to log out.',
    SESSION_SELECTION_REQUIRED: 'Please select at least one device to log out.',
    SESSION_SELECTION_INVALID: 'One or more selected sessions are invalid or do not belong to you.'
};

const ADMIN_CONFIG_MESSAGES = {
    CONFIG_FETCH_SUCCESS: 'OTP configuration fetched successfully',
    CONFIG_FETCH_FAILED: 'Error encountered while fetching OTP configuration',
    CONFIG_UPDATE_SUCCESS: 'OTP configuration updated successfully',
    CONFIG_UPDATE_FAILED: 'Error encountered while updating OTP configuration',
    CONFIG_RESET_SUCCESS: 'OTP configuration reset to defaults successfully',
    CONFIG_RESET_FAILED: 'Error encountered while resetting OTP configuration'
};

const DASHBOARD_MESSAGES = {
    FETCH_SUCCESS: 'Dashboard data fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching dashboard data',
    USER_NOT_FOUND: 'User dashboard profile not found'
};

const S3_FILE_TYPE = {
    PROFILE: 'profile',
    KYC: 'kyc',
    CHAT: 'chat',
    INTRO_VIDEO: 'intro-video'
};

const CHANNEL_TYPE = {
    EMAIL: 'EMAIL',
    PHONE: 'PHONE'
};

const KYC_DOC_TYPES = ['AADHAAR', 'PAN'];

const DEFAULT_KYC_VERIFICATION_APPROVAL_TIME = 24;

const KYC_STATUS = {
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    APPROVED: 'Approved'
};

const REDIRECT_ROUTES = {
    REGISTRATION: {
        COMPANY_REGISTRATION: '/registration',
        VERIFY_COMPANY_ACCOUNT: '/registration/verify-account',
        BUILD_USER_PROFILE: '/registration/complete-profile',
        UPLOAD_KYC_DOCUMENTS: '/registration/document-upload',
        PENDING_KYC_APPROVAL: '/registration/verification-status',
    },
    DASHBOARD: {
        DASHBOARD: '/dashboard'
    }
};

const ROLES = {
    USER: ['STARTUP', 'INVESTOR', 'B2B'],
    ADMIN: ['ADMIN'],
    SUPER_ADMIN: ['SUPER_ADMIN']
};

const USER_ROLES_CODE = {
    STARTUP: 'STARTUP',
    INVESTOR: 'INVESTOR',
    B2B: 'B2B'
};

const ADMIN_ROLES_CODE = {
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN'
};

const USER_TYPES = {
    'B2B': 'USER',
    'INVESTOR': 'USER',
    'STARTUP': 'USER',
    'ADMIN': 'ADMIN',
    'SUPER_ADMIN': 'SUPER_ADMIN'
};

const USER_TYPE_VALUES = {
    USER: 'USER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN'
};

const ADMIN_USER_TYPES = [USER_TYPE_VALUES.ADMIN, USER_TYPE_VALUES.SUPER_ADMIN];

const ADMIN_STATUS = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED'
};

const ADMIN_ACTIVITY_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    DELETED: 'DELETED',
    SUSPENDED: 'SUSPENDED',
    ACTIVATED: 'ACTIVATED',
    PERMISSIONS_UPDATED: 'PERMISSIONS_UPDATED'
};

// Keys for per-admin feature permissions (stored in admin_permission table).
// These are the checkbox options shown on the admin creation / edit screen.
// Add new keys here when new admin-facing modules are introduced.
const ADMIN_PERMISSION_KEYS = {
    KYC_REVIEW: 'KYC_REVIEW',
    FAQ_MANAGEMENT: 'FAQ_MANAGEMENT',
    USER_MANAGEMENT: 'USER_MANAGEMENT'
};

// ── Permissions ──────────────────────────────────────────────────────────────
// Keys are namespaced MODULE.ACTION and must match permission_master.permission_key
// (see src/seed_data/PermissionMaster.sql, the source of truth for the catalog).
// This object only gives routes a typo-safe reference to those same key strings —
// which roles get which permission still comes entirely from role_permission_map via Redis.
const PERMISSIONS = {
    AUTH: {
        VERIFY_OTP: 'AUTH.VERIFY_OTP',
        RESEND_OTP: 'AUTH.RESEND_OTP',
        MFA_TRIGGER_OTP: 'AUTH.MFA_TRIGGER_OTP',
        MFA_VERIFY_OTP: 'AUTH.MFA_VERIFY_OTP',
        MFA_RESEND_OTP: 'AUTH.MFA_RESEND_OTP',
        SWITCH_ROLE: 'AUTH.SWITCH_ROLE'
    },
    USER: {
        BUILD_PROFILE: 'USER.BUILD_PROFILE',
        VIEW_PROFILE: 'USER.VIEW_PROFILE',
        UPDATE_PROFILE: 'USER.UPDATE_PROFILE',
        SEARCH: 'USER.SEARCH',
        VIEW_ROLE_DETAILS: 'USER.VIEW_ROLE_DETAILS',
        VIEW_DASHBOARD: 'USER.VIEW_DASHBOARD'
    },
    FILE: {
        SCAN_IMAGE: 'FILE.SCAN_IMAGE',
        SCAN_DOCUMENT: 'FILE.SCAN_DOCUMENT',
        SCAN_VIDEO: 'FILE.SCAN_VIDEO',
        VIDEO_URL: 'FILE.VIDEO_URL',
        SAVE_KYC_INFO: 'FILE.SAVE_KYC_INFO',
        PREVIEW: 'FILE.PREVIEW',
        GET_KYC_DOCS: 'FILE.GET_KYC_DOCS'
    },
    MATCHING: {
        VIEW_PROFILES: 'MATCHING.VIEW_PROFILES'
    },
    SUBSCRIPTION: {
        VIEW_PLANS: 'SUBSCRIPTION.VIEW_PLANS',
        SELECT_PLAN: 'SUBSCRIPTION.SELECT_PLAN',
        VIEW_MY_SUBSCRIPTION: 'SUBSCRIPTION.VIEW_MY_SUBSCRIPTION'
    },
    CONNECTION: {
        SEND_REQUEST: 'CONNECTION.SEND_REQUEST',
        CHANGE_STATUS: 'CONNECTION.CHANGE_STATUS',
        VIEW_SENT: 'CONNECTION.VIEW_SENT',
        VIEW_RECEIVED: 'CONNECTION.VIEW_RECEIVED'
    },
    SESSION: {
        VIEW_ACTIVE: 'SESSION.VIEW_ACTIVE',
        VIEW_LIMIT_STATUS: 'SESSION.VIEW_LIMIT_STATUS',
        LOGOUT: 'SESSION.LOGOUT',
        LOGOUT_ALL: 'SESSION.LOGOUT_ALL',
        REVOKE_SELECTED: 'SESSION.REVOKE_SELECTED',
        REVOKE: 'SESSION.REVOKE'
    },
    MEETING: {
        CREATE: 'MEETING.CREATE',
        VIEW_UPCOMING: 'MEETING.VIEW_UPCOMING',
        VIEW_DETAIL: 'MEETING.VIEW_DETAIL',
        VIEW_LIST: 'MEETING.VIEW_LIST',
        UPDATE: 'MEETING.UPDATE'
    },
    CHAT: {
        VIEW_MESSAGES: 'CHAT.VIEW_MESSAGES',
        MARK_READ: 'CHAT.MARK_READ',
        UPLOAD_MEDIA: 'CHAT.UPLOAD_MEDIA',
        VIEW_SHARED_FILES: 'CHAT.VIEW_SHARED_FILES',
        VIEW_MEDIA: 'CHAT.VIEW_MEDIA'
    },
    FAQ: {
        VIEW: 'FAQ.VIEW'
    },
    DEAL_ROOM: {
        VIEW_LIST: 'DEAL_ROOM.VIEW_LIST',
        CLOSE: 'DEAL_ROOM.CLOSE',
        ARCHIVE: 'DEAL_ROOM.ARCHIVE',
        UNARCHIVE: 'DEAL_ROOM.UNARCHIVE',
        VIEW_PENDING_STAGE_REQUEST: 'DEAL_ROOM.VIEW_PENDING_STAGE_REQUEST',
        EXPORT: 'DEAL_ROOM.EXPORT'
    },
    DEAL_ROOM_TERM_SHEET: {
        VIEW_CURRENT: 'DEAL_ROOM_TERM_SHEET.VIEW_CURRENT',
        VIEW_HISTORY: 'DEAL_ROOM_TERM_SHEET.VIEW_HISTORY'
    },
    DEAL_ROOM_OFFER: {
        VIEW_THREAD: 'DEAL_ROOM_OFFER.VIEW_THREAD',
        VIEW_ALL: 'DEAL_ROOM_OFFER.VIEW_ALL',
        VIEW_CURRENT: 'DEAL_ROOM_OFFER.VIEW_CURRENT',
        VIEW_DRAFT: 'DEAL_ROOM_OFFER.VIEW_DRAFT'
    },
    ADMIN_AUTH: {
        MFA_TRIGGER_OTP: 'ADMIN_AUTH.MFA_TRIGGER_OTP',
        MFA_VERIFY_OTP: 'ADMIN_AUTH.MFA_VERIFY_OTP',
        MFA_RESEND_OTP: 'ADMIN_AUTH.MFA_RESEND_OTP'
    },
    ADMIN_USER: {
        LIST: 'ADMIN_USER.LIST',
        VIEW_DETAIL: 'ADMIN_USER.VIEW_DETAIL',
        VIEW_KYC_DOCS: 'ADMIN_USER.VIEW_KYC_DOCS',
        SUSPENSION_ACTION: 'ADMIN_USER.SUSPENSION_ACTION',
        SWITCH_ROLE_ACTION: 'ADMIN_USER.SWITCH_ROLE_ACTION',
        SWITCHED_ROLE_LIST: 'ADMIN_USER.SWITCHED_ROLE_LIST'
    },
    ADMIN_KYC: {
        DOCUMENT_ACTION: 'ADMIN_KYC.DOCUMENT_ACTION',
        REVIEW_ACTION: 'ADMIN_KYC.REVIEW_ACTION'
    },
    ADMIN_USER_LIMIT: {
        VIEW: 'ADMIN_USER_LIMIT.VIEW',
        UPDATE: 'ADMIN_USER_LIMIT.UPDATE'
    },
    ADMIN_FAQ: {
        LIST: 'ADMIN_FAQ.LIST',
        CREATE: 'ADMIN_FAQ.CREATE',
        UPDATE: 'ADMIN_FAQ.UPDATE'
    },
    ADMIN_CONFIG: {
        VIEW_OTP_CONFIG: 'ADMIN_CONFIG.VIEW_OTP_CONFIG',
        UPDATE_OTP_CONFIG: 'ADMIN_CONFIG.UPDATE_OTP_CONFIG',
        RESET_OTP_CONFIG: 'ADMIN_CONFIG.RESET_OTP_CONFIG'
    },
    ADMIN_MANAGEMENT: {
        LIST: 'ADMIN_MANAGEMENT.LIST',
        VIEW: 'ADMIN_MANAGEMENT.VIEW',
        CREATE: 'ADMIN_MANAGEMENT.CREATE',
        UPDATE: 'ADMIN_MANAGEMENT.UPDATE',
        DELETE: 'ADMIN_MANAGEMENT.DELETE',
        SUSPEND: 'ADMIN_MANAGEMENT.SUSPEND',
        ACTIVATE: 'ADMIN_MANAGEMENT.ACTIVATE'
    },
    ADMIN_DASHBOARD: {
        VIEW: 'ADMIN_DASHBOARD.VIEW'
    },
    SUPER_ADMIN_DASHBOARD: {
        VIEW: 'SUPER_ADMIN_DASHBOARD.VIEW'
    }
};

const TOKEN_TYPES = {
    AUTH_ACCESS_TOKEN: 'AUTH_ACCESS_TOKEN',
    AUTH_REFRESH_ACCESS_TOKEN: 'REFRESH_ACCESS_TOKEN',
    RESET_PASSWORD_ACCESS_TOKEN: 'RESET_PASSWORD_ACCESS_TOKEN',
    MFA_ACCESS_TOKEN: 'MFA_ACCESS_TOKEN'
};

const CONNECTION_VALID_TRANSITIONS = {
    Viewed:    ['Pending'],
    Accepted:  ['Pending', 'Viewed', 'Deferred'],
    Declined:  ['Pending', 'Viewed', 'Deferred'],
    Deferred:  ['Pending', 'Viewed'],
    Withdrawn: ['Pending', 'Viewed', 'Deferred']
};

const CONNECTION_STATUS = {
    PENDING: 'Pending',
    VIEWED: 'Viewed',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    DEFERRED: 'Deferred',
    WITHDRAWN: 'Withdrawn',
    EXPIRED: 'Expired'
};

// Statuses that still occupy the role-pair and must block a new request.
const CONNECTION_BLOCKING_STATUSES = [
    CONNECTION_STATUS.PENDING,
    CONNECTION_STATUS.VIEWED,
    CONNECTION_STATUS.ACCEPTED,
    CONNECTION_STATUS.DEFERRED
];

// Terminal statuses that free the role-pair so the requester can send again.
const CONNECTION_REOPENABLE_STATUSES = [
    CONNECTION_STATUS.DECLINED,
    CONNECTION_STATUS.WITHDRAWN,
    CONNECTION_STATUS.EXPIRED
];

const SUBSCRIPTION_MESSAGES = {
    NO_ACTIVE_SUBSCRIPTION: 'Access denied: No active subscription found',
    SUBSCRIPTION_EXPIRED: 'Access denied: Your subscription has expired',
    SUBSCRIPTION_CHECK_FAILED: 'Error encountered while verifying subscription',
    SUBSCRIPTION_FETCH_FAILED: 'Error encountered while fetching subscription',
    SUBSCRIPTION_FETCH_SUCCESS: 'Subscription fetched successfully'
};

const CONNECTION_REQUEST_LIMITS = {
    FREE: 3,
    PREMIUM: 50
};

const LOGIN_LOCKOUT_LIMITS = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15
};

const TRIAL_DAYS_LIMITS = {
    FREE: 7
};

const TRIAL_CONFIG_LOOKUP_KEYS = {
    FREE_CONNECTION_LIMIT: 'free_trial_connection_limit',
    PREMIUM_CONNECTION_LIMIT: 'premium_connection_limit',
    AWS_SERVICE_ENABLED: 'aws_service_enabled',
    FREE_TRIAL_DAY: 'free_trial_day'
};

const CONNECTION_MESSAGES = {
    REQUEST_SENT: 'Connection request sent successfully',
    CONNECTION_LIMIT_REACHED: 'Connection request limit reached for this billing period',
    REQUEST_ACCEPTED: 'Connection request accepted',
    REQUEST_DECLINED: 'Connection request declined',
    REQUEST_DEFERRED: 'Connection request deferred',
    REQUEST_WITHDRAWN: 'Connection request withdrawn',
    REQUEST_VIEWED: 'Connection request marked as viewed',
    ALREADY_EXISTS: 'A connection with this user already exists',
    RECIPIENT_NOT_FOUND: 'Recipient user not found',
    RECIPIENT_ROLE_NOT_FOUND: 'Recipient role not found',
    NOT_FOUND: 'Connection not found',
    FORBIDDEN: 'You are not authorized to perform this action',
    INVALID_TRANSITION: 'This status change is not allowed',
    INVALID_ROLE_PAIR: 'Connection is not allowed between these roles',
    FETCH_SUCCESS: 'Connections fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching connections',
    REQUEST_FAILED: 'Error encountered while sending connection request',
    SENT_FETCH_SUCCESS: 'Sent connection requests fetched successfully',
    SENT_FETCH_FAILED: 'Error encountered while fetching sent connection requests',
    RECEIVED_FETCH_SUCCESS: 'Received connection requests fetched successfully',
    RECEIVED_FETCH_FAILED: 'Error encountered while fetching received connection requests'
};

const DEAL_ROOM_STATUS = {
    ACTIVE: 'Active',
    CLOSED: 'Closed'
};

const DEAL_ROOM_MESSAGES = {
    CREATE_SUCCESS: 'Deal room created successfully',
    CREATE_FAILED: 'Error encountered while creating deal room',
    FETCH_SUCCESS: 'Deal rooms fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching deal rooms',
    CLOSE_SUCCESS: 'Deal room closed successfully',
    CLOSE_FAILED: 'Error encountered while closing deal room',
    ALREADY_CLOSED: 'Deal room is already closed',
    NOT_FOUND: 'Deal room not found',
    FORBIDDEN: 'You are not authorized to perform this action',
    ARCHIVE_SUCCESS: 'Deal room archived successfully',
    ARCHIVE_FAILED: 'Error encountered while archiving deal room',
    ALREADY_ARCHIVED: 'Deal room is already archived',
    UNARCHIVE_SUCCESS: 'Deal room unarchived successfully',
    UNARCHIVE_FAILED: 'Error encountered while unarchiving deal room',
    NOT_ARCHIVED: 'Deal room is not archived'
};

const DEAL_ROOM_STAGES = {
    INITIAL_CONNECTION: 'Initial Connection',
    NEGOTIATION: 'Negotiation',
    DUE_DILIGENCE: 'Due Diligence',
    CLOSED: 'Closed'
};

const DEAL_ROOM_STAGE_REQUEST_STATUS = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected'
};

const DEAL_ROOM_STAGE_MESSAGES = {
    REQUEST_SUCCESS: 'Stage update requested successfully',
    REQUEST_FAILED: 'Error encountered while requesting stage update',
    REQUEST_PENDING_EXISTS: 'A stage update request is already pending for this deal room',
    INVALID_STAGE: 'Invalid deal room stage',
    SAME_STAGE: 'Deal room is already in the requested stage',
    RESPOND_SUCCESS: 'Stage update request updated successfully',
    RESPOND_FAILED: 'Error encountered while responding to stage update request',
    INVALID_DECISION: 'decision must be Accepted or Rejected',
    REQUEST_NOT_FOUND: 'Stage update request not found',
    REQUEST_NOT_PENDING: 'This stage update request has already been responded to',
    CANNOT_RESPOND_OWN_REQUEST: 'You cannot respond to your own stage update request',
    FORBIDDEN: 'You are not authorized to perform this action',
    DEAL_ROOM_NOT_FOUND: 'Deal room not found',
    DEAL_ROOM_CLOSED: 'This deal room is closed; stage updates are not allowed',
    PENDING_OFFER_BLOCKS_TRANSITION: 'Resolve the pending funding offer (accept, reject or counter it) before moving past the Negotiation stage'
};


const DEAL_ROOM_OFFER_STATUS = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    COUNTERED: 'Countered'
};

const VALUATION_TYPE = {
    PRE_MONEY: 'Pre-money',
    POST_MONEY: 'Post-money'
};

const OFFER_CURRENCY = {
    INR: 'INR',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    SGD: 'SGD',
    AED: 'AED'
};

const DEAL_ROOM_OFFER_MESSAGES = {
    DRAFT_SAVE_SUCCESS: 'Offer draft saved successfully',
    DRAFT_SAVE_FAILED: 'Error encountered while saving offer draft',
    SEND_SUCCESS: 'Offer sent successfully',
    SEND_FAILED: 'Error encountered while sending offer',
    RESPOND_SUCCESS: 'Offer updated successfully',
    RESPOND_FAILED: 'Error encountered while responding to offer',
    COUNTER_SUCCESS: 'Counter offer sent successfully',
    COUNTER_FAILED: 'Error encountered while sending counter offer',
    FETCH_SUCCESS: 'Offers fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching offers',
    NOT_FOUND: 'Offer not found',
    FORBIDDEN: 'You are not authorized to perform this action',
    DEAL_ROOM_NOT_FOUND: 'Deal room not found',
    DEAL_ROOM_CLOSED: 'This deal room is closed; offers are not allowed',
    INVALID_ROLE_PAIR: 'Funding offers are only allowed between an Investor and a Startup',
    PENDING_OFFER_EXISTS: 'A pending offer already exists for this deal room',
    INVALID_DECISION: 'decision must be Accepted or Rejected',
    OFFER_NOT_PENDING: 'This offer has already been responded to',
    CANNOT_RESPOND_OWN_OFFER: 'You cannot respond to your own offer',
    NOT_NEGOTIATION_STAGE: 'Funding offer actions are only allowed during the Negotiation stage'
};

const DEAL_ROOM_TERM_SHEET_MESSAGES = {
    SAVE_SUCCESS: 'Term sheet saved successfully',
    SAVE_FAILED: 'Error encountered while saving term sheet',
    FETCH_SUCCESS: 'Term sheet fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching term sheet',
    DEAL_ROOM_NOT_FOUND: 'Deal room not found',
    DEAL_ROOM_CLOSED: 'This deal room is closed; term sheet edits are not allowed',
    FORBIDDEN: 'You are not authorized to perform this action',
    INVALID_ROLE_PAIR: 'The B2B term sheet is only allowed between two B2B enterprises',
    NOT_NEGOTIATION_STAGE: 'Term sheet edits are only allowed during the Negotiation stage'
};


const CHAT_MESSAGE_TYPE = {
    TEXT: 'TEXT',
    IMAGE: 'IMAGE',
    DOCUMENT: 'DOCUMENT',
    AUDIO: 'AUDIO',
    VIDEO: 'VIDEO'
};

const CHAT_MESSAGES = {
    SEND_SUCCESS: 'Message sent successfully',
    SEND_FAILED: 'Error encountered while sending message',
    FETCH_SUCCESS: 'Messages fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching messages',
    MARK_READ_SUCCESS: 'Messages marked as read',
    MARK_READ_FAILED: 'Error encountered while marking messages as read',
    MEDIA_UPLOAD_SUCCESS: 'Media message sent successfully',
    MEDIA_UPLOAD_FAILED: 'Error encountered while sending media message',
    MEDIA_FETCH_FAILED: 'Error encountered while fetching media',
    MEDIA_REQUIRED: 'Media file is required',
    FILES_FETCH_SUCCESS: 'Shared files fetched successfully',
    FILES_FETCH_FAILED: 'Error encountered while fetching shared files',
    MESSAGE_NOT_FOUND: 'Message not found',
    MEDIA_NOT_FOUND: 'Media not found',
    DEAL_ROOM_NOT_FOUND: 'Deal room not found',
    DEAL_ROOM_CLOSED: 'This deal room is closed; new messages are not allowed',
    FORBIDDEN: 'You are not authorized to access this deal room chat',
    EXPORT_FAILED: 'Error encountered while exporting deal room data'
};

const SOCKET_EVENTS = {
    JOIN_DEAL_ROOM: 'join_deal_room',
    LEAVE_DEAL_ROOM: 'leave_deal_room',
    SEND_MESSAGE: 'send_message',
    NEW_MESSAGE: 'new_message',
    MARK_READ: 'mark_read',
    MESSAGES_READ: 'messages_read',
    TYPING: 'typing',
    STOP_TYPING: 'stop_typing',
    USER_TYPING: 'user_typing',
    REQUEST_STAGE_UPDATE: 'request_stage_update',
    RESPOND_STAGE_UPDATE: 'respond_stage_update',
    STAGE_UPDATE_REQUESTED: 'stage_update_requested',
    STAGE_UPDATE_RESPONDED: 'stage_update_responded',
    ERROR: 'error',
    USER_PRESENCE: 'user_presence',
    MEETING_SCHEDULED: 'meeting_scheduled',


    SAVE_OFFER_DRAFT: 'save_offer_draft',
    OFFER_DRAFT_SAVED: 'offer_draft_saved',
    SEND_OFFER: 'send_offer',
    OFFER_RECEIVED: 'offer_received',
    RESPOND_OFFER: 'respond_offer',
    OFFER_RESPONDED: 'offer_responded',
    COUNTER_OFFER: 'counter_offer',
    OFFER_COUNTERED: 'offer_countered',

    UPDATE_TERM_SHEET: 'update_term_sheet',
    TERM_SHEET_UPDATED: 'term_sheet_updated'

};

const MEETING_MESSAGES = {
    CREATE_SUCCESS: 'Meeting created successfully',
    CREATE_FAILED: 'Error encountered while creating meeting',
    UPDATE_SUCCESS: 'Meeting updated successfully',
    UPDATE_FAILED: 'Error encountered while updating meeting',
    NOT_FOUND: 'Meeting not found',
    DEAL_ROOM_NOT_FOUND: 'Deal room not found',
    PAST_TIME: 'Meeting time cannot be in the past',
    NOT_DEAL_ROOM_PARTICIPANT: 'You are not a participant in this deal room',
    RECIPIENT_MISMATCH: 'The recipient does not match the deal room participant',
    FETCH_SUCCESS: 'Meetings fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching meetings',
    FORBIDDEN: 'You are not authorized to perform this action',
    DEAL_ROOM_CLOSED: 'This deal room is closed; meetings cannot be scheduled or updated'
};

const USER_LIMIT_CONFIG_MESSAGES = {
    FETCH_SUCCESS: 'User limit configuration fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching user limit configuration',
    UPDATE_SUCCESS: 'User limit configuration updated successfully',
    UPDATE_FAILED: 'Error encountered while updating user limit configuration',
    USER_NOT_FOUND: 'User not found',
    FORBIDDEN: 'You are not authorized to perform this action',
    INVALID_USER_ID: 'Invalid user ID provided'
};

const USER_SUSPENSION_MESSAGES = {
    USER_ID_REQUIRED: 'userId is required',
    IS_SUSPENDED_REQUIRED: 'isSuspended is required and must be a boolean',
    SUSPENSION_REASON_REQUIRED: 'suspension_reason is required when suspending a user',
    FORBIDDEN_SUPER_ADMIN_LOCK: 'This user\'s suspension status was last set by a super admin and cannot be changed by an admin.',
    UPDATE_SUCCESS: 'User suspension status updated successfully.',
    UPDATE_FAILED: 'Failed to update user suspension status.',
    ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact support.'
};

const ADMIN_USER_DETAIL_MESSAGES = {
    FETCH_SUCCESS: 'User detail fetched successfully.',
    FETCH_FAILED: 'Error encountered while fetching user detail.',
    COMPANY_ID_REQUIRED: 'companyId query parameter is required and must be a valid UUID',
    ROLE_CODE_REQUIRED: 'roleCode query parameter is required'
};

const ROLE_SWITCH_MESSAGES = {
    COMPANY_USER_ROLE_ID_REQUIRED: 'companyUserRoleId is required',
    ACTION_REQUIRED: 'action is required',
    INVALID_ACTION: 'action must be approve or reject',
    REJECTION_REASON_REQUIRED: 'rejectionReason is required when rejecting',
    NOT_FOUND: 'Role switch request not found',
    PROFILE_NOT_COMPLETED: 'Cannot approve or reject a role switch until the user has completed their profile for this role.',
    REVIEW_ACTION_SUCCESS: 'Role switch status updated successfully.',
    REVIEW_ACTION_FAILED: 'Error encountered while updating role switch status.',
    SWITCH_FAILED: 'Error encountered while switching role.',
    DETAILS_SUCCESS: 'Switch role details fetched successfully.',
    DETAILS_FAILED: 'Error encountered while fetching switch role details.',
    NOT_REQUESTED: 'A role switch has not been requested for this role yet.',
    ALREADY_APPROVED: 'This role is already approved. Switch into it instead of requesting it again.',
    REQUEST_SUCCESS: 'Your role switch request has been sent for approval.',
    REQUEST_FAILED: 'Error encountered while requesting a role switch.'
};

const PREMIUM_DAYS_LIMIT_DEFAULT = 30;

const USER_LIMIT_DEFAULTS = {
    ALLOWED_CONNECTIONS: CONNECTION_REQUEST_LIMITS.FREE,
    ALLOWED_FREE_TRIAL_DAYS: TRIAL_DAYS_LIMITS.FREE,
    ALLOWED_PREMIUM_DAYS: PREMIUM_DAYS_LIMIT_DEFAULT
};

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_MESSAGES = {
    FETCH_SUCCESS: 'FAQs fetched successfully',
    FETCH_FAILED: 'Error encountered while fetching FAQs',
    CREATE_SUCCESS: 'FAQ created successfully',
    CREATE_FAILED: 'Error encountered while creating FAQ',
    UPDATE_SUCCESS: 'FAQ updated successfully',
    UPDATE_FAILED: 'Error encountered while updating FAQ',
    NOT_FOUND: 'FAQ not found',
    PERMISSION_DENIED: 'You do not have permission to manage FAQs. Contact a super admin to request access.'
};

const SUBSCRIPTION_PLAN_MESSAGES = {
    PLANS_FETCH_SUCCESS: 'Subscription plans fetched successfully',
    PLANS_FETCH_FAILED: 'Error encountered while fetching subscription plans',
    PLAN_NOT_FOUND: 'Subscription plan not found or is no longer available',
    PLAN_ID_REQUIRED: 'plan_id is required and must be a positive integer',
    PLAN_SELECT_SUCCESS: 'Subscription plan selected successfully',
    PLAN_SELECT_FAILED: 'Error encountered while selecting subscription plan',
    SUBSCRIPTION_NOT_FOUND: 'No active subscription found',
    SUBSCRIPTION_FETCH_SUCCESS: 'Subscription details fetched successfully',
    SUBSCRIPTION_FETCH_FAILED: 'Error encountered while fetching subscription details'
};

const DATA_TYPES = {
    STRING: 'string',
    INTEGER: 'integer',
    FLOAT: 'float',
    BOOLEAN: 'boolean',
    DATETIME: 'datetime',
    DATE: 'date'
};

const UNITS = {
    MINUTE: 'minute',
    SECOND: 'second',
    HOUR: 'hour',
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year',
    NUMBER: 'number',
    FLAG: 'flag'
};

const REDIS_BASE_KEYS = {
    CONFIG_OTP_CONFIG: 'config:otp_config',
    CONFIG_TRIAL_CONFIG: 'config:trial_config',
    SUSPENDED_USERS_HASH: 'suspended_users',
    SUSPENDED_ADMINS_HASH: 'suspended_admins',
    SANDBOX_GST_TOKEN: 'sandbox_gst:access_token',
    SANDBOX_MCA_TOKEN: 'sandbox_mca:access_token'
};

module.exports = { OTP_MESSAGES, OTP_PURPOSE, REGISTRATION_MESSAGES, AUTH_MESSAGES, ROLE_FIELD_METADATA_MESSAGES,
    USER_MESSAGES, S3_FILE_TYPE, KYC_DOC_TYPES, KYC_MESSAGES, GST_MESSAGES, CIN_MESSAGES,
    ENCRYPT_DECRYPT_MESSAGES, DEFAULT_KYC_VERIFICATION_APPROVAL_TIME,
    KYC_STATUS, CHANNEL_TYPE, LOGIN_MESSAGES, REDIRECT_ROUTES, ADMIN_MESSAGES,
    ROLES, MATCHING_MESSAGES, TOKEN_TYPES, CONNECTION_STATUS, CONNECTION_MESSAGES,
    CONNECTION_BLOCKING_STATUSES, CONNECTION_REOPENABLE_STATUSES,
    CONNECTION_VALID_TRANSITIONS, SUBSCRIPTION_MESSAGES, CONNECTION_REQUEST_LIMITS, TRIAL_DAYS_LIMITS, TRIAL_CONFIG_LOOKUP_KEYS,
    DEAL_ROOM_STATUS, DEAL_ROOM_MESSAGES, CHAT_MESSAGE_TYPE, CHAT_MESSAGES, SOCKET_EVENTS,
    SESSION_MESSAGES, MEETING_MESSAGES, USER_LIMIT_CONFIG_MESSAGES, USER_LIMIT_DEFAULTS, DEAL_ROOM_STAGES,

    DEAL_ROOM_STAGE_REQUEST_STATUS, DEAL_ROOM_STAGE_MESSAGES, USER_ROLES_CODE, ADMIN_ROLES_CODE,
    DEAL_ROOM_OFFER_STATUS, VALUATION_TYPE, OFFER_CURRENCY, DEAL_ROOM_OFFER_MESSAGES,
    DEAL_ROOM_TERM_SHEET_MESSAGES, FAQ_MESSAGES, PERMISSIONS, USER_TYPES, USER_TYPE_VALUES, ADMIN_USER_TYPES,
    SUBSCRIPTION_PLAN_MESSAGES,
    DATA_TYPES, UNITS, ADMIN_CONFIG_MESSAGES, REDIS_BASE_KEYS, USER_SUSPENSION_MESSAGES,
    ADMIN_MANAGEMENT_MESSAGES, ADMIN_STATUS, ADMIN_ACTIVITY_ACTIONS, ADMIN_PERMISSION_KEYS, DASHBOARD_MESSAGES,
    ADMIN_PROFILE_MESSAGES, ROLE_SWITCH_MESSAGES, ADMIN_USER_DETAIL_MESSAGES, LOGIN_LOCKOUT_LIMITS
};