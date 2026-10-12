# User Connection Feature — Implementation Plan

## Overview

A connection system where users can send, accept, and decline connection requests. A connection is **role-scoped** — a user acting as STARTUP connecting to an INVESTOR is a distinct connection from the same user acting as INVESTOR connecting to a STARTUP. When a connection is accepted, a **Deal Room** is automatically created for the two parties.

---

## 1. Database Structure

### Table: `user_connection`

Holds the **current state** of every connection. Always reflects the latest status.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | INTEGER | NO | auto | PK |
| `requester_user_id` | INTEGER | NO | — | FK → `user.id` |
| `requester_role_id` | INTEGER | NO | — | FK → `company_role_master.id` |
| `requester_company_id` | INTEGER | NO | — | FK → `company.id` |
| `recipient_user_id` | INTEGER | NO | — | FK → `user.id` |
| `recipient_role_id` | INTEGER | NO | — | FK → `company_role_master.id` |
| `recipient_company_id` | INTEGER | NO | — | FK → `company.id` |
| `status` | STRING | NO | `'Pending'` | See status lifecycle below |
| `message` | STRING | YES | NULL | Optional intro message from requester |
| `created_at` | DATE | NO | NOW | |
| `created_by` | INTEGER | YES | — | |
| `updated_at` | DATE | YES | — | |
| `updated_by` | INTEGER | YES | — | |
| `is_deleted` | BOOLEAN | YES | false | |
| `deleted_at` | DATE | YES | NULL | |
| `deleted_by` | INTEGER | YES | NULL | |

**Unique constraint**: `(requester_user_id, requester_role_id, recipient_user_id, recipient_role_id)` — prevents duplicate connections for the same role-pair combination.

**Why store both `user_id` and `role_id`?**
A user can hold multiple roles via `company_user_role`. A STARTUP user connecting to an INVESTOR is a different connection than the same user (acting as INVESTOR) connecting to a STARTUP.

**Why store `company_id`?**
Avoids a join through `company_user_role` on every list query.

**Why no `responded_at`?**
Replaced by `user_connection_status_log` — timestamps for every status are stored there, including accept, decline, defer, and withdraw.

**Quota enforcement:**
Since every sent request creates a row that is never hard-deleted, monthly quota is derived directly using the rolling window:
```sql
SELECT COUNT(*) FROM user_connection
WHERE requester_user_id = :userId
  AND created_at >= :windowStart
  AND created_at <  :windowEnd
```
Limits: `FREE = 3`, `PREMIUM = 50` (see `CONNECTION_REQUEST_LIMITS`).

---

### Status Lifecycle

| Status | Set by | Valid previous statuses |
|--------|--------|------------------------|
| `Pending` | System (on creation) | — |
| `Viewed` | Recipient (opens the request) | `Pending` |
| `Accepted` | Recipient | `Pending`, `Viewed`, `Deferred` |
| `Declined` | Recipient | `Pending`, `Viewed`, `Deferred` |
| `Deferred` | Recipient (save for later) | `Pending`, `Viewed` |
| `Withdrawn` | Requester | `Pending`, `Viewed`, `Deferred` |
| `Expired` | System (cron job after X days) | `Pending`, `Viewed`, `Deferred` |

Terminal statuses (no further transitions allowed): `Accepted`, `Declined`, `Withdrawn`, `Expired`.

> On `Accepted` → a Deal Room is automatically created inside the same transaction.

---

### Table: `user_connection_status_log`

Holds the **full history** of every status change. One row per transition. Never updated after insert.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | INTEGER | NO | PK |
| `connection_id` | INTEGER | NO | FK → `user_connection.id` |
| `status` | STRING | NO | The status that was set |
| `changed_by` | INTEGER | NO | FK → `user.id` — who triggered the change |
| `created_at` | DATE | NO | Timestamp of the action |

**Example timeline for a single connection:**

| connection_id | status | changed_by | created_at |
|--------------|--------|------------|------------|
| 1 | Pending | user_5 | 2026-07-01 10:00 |
| 1 | Viewed | user_9 | 2026-07-01 11:30 |
| 1 | Deferred | user_9 | 2026-07-01 12:00 |
| 1 | Accepted | user_9 | 2026-07-02 09:00 |

**Get timestamp of any specific status:**
```sql
SELECT created_at FROM user_connection_status_log
WHERE connection_id = :connectionId AND status = 'Accepted'
```

**Get full timeline of a connection:**
```sql
SELECT status, changed_by, created_at
FROM user_connection_status_log
WHERE connection_id = :connectionId
ORDER BY created_at ASC
```

**Compute response time:**
```sql
SELECT
  MAX(CASE WHEN status = 'Accepted' THEN created_at END) -
  MAX(CASE WHEN status = 'Pending'  THEN created_at END) AS response_time
FROM user_connection_status_log
WHERE connection_id = :connectionId
```

---

### Associations

```
UserConnection → belongsTo User (requester_user_id, as: 'requester')
UserConnection → belongsTo User (recipient_user_id, as: 'recipient')
UserConnection → belongsTo CompanyRoleMaster (requester_role_id, as: 'requesterRole')
UserConnection → belongsTo CompanyRoleMaster (recipient_role_id, as: 'recipientRole')
UserConnection → belongsTo Company (requester_company_id, as: 'requesterCompany')
UserConnection → belongsTo Company (recipient_company_id, as: 'recipientCompany')
UserConnection → hasMany UserConnectionStatusLog (connection_id)

UserConnectionStatusLog → belongsTo UserConnection (connection_id)
UserConnectionStatusLog → belongsTo User (changed_by)
```

---

## 2. API Design

Base path: `/api/v1/connections` — all routes behind `authMiddleware`.

| Method | Path | Caller | Description |
|--------|------|--------|-------------|
| POST | `/` | Requester | Send a connection request |
| PUT | `/change-status` | Requester or Recipient | Generic status change — body: `{ connectionId, status }` |
| GET | `/` | Any user | List all connections (filterable by status) |
| GET | `/received` | Any user | List received requests (filterable by status) |
| GET | `/sent` | Any user | List sent requests (filterable by status) |
| GET | `/:connectionId/timeline` | Any party | Get full status history of a connection |

> `Expired` is set by a system cron job — no API endpoint needed.

**Valid status values for `PUT /change-status`:**

| Status | Who can set it |
|--------|---------------|
| `Viewed` | Recipient |
| `Accepted` | Recipient |
| `Declined` | Recipient |
| `Deferred` | Recipient |
| `Withdrawn` | Requester |

---

## 3. Data Flow

---

### Send Connection Request — `POST /`

```
Controller
  ↓ from body  → recipientUserId, recipientRoleId, message (optional)
  ↓ from req   → userId, roleId, companyId  (JWT — set by authMiddleware)
  ↓
ConnectionService.sendRequest()
  │
  ├─ 1. userRepository.getUserById(recipientUserId)
  │       → 404 if recipient does not exist
  │
  ├─ 2. connectionRepository.findRecipientCompanyUserRole(recipientUserId, recipientRoleId)
  │       → 404 if recipient has no matching role
  │       → also provides recipient's company_id
  │
  ├─ 3. connectionRepository.findExistingConnection(
  │         requesterUserId, requesterRoleId, recipientUserId, recipientRoleId
  │       )
  │       → 409 if a connection already exists for this role pair
  │
  ├─ 4. connectionRepository.create({
  │         requester_user_id, requester_role_id, requester_company_id,
  │         recipient_user_id, recipient_role_id, recipient_company_id,
  │         status: 'Pending', message
  │       })
  │
  └─ 5. connectionStatusLogRepository.create({
            connection_id, status: 'Pending', changed_by: userId
          })
  ↓
Controller → HttpResponse.success (201)
```

---

### Rolling Window Computation (Quota)

The window boundaries are computed from the user's registration date, not the calendar month.

```js
const user = {
    created_at: new Date('2026-02-02T15:05:26.314+05:30')
};

const registrationDate = new Date(user.created_at);
const today = new Date();

const monthsElapsed = Math.floor(
    (today - registrationDate) / (1000 * 60 * 60 * 24 * 30)
);

console.log(monthsElapsed);

const windowStart = new Date(registrationDate);
windowStart.setMonth(windowStart.getMonth() + monthsElapsed);

const windowEnd = new Date(windowStart);
windowEnd.setMonth(windowEnd.getMonth() + 1);

console.log(windowStart, ' to ', windowEnd);
```

Then query:

```sql
SELECT COUNT(*) FROM user_connection
WHERE requester_user_id = :userId
  AND created_at >= :windowStart
  AND created_at <  :windowEnd
```

Compare against `CONNECTION_REQUEST_LIMITS.FREE` (3) or `CONNECTION_REQUEST_LIMITS.PREMIUM` (50) based on subscription status.

**Service helpers available:**
- `getConnectionBillingWindow(userId)` — returns `{ windowStart, windowEnd }` for a given user
- `getConnectionRequestsInWindow(userId, windowStart, windowEnd)` — returns count of requests sent in that window
- `validateConnectionLimit(requestCount, hasActiveSubscription)` — returns error if over limit

---

### Change Status — `PUT /change-status`

Single generic endpoint for all status changes. Status is validated by Joi before reaching the service.

```
Controller
  ↓ from body → connectionId, status
  ↓ from req  → userId  (JWT)
  ↓
ConnectionService.changeStatus({ connectionId, status, userId })
  │
  ├─ 1. connectionRepository.findById(connectionId)
  │       → 404 if not found or is_deleted
  │
  ├─ 2. Validate transition is allowed
  │       CONNECTION_VALID_TRANSITIONS[status] must include connection.status
  │       → 400 if invalid transition
  │
  ├─ 3. Validate caller authorization
  │       Withdrawn  → userId must === requester_user_id  → 403 if not
  │       All others → userId must === recipient_user_id  → 403 if not
  │
  ├─ 4. connectionRepository.updateStatus(connectionId, status)
  │
  ├─ 5. connectionStatusLogRepository.create({
  │         connection_id: connectionId, status, changed_by: userId
  │       })
  │
  └─ 6. If status === 'Accepted':
            dealRoomService.createDealRoom(connection, { transaction })
            → rollback entire transaction if deal room creation fails
  ↓
Controller → HttpResponse.success (200)
```

---

### Expire (System / Cron) — no API endpoint

```
ConnectionService.expireStaleConnections()
  │
  ├─ 1. connectionRepository.findStale()
  │       SELECT * FROM user_connection
  │       WHERE status IN ('Pending', 'Viewed', 'Deferred')
  │         AND created_at < NOW() - INTERVAL 'X days'
  │
  ├─ 2. For each stale connection:
  │       connectionRepository.updateStatus(id, { status: 'Expired' })
  │
  └─ 3. connectionStatusLogRepository.bulkCreate([
            { connection_id, status: 'Expired', changed_by: systemUserId }
          ])
```

---

### Fetch Connections — `GET /`

```sql
SELECT uc.*, requester_u.*, recipient_u.*
FROM user_connection uc
JOIN user requester_u ON requester_u.id = uc.requester_user_id
JOIN user recipient_u ON recipient_u.id = uc.recipient_user_id
WHERE (uc.requester_user_id = :userId OR uc.recipient_user_id = :userId)
  AND uc.is_deleted = false
-- optional: AND uc.status = :status
```

Returns the "other party" as the primary user object with their role info.

---

### Fetch Received / Sent — `GET /received` and `GET /sent`

```sql
-- received
WHERE recipient_user_id = :userId
  AND is_deleted = false
-- optional: AND status = :status

-- sent
WHERE requester_user_id = :userId
  AND is_deleted = false
-- optional: AND status = :status
```

---

### Get Connection Timeline — `GET /:connectionId/timeline`

```sql
SELECT status, changed_by, created_at
FROM user_connection_status_log
WHERE connection_id = :connectionId
ORDER BY created_at ASC
```

---

## 4. Files

```
src/
├── models/
│   ├── UserConnection.js
│   └── UserConnectionStatusLog.js
├── repositories/
│   ├── connectionRepository.js
│   └── connectionStatusLogRepository.js
├── services/
│   └── connectionService.js
├── controllers/
│   └── connectionController.js
├── routes/
│   └── connectionRoutes.js
└── validations/
    └── connectionValidation.js
```

### Updated Existing Files

| File | Change |
|------|--------|
| `src/app.js` | Mounted `connectionRoutes` at `/api/v1/connections` |
| `src/utils/constant.js` | Added `CONNECTION_STATUS`, `CONNECTION_MESSAGES`, `CONNECTION_VALID_TRANSITIONS`, `CONNECTION_REQUEST_LIMITS`, `SUBSCRIPTION_MESSAGES`, `DEAL_ROOM_STATUS`, `DEAL_ROOM_MESSAGES` |

> `src/models/index.js` auto-loads all files in `models/` — no manual registration needed.

---

## 5. Constants (`src/utils/constant.js`)

```js
const CONNECTION_STATUS = {
    PENDING: 'Pending',
    VIEWED: 'Viewed',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    DEFERRED: 'Deferred',
    WITHDRAWN: 'Withdrawn',
    EXPIRED: 'Expired'
};

const CONNECTION_VALID_TRANSITIONS = {
    Viewed:    ['Pending'],
    Accepted:  ['Pending', 'Viewed', 'Deferred'],
    Declined:  ['Pending', 'Viewed', 'Deferred'],
    Deferred:  ['Pending', 'Viewed'],
    Withdrawn: ['Pending', 'Viewed', 'Deferred']
};

const CONNECTION_REQUEST_LIMITS = {
    FREE: 3,
    PREMIUM: 50
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
    REQUEST_FAILED: 'Error encountered while sending connection request'
};

const SUBSCRIPTION_MESSAGES = {
    NO_ACTIVE_SUBSCRIPTION: 'Access denied: No active subscription found',
    SUBSCRIPTION_EXPIRED: 'Access denied: Your subscription has expired',
    SUBSCRIPTION_CHECK_FAILED: 'Error encountered while verifying subscription',
    SUBSCRIPTION_FETCH_FAILED: 'Error encountered while fetching subscription',
    SUBSCRIPTION_FETCH_SUCCESS: 'Subscription fetched successfully'
};

const DEAL_ROOM_STATUS = {
    ACTIVE: 'Active',
    CLOSED: 'Closed'
};

const DEAL_ROOM_MESSAGES = {
    CREATE_SUCCESS: 'Deal room created successfully',
    CREATE_FAILED: 'Error encountered while creating deal room'
};
```

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two tables: `user_connection` + `user_connection_status_log` | `user_connection` gives fast current-status queries; `user_connection_status_log` gives full timing history per status |
| Status transitions validated in service layer | `CONNECTION_VALID_TRANSITIONS` map is the single source of truth; prevents invalid state jumps |
| Status values are capitalized strings (`'Pending'`, `'Accepted'`, etc.) | Consistent with `KYC_STATUS` pattern already in the codebase |
| Role is part of the connection identity | Same user can act as STARTUP or INVESTOR; connections are role-scoped |
| Unique constraint on `(requester_user_id, requester_role_id, recipient_user_id, recipient_role_id)` | Prevents re-sending to the same person in the same role capacity |
| No `responded_at` on `user_connection` | Replaced by `user_connection_status_log` — timestamps for all 7 statuses live there |
| Deal Room created atomically on `Accepted` | Same transaction as the status update — if deal room creation fails, the acceptance is rolled back |
| Quota uses rolling window from registration date | User registered Feb 2 → window is always Feb 2 → Mar 1, not Feb 1 → Feb 28 |
| `Expired` set by cron, not by API | Expiry is a system concern, not a user action |

---

## 7. Future Extensibility

- **Quota enforcement**: `getConnectionBillingWindow`, `getConnectionRequestsInWindow`, `validateConnectionLimit` are already implemented in `connectionService.js` — wire them into `sendRequest` when ready.
- **Subscription-based quota**: `validateConnectionLimit(requestCount, hasActiveSubscription)` already differentiates `FREE` (3) vs `PREMIUM` (50) — connect to a subscription check.
- **Notifications**: After every status change, invoke a `notificationService` to alert the other party.
- **Connection blocking**: Add a `user_block` table; check it before the duplicate check in `sendRequest`.
- **Analytics**: Use `user_connection_status_log` to compute average response time, deferral rates, and conversion rates per role pair.
