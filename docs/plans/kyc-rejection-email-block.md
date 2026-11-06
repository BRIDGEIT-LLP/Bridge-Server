# Block Email After N KYC Rejections (N configurable, default 3) — Change Plan

Status: **proposal, no code changed.** This documents what has to change in `Bridge-Server` (and the touch points in `Bridge-Web`) so that a company whose KYC is rejected N times has its email blocked. **N is configurable (default 3)** and the user is told about their blocking state at sign-in.

---

## 1. Requirement

> If a user's KYC / account is rejected 3 times, that email should get blocked.
>
> Update: the number of rejections (3) must be **configurable**, and the user must be **notified of their blocking state at sign-in**: on the first sign-in after a block, and on every sign-in from the first rejection until KYC is approved.

### Assumptions (confirm before building)

| # | Assumption | Why it matters |
|---|-----------|----------------|
| A1 | "Rejected" means an admin **rejecting the company-level KYC review** (`PUT /admin/kyc/review-action`, `action = reject` → `kycService.updateReviewStatus`). | This is the only place `company.kyc_status` becomes `Rejected`. "KYC" and "account" are the same event in the current code — there is no separate "account rejection". |
| A2 | Per-document rejections (`PUT /admin/kyc/document-action`, `kycService.updateDocumentStatus`) do **not** count. | An admin can reject AADHAR and PAN individually before the final review; counting those would block after one review. |
| A3 | Role-switch rejections (`adminService.updateRoleSwitchStatus`) do **not** count. | They are a different workflow on `company_user_role`, not the registration KYC. |
| A4 | The block is **permanent**. The unblock flow is **out of scope for this phase** and will be designed later (see 3.5). | Until then, lifting a block requires a manual DB change by engineering. |
| A5 | The counter never resets (not on approval, not on time). | Revisit together with the unblock flow. |

---

## 2. How things work today (why a plain counter is not enough)

1. **Registration** — `authController.companyRegistration` rejects an email that already exists in `company` or `user` (`USER_MESSAGES.EMAIL_ALREADY_EXISTS`). `companyRepository.findByEmail` does **not** filter `is_deleted`, so even a soft-deleted company keeps its email reserved.
2. **KYC reject** — `kycService.updateReviewStatus` sets `company.kyc_status = 'Rejected'` and `kyc_rejection_reason`. Nothing is counted.
3. **Resubmission wipes the evidence** — `kycService.createKycInfo` flips `company.kyc_status` from `Rejected` back to `Pending` and clears `kyc_rejection_reason` (and clears `rejection_reason` on each `kyc_info` row). So **the current state cannot be used to infer how many rejections happened.** A dedicated persistent counter is required.
4. **Login** — `authController.login` only checks the password and the *temporary* 15-minute lockout (`failed_login_attempts` / `locked_until`). No concept of a permanent block.
5. **Existing suspension machinery (deliberately NOT reused)** — `adminService.updateUserSuspension` sets `user.is_user_suspended`, writes `user_suspension_history` and caches the user in the suspended-users Redis hash. That is the admin's *suspended users* list. **A KYC block is a different concept and must not appear in, count towards, or be editable from the suspended-users list or its toggle.** The block uses its own table (`blocked_email`) and the existing *session* machinery only to end live sessions (`user_session.is_revoked` + `sessionCacheRepository`), which `authMiddleware` already validates on every request when `SESSION_LIMIT_ENABLED=true`.
6. **Gap: `mfaMiddleware` has no block check.** Routes behind it (`/auth/verify-otp`, `/resend-otp`, `/mfa/*`) run during registration/login, before a full session exists. The block therefore has to be checked there explicitly, otherwise a blocked user holding a pre-block MFA token could complete the OTP step.
7. **Password reset** — `resetPasswordTriggerOtp` / `resetPasswordVerifyOtp` / `resetPassword` only check that the company exists. A blocked user could reset their password and keep trying.

---

## 3. Design

### 3.1 Data model

**`company` — add one column**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `kyc_rejection_count` | INTEGER NOT NULL | `0` | Lifetime number of final KYC rejections. Never decremented by resubmission. |

**New table `blocked_email`** (new model `src/models/BlockedEmail.js`, registered in `models/index.js`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK autoincrement | |
| `email` | STRING NOT NULL | **Normalised** (trimmed, lower-cased). Unique index, partial on `is_deleted = false`. |
| `reason` | STRING NOT NULL | e.g. `KYC_REJECTED_3_TIMES` — store as a constant (`BLOCK_REASONS`). |
| `company_id` | UUID NULL | FK → `company.id`. Nullable so the block survives hard deletion of the company. |
| `user_id` | UUID NULL | FK → `user.id`. |
| `rejection_count` | INTEGER | Snapshot of the count at block time. |
| `rejection_limit` | INTEGER | Snapshot of the configured limit in force when the block was applied (the limit can change later, see 3.7). |
| `blocked_at` | DATE | |
| `blocked_by` | UUID NULL | Admin whose final (limit-reaching) rejection triggered it (system-initiated, so store as audit only). |
| `unblocked_at` | DATE NULL | **Created now, unused until the unblock feature.** Adding columns later would mean a second migration and a model change. |
| `unblocked_by` | UUID NULL | Same — admin who lifted the block. |
| `unblock_reason` | STRING NULL | Same. |
| standard audit + soft-delete fields | | `created_at/by`, `updated_at/by`, `is_deleted`, `deleted_at/by` (match every other model). |

**Meaning of "active block":** a row with `is_deleted = false`. Unblocking = soft-delete the row and fill the `unblocked_*` columns. The row is kept as history, and the partial unique index on `email WHERE is_deleted = false` lets the same email be blocked again later without a conflict. **Every** read (every enforcement check) must use this one definition, via `blockedEmailRepository.findActiveByEmail`, so unblocking never needs to touch the callers.

**Why a separate table instead of only a flag on `company`:** the email must stay blocked even if the company row is deleted, the registration check should be a single indexed lookup that does not depend on joins, and it gives a clean audit/unblock history. `company.is_active` is not suitable — it is never read by login or `authMiddleware` today.

**Email normalisation.** Add one helper (e.g. `normalizeEmail` in `utils/Helper.js`) and use it for every read/write of `blocked_email.email`. Decide whether to also collapse Gmail aliases (`a.b@gmail.com`, `a+x@gmail.com`) — otherwise the block is trivially bypassed with an alias (see Q3). Note `company.company_email` itself is stored un-normalised today, so the block lookup must lower-case the incoming value rather than rely on `company` matching.

### 3.2 Constants (`src/utils/constant.js`)

```js
const KYC_REJECTION_LIMITS = { DEFAULT_MAX_REJECTIONS: 3, MIN: 1, MAX: 10 };  // fallback + validation bounds only; live value comes from config (3.7)
// plus: TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS = 'kyc_max_rejections'
const BLOCK_REASONS = { KYC_REJECTED_MAX: 'KYC_REJECTED_MAX' };
const EMAIL_BLOCK_MESSAGES = {
    BLOCKED: 'This email has been blocked. Please contact support.',
    // never hard-code the number; build the text from the configured limit
    BLOCKED_AFTER_REJECTION: (limit) => `Your KYC was rejected ${limit} times and this account is now blocked. Please contact support.`,
    REJECTION_WARNING: (remaining) => `Your KYC was rejected. ${remaining} attempt(s) remaining before this account is blocked.`,
    CHECK_FAILED: '...'
};
```

Export them from the existing `module.exports`. The limit itself is **not** a constant: it is read from the admin config table (3.7); the constant above is only the fallback and the validation range.

### 3.3 Counting and blocking logic (`kycService.updateReviewStatus`)

On `action === 'reject'`, **inside the existing transaction**:

1. Load the company **with a row lock** (`SELECT … FOR UPDATE`). `companyRepository.getCompanyById` does not accept a transaction today — add an optional `{ transaction, lock }` parameter, or a new `getCompanyForUpdate`.
2. **Idempotency guard:** only count when the previous `kyc_status` was *not* already `Rejected`. Otherwise a double-click, retry, or an admin re-submitting the same rejection burns a strike. (An admin rejecting an already-`Approved` company: decide whether that counts — recommended: yes, count it, but see Q5.)
3. Atomically increment: `UPDATE company SET kyc_rejection_count = kyc_rejection_count + 1 … RETURNING` (same pattern as `incrementFailedLoginAttempts`). New repository fn `incrementKycRejectionCount(companyId, { transaction })`.
4. Read the limit **before opening the transaction** with `adminConfigService.getTrialConfigValue(TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS, KYC_REJECTION_LIMITS.DEFAULT_MAX_REJECTIONS)` (Redis first, then DB, then fallback — the same call `updateReviewStatus` already makes for trial values). If the returned count `>= limit`, call **one** function: `emailBlockService.applyBlock({ email, companyId, userId, reason, blockedBy, rejectionCount, rejectionLimit }, { transaction })`. `kycService` must not contain any block internals. `applyBlock` does:
   - Insert the `blocked_email` row (`blockedEmailRepository.create`), unique-constraint-safe so a concurrent request cannot create a duplicate.
   - Kill existing sessions: `userSessionRepository.revokeAllSessionsByUser(userId, { transaction })`. This is the only enforcement for users who are already signed in (see 3.4 row 5).
   - **Do not** touch `user.is_user_suspended`, `user_suspension_history` or any suspension cache. Blocked users must not show up in the suspended-users list, its dashboard counts (`suspendedUsers`), or the admin suspend/unsuspend toggle. The block is read only from `blocked_email`.
5. Commit.
6. **After commit (best effort):** `sessionCacheRepository.invalidateUser(userId)` so `isSessionJtiValid` cannot serve a stale VALID for a session that was just revoked (the same call `updateUserSuspension` makes for this reason, used here without any suspension state). There is **no** cache for `blocked_email` itself (see 3.4).
   - Send the user a notification email (SendGrid is already wired; see Q6). This is in addition to the sign-in notification in 3.8, which is the guaranteed one.
7. Return an extended response so the admin UI can tell the admin the account is now blocked, e.g. `data: { ...updatedCompany, kycRejectionCount, isEmailBlocked }`.

The existing `approve` branch is unchanged.

### 3.4 Enforcement points

| # | Where | Change |
|---|-------|--------|
| 1 | `authController.companyRegistration` | After the Joi validation and **before** the existing-email check and any OTP is sent, look up `blocked_email`. Return 403 `EMAIL_BLOCK_MESSAGES.BLOCKED`. Must come before `sendOTP` so blocked addresses never get an SMS/email. |
| 2 | `authController.login` | Check the block **after `checkPassword` succeeds** and before the MFA token is issued, and return the blocking-state message (3.8). Checking after the password means the specific message is only shown to someone who proved they own the account, so it does not reveal to a stranger that an email is registered-and-blocked (Q7). A wrong password still gets the generic "Invalid Credentials". |
| 3 | `authController.resetPasswordTriggerOtp`, `resetPasswordVerifyOtp`, `resetPassword` | Reject for blocked emails; otherwise a blocked user can still obtain OTPs and reset credentials. |
| 4 | `mfaMiddleware` (`/auth/verify-otp`, `/resend-otp`, `/mfa/*`) | Add the `blocked_email` check (DB lookup). Without it a blocked user could finish the login OTP step with a token issued before the block. |
| 5 | `authMiddleware` | **No new check and no new per-request cost.** Revoked sessions are already rejected by the existing jti validation (`isSessionJtiValid`, Redis-cached with DB fallback), which covers all authenticated routes (`/file/scan-document`, `/file/save-kyc-info`, build-profile, etc.). This holds only while `SESSION_LIMIT_ENABLED=true` (it is `true` in `.env` and `.env.uat`; confirm production). If that flag is ever turned off, session revocation stops enforcing and the block would need its own per-request check. The user sees a generic 401 mid-session, the web logs them out, and the next sign-in shows the block message (3.8). |
| 6 | `kycService.createKycInfo` | Defence in depth: refuse to accept a resubmission when the company's email is blocked (otherwise a user with a still-valid pre-block token on a multi-instance deploy with a cold cache could resubmit). |
| 7 | `tokenService` refresh path (`authController.updateAccessToken`) | Verify that refresh respects the revoked session / block; a refresh token issued before the block must not mint a new access token. |

**No Redis cache for `blocked_email`.** Every check in the table above runs on a pre-authentication endpoint (registration, login, reset-password, MFA OTP), and those are low-frequency and already rate-limited (OTP cooldown, max resends per hour, login lockout). One indexed lookup on `blocked_email.email` per call is cheap, so `isEmailBlocked` reads Postgres directly. The high-frequency path, every authenticated request, needs no blocked-email lookup at all, because blocking revokes the user's sessions and `authMiddleware` already rejects revoked sessions through its existing Redis-cached jti check. A new sign-in is stopped at login (row 2). Redis can be added later behind `isEmailBlocked` without changing any caller if the load ever justifies it.

### 3.5 Unblocking — deferred, but designed for

**Not built in this phase:** no unblock endpoint, admin UI, or counter-reset logic. The goal is that adding it later is one service function, one endpoint and one button, with **no migration, no change to enforcement points, and no change to caching**.

**Design rules that make this true (apply them in this phase):**

| # | Rule | What it saves later |
|---|------|---------------------|
| U1 | `blocked_email` already has `unblocked_at/by/reason` (3.1). | No second migration. |
| U2 | "Active block" = `is_deleted = false`, read only through `blockedEmailRepository.findActiveByEmail`. Nobody queries the table directly. | Unblock is a soft-delete; every enforcement point (3.4) picks it up automatically. |
| U3 | All block state changes live in `emailBlockService`: `applyBlock` now, `releaseBlock` later. Callers (`kycService`, controllers, middleware) only call `isEmailBlocked` and `applyBlock`. | The unblock endpoint calls one function; nothing else changes. |
| U4 | `blocked_email` has no cache and the block touches no suspension state. The only follow-up cache action is `sessionCacheRepository.invalidateUser`, which unblock does not need (the user simply signs in again). | No cache invalidation design for unblock, and no startup loader to keep correct. |
| U5 | The block is independent of the suspension list. | Unblock never has to untangle a block from an admin suspension of the same user, and the suspend toggle cannot undo a block (or the reverse). |
| U6 | The rejection counter lives on `company` and is only changed through repository functions (`incrementKycRejectionCount` now; a `resetKycRejectionCount` is a one-line addition later). | Reset after unblock is a single update. |
| U7 | Enforcement messages come from `EMAIL_BLOCK_MESSAGES` and the web client reads the block from the error response, not from hard-coded states. | Nothing user-facing changes when blocks start being lifted. |
| U8 | `GET`/admin responses already expose `isEmailBlocked`, `kycRejectionCount` (3.3 step 7). | The admin UI only needs to add the button. |

**Sketch of the future function (for planning only, not to be built now):**

```
emailBlockService.releaseBlock({ email, adminId, reason, resetCounter }, { transaction }):
  1. block = blockedEmailRepository.findActiveByEmail(email)       -> 404 if none
  2. soft-delete block, set unblocked_at/by/reason
  3. (nothing to reverse for sessions: revoked sessions stay revoked, the user signs in again)
  4. if resetCounter: companyRepository.resetKycRejectionCount(companyId)
  5. commit; write AdminActivityLog
```

Plus the endpoint (route, controller, permission constant, role grant) and a button in the admin drawer.

**Until then — manual procedure** (engineering/support): soft-delete the `blocked_email` row (`is_deleted = true`, fill `unblocked_*`), and set `company.kyc_rejection_count = 0`. Nothing else: there is no suspension state or cache to clear, and the user just signs in again.

**To decide when the flow is built:** counter value after unblock (0 or MAX-1), who may unblock (admin vs super admin), and whether to add a blocked-emails list screen.

### 3.7 Configurable rejection limit

Reuse the existing config mechanism instead of building a new one. `kycService` already reads `free_trial_connection_limit` / `free_trial_day` from `trial_config_master` through `adminConfigService.getTrialConfigValue`, which reads Redis first, then the DB, then a fallback.

| Piece | Change |
|-------|--------|
| Config row | New lookup `kyc_max_rejections`, `data_type = integer`, `unit = number`, `value = default_value = '3'`, description "Number of final KYC rejections after which the company email is blocked". Add it to the migration, and as seed rows next to `seed_data/TrialConfigMaster.sql` **and** `seed_data2/12_trial_config_master.sql` (environments are seeded from both). |
| Constant | `TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS = 'kyc_max_rejections'` in `utils/constant.js`. |
| Validation | Add `kyc_max_rejections: Joi.number().integer().min(1).max(10)` to `updateTrialConfigSchema` in `validations/trialConfigValidation.js`. **Minimum 1**: `0` would block on the first rejection and negatives are meaningless. |
| Edit endpoint | None new. `PUT /config/trial-config` (already in `superAdminRoutes.js`) updates the row and refreshes the Redis copy via `cacheTrialConfig`. |
| Admin UI | Add one numeric field to the trial-config settings screen (`src/components/dashboard/system-management/`). Verify whether the screen renders from the returned rows; if it uses a fixed field list, add the new key there. |
| Read path | `kycService.updateReviewStatus` (3.3 step 4) and the code that builds `attemptsRemaining` (3.8) both call `getTrialConfigValue`; the value is also returned to the web client as `maxRejections`. |

**Behaviour when the value changes** (defaults proposed, confirm):

- **Lowered** (e.g. 3 to 2): a company already at 2 rejections is **not** blocked retroactively; it is blocked on its next rejection (`count >= limit` is evaluated only when a rejection happens). A retroactive sweep is out of scope.
- **Raised** (e.g. 3 to 5): already-blocked emails stay blocked (blocks are not re-evaluated); that is what the later unblock flow is for. Companies below the old limit simply get more attempts.
- The limit in force at block time is stored in `blocked_email.rejection_limit`, so the history stays explainable after the setting changes.
- If the config row is missing or malformed, or Redis and the DB both fail, the **fallback is the default 3**, never "no limit".

### 3.8 Telling the user about the blocking state at sign-in

Requirement: the user learns they are blocked (or close to being blocked) **at sign-in**, not by failing pages: immediately after a block, and on every sign-in from the first rejection until KYC is approved.

**Blocked user, first sign-in after the block** (covers users who were offline when blocked and users whose sessions were revoked):

- `POST /auth/login` returns **403** after the password is verified (3.4 row 2) with a stable, machine-readable payload, for example:
  `{ message: BLOCKED_AFTER_REJECTION(limit), data: { isEmailBlocked: true, reason: 'KYC_REJECTED_MAX', kycRejectionCount, maxRejections } }`
- No MFA token cookie is set, so no OTP is sent and the user is not pushed into the OTP step first.
- A user who is **mid-session** when blocked has their sessions revoked, so the next request gets the existing generic 401 from `authMiddleware`'s session check. The refresh token does not help: it reissues the same payload, so the new access token carries the same revoked jti. The web's 401 handling in `src/lib/axios.ts` must log the user out and send them to sign-in, where the first sign-in shows the block message (above). `authMiddleware` is deliberately not changed to look up the block, to keep the per-request path free.

**Not-yet-blocked user with prior rejections** (the warning state):

- **Rule:** include the warning on **every** sign-in while `kyc_rejection_count >= 1` **and** the company is not `Approved`. It starts at the first rejection and stops only when KYC is approved.
- The condition is based on the **counter, not on `kyc_status`**. After a rejection the user resubmits documents and `kycService.createKycInfo` flips the status back to `Pending`; a status-based rule would then stop warning them even though they are still one rejection closer to a block. The counter survives resubmission, so it is the right trigger.
- The login success response (and the profile/KYC-status payloads) carries `kycStatus`, `kycRejectionCount`, `maxRejections` and `attemptsRemaining = maxRejections - kycRejectionCount`. `kycRejectionReason` is included while the status is `Rejected`; while `Pending` (resubmitted, under review) the response still carries the count and attempts remaining so the web can show "Under review. 1 attempt remaining before your account is blocked."
- Stateless: no "already shown" flag, so no extra column. After approval (`kyc_status = 'Approved'`) the warning fields are omitted or flagged inactive, even though the counter keeps its value.
- The existing "Verification Unsuccessful" screen and the verification-status page show the same data. The optional email (Q6) is a complement, not a replacement.

**Confirmed scope:** the user is told (a) on the first sign-in after a block, and (b) on **every** sign-in from the first rejection until KYC is approved. It is not a one-time notice, and not a notice at the user's very first login ever.


### 3.9 Migration

Per `CLAUDE.md`:

1. Edit `models/Company.js` (add `kyc_rejection_count`) and add `models/BlockedEmail.js`.
2. `npm run migrate:make -- add_kyc_rejection_count_and_blocked_email`
3. Review the generated file — the repo has previously hand-edited these (`20260916141404_add_login_lockout_to_company.js`, `scripts/apply-login-lockout-migration.js`).
4. **Backfill:** existing companies currently `Rejected` have no history of how many times. Default to `0`, except set `1` where `kyc_status = 'Rejected'` so a company that is rejected right now is not at zero. Pick and document this.
5. Insert the `kyc_max_rejections` row into `trial_config_master` (3.7); the seed SQL alone does not reach already-deployed environments.
6. `npm run migrate:run`; also update `scripts/sync-develop-schema.js` / UAT sync scripts if they enumerate columns.

---

## 4. Frontend (`Bridge-Web`)

| File | Change |
|------|--------|
| `src/app/registration/page.tsx` | Show the 403 block message from `company-registration`. Don't fall through to a generic "something went wrong" toast. |
| Login page / `src/services/auth.service.ts` | Handle the block response on `/auth/login` and on the reset-password calls. |
| `src/lib/axios.ts` | The 401/403 interceptor: ensure a block response does not trigger a silent token-refresh loop; log the user out and show the message. |
| `src/lib/onboarding-steps.ts`, `/registration/verification-status`, `src/components/dashboard/kyc-status.tsx` | On the "Verification Unsuccessful" screen show how many attempts remain (`maxRejections - kycRejectionCount`, with `maxRejections` returned by the API, never hard-coded) and show the warning on every sign-in and on this screen from the first rejection until approval, with stronger wording when `attemptsRemaining` is 1 (the next rejection blocks the account). Show it in both the `Rejected` and the `Pending`-after-resubmission states (3.8). Requires returning `kycRejectionCount` from `GET /file/get-kyc-docs` (`kycService.getKycInfo` + `fileController`) and from the login/profile payloads (`userRepository` company select, `userService`). |
| `src/components/dashboard/KycReviewDrawer.tsx`, `src/services/admin.service.ts`, `src/types/api.types.ts` | Show prior rejection count in the admin review drawer; before confirming a reject that reaches the limit (`kycRejectionCount + 1 >= maxRejections`), show a confirmation: "This will permanently block <email>." Update the review-action response type. |
| Admin user list / `UserDetailDrawer.tsx` | Show a read-only "Blocked" status (no unblock action in this phase). |

---

## 5. Tests

Follow the existing Jest layout (`src/tests/services`, `controllers`, `repositories`, `middleware`).

- Unblock-readiness: `isEmailBlocked` returns false when the only row is soft-deleted; the same email can be blocked again after a soft-delete (partial unique index).
- `kycService.updateReviewStatus` (default limit 3): 1st/2nd reject → counter increments, no block; 3rd (limit-reaching) reject → `blocked_email` created, sessions revoked, suspension state **not** touched (user absent from the suspended-users list and `suspendedUsers` count); repeated reject of an already-`Rejected` company does not increment; approve does not touch the counter; transaction rolls back (no partial block) when any step fails.
- Concurrency: two simultaneous 3rd-rejects produce exactly one `blocked_email` row.
- `authController.companyRegistration`: blocked email → 403 and **no** `otpService.sendOTP` call; case/whitespace variants of the email are also blocked.
- `authController.login`: correct password + blocked email → 403 with the blocking-state message and **no** MFA token cookie set; wrong password + blocked email → generic "Invalid Credentials" (no leak). Not-blocked user with `kyc_rejection_count >= 1` → login succeeds and the response carries `kycRejectionCount`, `maxRejections`, `attemptsRemaining` on **every** login: while `Rejected` (with reason), while `Pending` after resubmission, and not after `Approved`; a user with count 0 gets no warning.
- Configurable limit: with `kyc_max_rejections = 2` the 2nd rejection blocks; with `5` the 3rd does not; a blocked row stores `rejection_limit`; an invalid or missing config value falls back to the default; the `PUT /config/trial-config` validation rejects `0`, negatives and values above the max.
- Reset-password endpoints: blocked → rejected.
- `mfaMiddleware`: blocked email rejected. Revoked session (after block) → authenticated routes and token refresh both return 401.
- Resubmission after block (`createKycInfo`) refused.
- Update existing `authService.test.js` / `authController.*.test.js` mocks for the new repository.

---

## 6. File-by-file change list

**Server**
- `src/models/Company.js` — `kyc_rejection_count`
- `src/models/BlockedEmail.js` — **new**; `src/models/index.js` — register
- `migrations/<timestamp>_*.js` — **new**, via `migrate:make`
- `src/utils/constant.js` — fallback/bounds, reasons, message builders, `TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS`, permission
- `src/utils/Helper.js` — `normalizeEmail`
- `src/validations/trialConfigValidation.js` — add `kyc_max_rejections`
- `src/seed_data/TrialConfigMaster.sql`, `src/seed_data2/12_trial_config_master.sql` — add the `kyc_max_rejections` row
- `src/services/adminConfigService.js` — no change expected (existing `getTrialConfigValue` / `cacheTrialConfig`); verify the cache refresh picks up the new lookup
- `src/repositories/companyRepository.js` — locked read, `incrementKycRejectionCount`
- `src/repositories/blockedEmailRepository.js` — **new** (`findActiveByEmail`, `create`, `listActive`; soft-delete function added with unblock)
- `src/services/kycService.js` — counting + blocking in `updateReviewStatus`; guard in `createKycInfo`; return count in `getKycInfo`
- `src/services/emailBlockService.js` — **new**; the only place block state changes (`isEmailBlocked`, `applyBlock`). `releaseBlock` is added here later (3.5)
- `src/services/authService.js` — pass-through helpers for the controller
- `src/controllers/authController.js` — registration, login, reset-password checks
- `src/middleware/mfaMiddleware.js` — `blocked_email` check
- `src/services/otp.service.js` — optional: refuse `sendOTP` for blocked recipients as a last line of defence
- `CLAUDE.md` — document the new model, constants and flow

**Web** — files listed in section 4.

---

## 7. Open questions for the product owner

| # | Question | Recommendation |
|---|----------|----------------|
| Q1 | *(Deferred)* Unblock flow: who can unblock, and does the block ever auto-expire? | Decide in the later unblock phase. Block is permanent for now. |
| Q2 | *(Deferred)* Counter value after an unblock; does an **approval** ever reset it? | Decide with the unblock flow. Approval does not reset it for now. |
| Q3 | Treat Gmail dot/plus aliases as the same email? | Yes for `gmail.com`/`googlemail.com`, otherwise the block is trivially bypassed. Low-effort to add in `normalizeEmail`. |
| Q4 | ~~Is "3" fixed or configurable?~~ **Resolved: configurable**, stored in `trial_config_master` (3.7). | Open sub-question: who may edit it (super admin only, as the existing trial-config endpoint is). |
| Q5 | Should rejecting an **already-approved** company count? | Count it (it is an admin decision against that email), but confirm. |
| Q6 | Should the user **also** be emailed (a) at each rejection with attempts remaining, and (b) when blocked? | The in-app notice is already guaranteed on every sign-in (3.8), so the email is an optional extra that reaches users who do not sign in again. If wanted: one template for "rejected, N attempts remaining" and one for "blocked", sent after commit via SendGrid, best effort. |
| Q7 | Does the block message reveal that an email is registered? | **Login: no** — shown only after the password is verified (3.4 row 2). **Registration / reset-password: yes**, those are pre-identity endpoints; use a generic message there if enumeration is a concern. |
| Q8 | Should the same phone number / GST / CIN also be blocked? | Out of scope as written. Without it, the same business can register again with a new email (a new GSTIN/CIN is only enforced as format-valid, uniqueness is not checked today). |

## 8. Known limits of this approach

- Blocking by email only: a determined user can register with a different email. Q8 (phone/GST/CIN) is the extension if that matters.
- Counting is per company, so a company that gets rejected, is deleted and re-registers under the same email is still caught (via `blocked_email`), but under a new email starts at zero.
- `isEmailBlocked` reads the database on every call, so a Redis outage cannot unblock anyone. The authenticated path uses the existing session check, which already falls back to the DB.
