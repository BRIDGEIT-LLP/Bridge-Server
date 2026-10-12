# Deal Room Archive Feature — Implementation Plan

## Overview

Let a participant archive a deal room from their own view without affecting other participants. Archive state is modeled as a **new per-user junction table** (`deal_room_archive`) rather than columns on `deal_room` itself, so the design isn't hard-coded to today's 2-party (`requester`/`recipient`) shape — it scales to however many participants a deal room ever has, including if deal rooms become multi-party in the future.

`GET /api/v1/deal-rooms` (existing list endpoint) gains an `archived` query filter so the same endpoint serves both "active" and "archived" tabs, scoped to `userId` exactly like it is today.

**Archiving is intentionally one-sided.** If one participant archives a room, only *their* list stops showing it by default — every other participant's list is unaffected until (and unless) they archive it too. Archiving never changes `status`, never closes the room, and never hides it from anyone else; it only changes what the archiving user sees in their own list. This mirrors how archive works in Gmail/WhatsApp-style tools (confirmed as the desired behavior, not shared/mutual archiving where one party could unilaterally hide the room for everyone).

---

## 1. Database Structure

### New table: `deal_room_archive`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | INTEGER | NO | auto | PK |
| `deal_room_id` | UUID | NO | — | FK → `deal_room.id` |
| `user_id` | INTEGER | NO | — | FK → `user.id` — the participant who archived it |
| `archived_at` | DATE | NO | NOW | When this user archived the room |
| `created_at` | DATE | NO | NOW | |
| `created_by` | INTEGER | YES | — | |
| `updated_at` | DATE | YES | — | |
| `updated_by` | INTEGER | YES | — | |
| `is_deleted` | BOOLEAN | YES | false | Kept for consistency with every other model per `CLAUDE.md`; not used by the archive/unarchive flow itself (see below) |
| `deleted_at` | DATE | YES | NULL | |
| `deleted_by` | INTEGER | YES | NULL | |

**Unique constraint**: partial unique index on `(deal_room_id, user_id) WHERE is_deleted = false` — at most one *active* archive record per user per room. Scoping it to `is_deleted = false` (rather than a plain unique constraint) means it only ever blocks a genuine double-archive, never a re-archive after a prior unarchive — see the "row lifecycle" note below for why that distinction matters.

**Row lifecycle: archive → unarchive → archive again must keep working.**
`unarchive` (§3) does a real `DealRoomArchive.destroy(...)`, i.e. a hard delete — so after unarchiving, no row remains for that `(deal_room_id, user_id)` pair, and archiving again later just inserts a fresh one. A plain (non-partial) unique constraint would already tolerate that, since hard-deleted rows are actually gone. The partial index is a safety net against future drift: if someone later changes `unarchive` to a soft-delete (`is_deleted = true`) to match the blanket convention below, a plain unique constraint would leave the old row occupying the key and silently block re-archiving forever — the partial index avoids that trap regardless of which delete strategy `unarchive` ends up using.

**Why a junction table instead of per-side columns on `deal_room`?**
`deal_room` is 2-party today (`requester_user_id`/`recipient_user_id`, `connection_id` unique to a 1:1 `user_connection`), and two nullable columns would technically work for that shape — but they don't generalize. If deal rooms ever support more than two participants, per-side columns would mean another migration (and another column) per new participant slot, whereas `(deal_room_id, user_id)` rows already support any number of participants with no further schema change. The extra cost today is one table and one join in the list query — small, and paid once.

**Why does archive/unarchive use row existence, not `is_deleted`?**
Row existence *is* the archive flag: archive = insert a row, unarchive = delete it. Reusing `is_deleted` to mean "unarchived" would overload the same column with two different meanings (soft-deleted-as-in-removed vs. soft-deleted-as-in-toggled-off), which is confusing to reason about later. The soft-delete columns stay on the model purely for consistency with the rest of the schema (e.g. if the row ever needs to be corrected/removed by an admin tool), but the archive/unarchive endpoints themselves do a real `create`/`destroy`, not a soft-delete toggle.

**Associations to add:**
```
DealRoomArchive → belongsTo DealRoom (deal_room_id, as: 'dealRoom')
DealRoomArchive → belongsTo User (user_id, as: 'user')
DealRoom → hasMany DealRoomArchive (deal_room_id, as: 'archives')
```

One new migration (`sequelize-mig` diff after adding the `DealRoomArchive` model), following the existing `deal_room_stage_request` / `deal_room_message` table pattern. No changes to `deal_room` or any other existing table.

---

## 2. Constants (`src/utils/constant.js`)

Add to `DEAL_ROOM_MESSAGES`:

```js
ARCHIVE_SUCCESS: 'Deal room archived successfully',
ARCHIVE_FAILED: 'Error encountered while archiving deal room',
ALREADY_ARCHIVED: 'Deal room is already archived',
UNARCHIVE_SUCCESS: 'Deal room unarchived successfully',
UNARCHIVE_FAILED: 'Error encountered while unarchiving deal room',
NOT_ARCHIVED: 'Deal room is not archived'
```

No new status enum needed — archived state is derived from row existence in `deal_room_archive`, not a `deal_room.status` value. Archiving is independent of `status` (`Active`/`Closed`); a closed deal room can still be archived/unarchived like any other.

---

## 3. Repository

### New file: `src/repositories/dealRoomArchiveRepository.js`

```js
'use strict';

const { DealRoomArchive } = require('../models');

const findByDealRoomAndUser = async (dealRoomId, userId) => {
    return await DealRoomArchive.findOne({
        where: { deal_room_id: dealRoomId, user_id: userId, is_deleted: false }
    });
};

const archive = async (dealRoomId, userId, { transaction } = {}) => {
    return await DealRoomArchive.create({
        deal_room_id: dealRoomId,
        user_id: userId,
        archived_at: new Date(),
        created_by: userId
    }, { transaction });
};

const unarchive = async (dealRoomId, userId, { transaction } = {}) => {
    return await DealRoomArchive.destroy({
        where: { deal_room_id: dealRoomId, user_id: userId },
        transaction
    });
};

module.exports = { findByDealRoomAndUser, archive, unarchive };
```

### `src/repositories/dealRoomRepository.js` — `findAllByUserId` gets a `LEFT JOIN`

```js
const findAllByUserId = async (userId, roleId, { archived = false } = {}) => {
    return await sequelize.query(
        `SELECT
            dr.id AS deal_room_id,
            ...,
            dra.archived_at

        FROM deal_room dr
        LEFT JOIN deal_room_archive dra
            ON dra.deal_room_id = dr.id AND dra.user_id = :userId AND dra.is_deleted = false
        JOIN user_connection     uc      ON uc.id      = dr.connection_id
        ...
        WHERE dr.is_deleted IS NOT TRUE
          AND (
              (dr.requester_user_id = :userId AND dr.requester_role_id = :roleId)
              OR (dr.recipient_user_id = :userId AND dr.recipient_role_id = :roleId)
          )
          AND dra.archived_at IS ${archived ? 'NOT NULL' : 'NULL'}
        ORDER BY dr.created_at DESC`,
        { replacements: { userId, roleId }, type: QueryTypes.SELECT }
    );
};
```

The `LEFT JOIN` is scoped to `:userId` in its `ON` clause (not a top-level `WHERE`), so it only ever pulls in *this caller's* archive row for each room — another participant's archive record for the same room never leaks into the result. `archived ? 'NOT NULL' : 'NULL'` is interpolated from a fixed internal boolean, never from request input, so there's no injection surface — same reasoning already applied to the rest of this hand-written query.

Exports gain nothing new here (`findAllByUserId`'s signature grows an options param, default `{}`, so any other caller — there are none today — keeps working unchanged).

---

## 4. Service (`src/services/dealRoomService.js`)

```js
const dealRoomArchiveRepository = require('../repositories/dealRoomArchiveRepository');

const getDealRooms = async (userId, roleId, { archived = false } = {}) => {
    try {
        const dealRooms = await dealRoomRepository.findAllByUserId(userId, roleId, { archived });
        return ServiceResponse.success({ data: dealRooms, message: DEAL_ROOM_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const archiveDealRoom = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_FOUND, statusCode: 404 });
        }
        if (!isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const existing = await dealRoomArchiveRepository.findByDealRoomAndUser(dealRoomId, userId);
        if (existing) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.ALREADY_ARCHIVED, statusCode: 400 });
        }

        const created = await dealRoomArchiveRepository.archive(dealRoomId, userId);
        return ServiceResponse.success({ data: created, message: DEAL_ROOM_MESSAGES.ARCHIVE_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.ARCHIVE_FAILED, statusCode: 500 });
    }
};

const unarchiveDealRoom = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_FOUND, statusCode: 404 });
        }
        if (!isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const existing = await dealRoomArchiveRepository.findByDealRoomAndUser(dealRoomId, userId);
        if (!existing) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_ARCHIVED, statusCode: 400 });
        }

        await dealRoomArchiveRepository.unarchive(dealRoomId, userId);
        return ServiceResponse.success({ data: null, message: DEAL_ROOM_MESSAGES.UNARCHIVE_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.UNARCHIVE_FAILED, statusCode: 500 });
    }
};
```

No transaction needed — each action is a single insert/delete against one table with no downstream side effects on `deal_room` or anything else it references (unlike `closeDealRoom`, which mutates `deal_room` itself and is read by other branches of business logic).

`isParticipant` is already exported from this module (also used by the socket handlers per the chat-feature plan) — reused as-is, not duplicated. It stays a 2-party check today (`requester_user_id`/`recipient_user_id`) since `deal_room` itself hasn't gone multi-party — the archive table is what's future-proofed, not `isParticipant`.

---

## 5. Controller (`src/controllers/dealRoomController.js`)

```js
const getDealRooms = async (req, res, next) => {
    try {
        const { userId, roleId } = req;
        const archived = req.query.archived === 'true';

        const result = await dealRoomService.getDealRooms(userId, roleId, { archived });
        ...
    } catch (error) { ... }
};

const archiveDealRoom = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }
        const { userId } = req;

        const result = await dealRoomService.archiveDealRoom(dealRoomId, userId);
        ...
    } catch (error) { ... }
};

const unarchiveDealRoom = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }
        const { userId } = req;

        const result = await dealRoomService.unarchiveDealRoom(dealRoomId, userId);
        ...
    } catch (error) { ... }
};
```

`archived` query parsing follows the same inline, no-Joi-schema convention already used for query params elsewhere (e.g. `meetingController.getMeetingById` parsing `req.query.meetingId`) — anything other than the literal string `'true'` is treated as `false`, so `GET /api/v1/deal-rooms` with no query param keeps returning the active list exactly as it does today (fully backward compatible).

---

## 6. Routes (`src/routes/dealRoomRoutes.js`)

```js
// GET /api/v1/deal-rooms?archived=true — list deal rooms for the logged in user (active by default, archived if ?archived=true)
router.get('/', authMiddleware, dealRoomController.getDealRooms);

// PUT /api/v1/deal-rooms/:dealRoomId/archive — archive a deal room (caller's own view only)
router.put('/:dealRoomId/archive', authMiddleware, dealRoomController.archiveDealRoom);

// PUT /api/v1/deal-rooms/:dealRoomId/unarchive — unarchive a deal room (caller's own view only)
router.put('/:dealRoomId/unarchive', authMiddleware, dealRoomController.unarchiveDealRoom);
```

No request body on either route, so no Joi schema/`validate()` middleware is needed — same shape as `stage-request/pending` (`GET` with just a URL param).

---

## 7. Data Flow

### Archive

```
Client → PUT /api/v1/deal-rooms/:dealRoomId/archive
  ↓ authMiddleware
Controller.archiveDealRoom → dealRoomService.archiveDealRoom(dealRoomId, userId)
  ├─ dealRoomRepository.findById(dealRoomId)                    → 404 if not found/deleted
  ├─ isParticipant(dealRoom, userId)                             → 403 if not a participant
  ├─ dealRoomArchiveRepository.findByDealRoomAndUser(...)         → 400 if a row already exists
  └─ dealRoomArchiveRepository.archive(dealRoomId, userId)
       INSERT INTO deal_room_archive (deal_room_id, user_id, archived_at, created_by) VALUES (...)
  ↓
Controller → HttpResponse.success (200)
```

### List with filter

```
Client → GET /api/v1/deal-rooms?archived=true
  ↓ authMiddleware
Controller.getDealRooms → dealRoomService.getDealRooms(userId, roleId, { archived: true })
  └─ dealRoomRepository.findAllByUserId(userId, roleId, { archived: true })
       Same query as today, plus a LEFT JOIN deal_room_archive scoped to :userId
       and a WHERE dra.archived_at IS NOT NULL
  ↓
Controller → HttpResponse.success (200) — only rooms this user archived
```

Unarchive mirrors archive exactly: looks up the existing row (404/400 if missing), then `dealRoomArchiveRepository.unarchive` deletes it.

---

## 8. Files

### New files

```
src/
├── models/
│   └── DealRoomArchive.js
└── repositories/
    └── dealRoomArchiveRepository.js
```

### Updated existing files

| File | Change |
|------|--------|
| Migration (new, generated) | `npm run migrate:make -- create-deal-room-archive` |
| `src/models/DealRoom.js` | Add `hasMany DealRoomArchive` association only — no new columns |
| `src/utils/constant.js` | Add archive/unarchive messages to `DEAL_ROOM_MESSAGES` |
| `src/repositories/dealRoomRepository.js` | Extend `findAllByUserId` with `{ archived }` option + `LEFT JOIN deal_room_archive` |
| `src/services/dealRoomService.js` | Add `archiveDealRoom`, `unarchiveDealRoom`; extend `getDealRooms` with `{ archived }` option |
| `src/controllers/dealRoomController.js` | Add `archiveDealRoom`, `unarchiveDealRoom`; extend `getDealRooms` to read `?archived=` |
| `src/routes/dealRoomRoutes.js` | Add `PUT /:dealRoomId/archive` and `PUT /:dealRoomId/unarchive` |

No changes to `dealRoomValidation.js` (no request body on either new route), sockets, chat, offers, or term sheets — archiving is purely a list-visibility concern layered on top of the existing deal room.

---

## 9. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| New `deal_room_archive` junction table (`deal_room_id`, `user_id`), not columns on `deal_room` | `deal_room` is 2-party today, but per-side columns don't generalize past that; `(deal_room_id, user_id)` rows scale to any number of participants without another migration if deal rooms ever go multi-party |
| Archive/unarchive is row insert/delete, not an `is_deleted` toggle | Row existence unambiguously *is* the archive flag; reusing `is_deleted` for that would overload it with a second, different meaning (removed vs. archived) |
| Soft-delete columns still present on `DealRoomArchive` | Kept for schema consistency with every other model per `CLAUDE.md`, even though the archive/unarchive flow itself doesn't use them |
| Unique constraint is a **partial** index (`WHERE is_deleted = false`), not a plain one | A plain unique constraint would still work today (unarchive hard-deletes), but breaks re-archiving forever if `unarchive` is ever changed to a soft-delete later; the partial index is correct under either delete strategy |
| Archive/unarchive independent of `deal_room.status` (`Active`/`Closed`) | A closed deal room is still something a user may want to archive/unarchive from their list; no reason to couple the two states |
| `archived` list filter defaults to `false` (unarchived) when the query param is absent | Existing `GET /api/v1/deal-rooms` behavior is preserved exactly for all current callers — fully backward compatible, opt-in only |
| No transaction wrapping archive/unarchive | Single-row insert/delete against one table with no downstream side effects, unlike `closeDealRoom`/`respondStageUpdate` which touch multiple tables |
| `archived` query param parsed inline in the controller, no Joi query schema | Matches the existing convention for query params in this codebase (e.g. `meetingController`), rather than introducing a new `validateQuery()` middleware pattern for a single boolean flag |
| `LEFT JOIN ... ON dra.user_id = :userId`, not a top-level `WHERE` | Keeps the join scoped per-caller so another participant's archive row for the same room never appears in this user's results — required now for correctness even at 2 participants, and is exactly what makes this scale cleanly to N participants later |

---

## 10. Impact on Existing Code

**Small.** One new table + model + repository file; no columns added to `deal_room`, no changes to its associations beyond one `hasMany`. `findAllByUserId`'s new `{ archived }` param defaults to `false`, so the one existing caller (`dealRoomService.getDealRooms`) keeps its current behavior unless it explicitly opts into the archived view. Every other deal-room feature (close, stage requests, offers, term sheets, export, sockets, chat) is untouched.

---

## 11. Future Extensibility

- **Multi-party deal rooms**: if `deal_room` itself ever supports more than two participants (a separate, larger change to `deal_room`'s own schema and `isParticipant`), `deal_room_archive` needs no changes at all — it already supports archiving by any participant, however many there are.
- **Bulk archive**: archive all `Closed` rooms older than N days in one action — a straightforward extension of `dealRoomArchiveRepository.archive` to accept a list of room IDs, not required for MVP.
- **Archive reason/note**: mirrors `deal_room.closed_reason` if ever needed; no current requirement for it.
- **Auto-archive on close**: could insert an archive row automatically for a user when a room they're in transitions to `Closed`, if product wants that later — deliberately *not* coupled today (see §9) so the two stay independent until there's a real requirement.
