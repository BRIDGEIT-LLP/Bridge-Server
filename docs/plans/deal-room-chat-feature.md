# Deal Room Chat Feature — Implementation Plan

## Overview

Real-time messaging scoped to an existing **Deal Room**. A deal room already has exactly two participants (`requester_user_id`/`requester_role_id` and `recipient_user_id`/`recipient_role_id`), so the chat is 1:1 and reuses the deal room as its authorization boundary — no separate "conversation" or "participants" table is needed. Messages are persisted in Postgres (source of truth) and pushed live over WebSockets (Socket.IO) to whichever participant is currently connected.

In addition to plain text, participants can share **images, documents, audio, video, and links**. Media reuses the existing ClamAV-scan → S3-KMS-upload pipeline already used for KYC/profile files (`src/configs/scan.js`, `src/services/s3.service.js`) rather than building a second upload path.

---

## 1. Database Structure

### New table: `deal_room_message`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | INTEGER | NO | auto | PK |
| `deal_room_id` | INTEGER | NO | — | FK → `deal_room.id` |
| `sender_user_id` | INTEGER | NO | — | FK → `user.id` |
| `sender_role_id` | INTEGER | NO | — | FK → `company_role_master.id` — denormalized from the deal room, same rationale as `deal_room` copying fields from `user_connection` |
| `message` | TEXT | YES | NULL | Text body; NULL for pure media messages with no caption |
| `message_type` | STRING(20) | NO | `'TEXT'` | One of `TEXT`, `IMAGE`, `DOCUMENT`, `AUDIO`, `VIDEO` — see §3 |
| `attachment_s3_key` | STRING | YES | NULL | S3 object key, set for all non-`TEXT` types |
| `attachment_file_name` | STRING | YES | NULL | Original filename |
| `attachment_mime_type` | STRING | YES | NULL | e.g. `image/png`, `application/pdf`, `audio/mpeg`, `video/mp4` |
| `attachment_file_size` | INTEGER | YES | NULL | Bytes |
| `read_at` | DATE | YES | NULL | Set when the *other* participant reads it |
| `created_at` | DATE | NO | NOW | |
| `created_by` | INTEGER | YES | — | |
| `updated_at` | DATE | YES | — | |
| `updated_by` | INTEGER | YES | — | |
| `is_deleted` | BOOLEAN | YES | false | Soft delete (e.g. "delete message") |
| `deleted_at` | DATE | YES | NULL | |
| `deleted_by` | INTEGER | YES | NULL | |

Index: `(deal_room_id, created_at)` — every read path fetches by deal room ordered by time.

**Links get no special column.** A shared link is just a `TEXT` message whose body contains a URL — detected client-side (or by a simple regex in `chatService` for the "has a link" flag used in list previews). No separate upload or storage is needed for links.

**Why one table for text and media instead of splitting them?** They share the same ordering/pagination/read-receipt logic; a `WHERE message_type = 'TEXT'` vs `!= 'TEXT'` filter is enough for any UI that wants to separate them (e.g. a "shared media" tab), matching how `kyc_info` keeps document metadata columns directly on one row rather than a side table.

**Why no separate `chat_participant`/`conversation` table?** The deal room *is* the conversation. Its `status` (`Active`/`Closed`) already gates whether new messages should be allowed, and its `requester_user_id`/`recipient_user_id` already define membership — reusing it avoids duplicating that state.

**Associations to add:**
```
DealRoomMessage → belongsTo DealRoom (deal_room_id, as: 'dealRoom')
DealRoomMessage → belongsTo User (sender_user_id, as: 'sender')
DealRoomMessage → belongsTo CompanyRoleMaster (sender_role_id, as: 'senderRole')
DealRoom → hasMany DealRoomMessage (deal_room_id, as: 'messages')
```

One new migration (`sequelize-mig` diff after adding the model), following the existing `deal_room` / `user_connection` migration pattern. No changes to any existing table.

---

## 2. WebSocket Architecture

**Library**: `socket.io` (new dependency — not currently in `package.json`). Chosen over raw `ws` for built-in room support (maps naturally to "one room per deal room"), automatic reconnection, and namespace/middleware hooks for auth — all of which would otherwise be hand-rolled.

### Server bootstrap change (the one structural change)

`src/app.js` currently does `app.listen(...)` directly on the Express app. Socket.IO needs to attach to a raw `http.Server` instead:

```js
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
require('./sockets')(io); // registers auth middleware + event handlers

server.listen(SERVER_PORT, () => { ... });   // replaces app.listen
```

This is the only edit to existing `app.js` logic — everything else (routes, middleware order, DB connect-on-listen) stays exactly as-is.

### Socket auth (mirrors `authMiddleware`)

A Socket.IO middleware (`io.use(...)`) runs on handshake, reusing `verifyAccessToken` from `src/utils/token.js` (same function `authMiddleware` already calls):

```js
io.use((socket, next) => {
    const token = socket.handshake.auth?.token; // client sends the same Bearer JWT
    try {
        const decoded = verifyAccessToken(token);
        socket.userId = decoded.userId;
        socket.roleId = decoded.roleId;
        socket.companyId = decoded.companyId;
        next();
    } catch (err) {
        next(new Error('Unauthorized'));
    }
});
```

### Rooms & events

One Socket.IO room per deal room: `deal_room:{dealRoomId}`.

| Direction | Event | Payload | Behavior |
|-----------|-------|---------|----------|
| Client → Server | `join_deal_room` | `{ dealRoomId }` | Verify caller is `requester_user_id` or `recipient_user_id` on that deal room (reuse the same `isParticipant` check already written in `dealRoomService.closeDealRoom`) and deal room is not deleted → `socket.join('deal_room:{id}')`; else emit `error` |
| Client → Server | `send_message` | `{ dealRoomId, message }` | Re-check participant + `status === 'Active'` (block sending into a closed deal room) → persist via `chatService.sendMessage` → `io.to('deal_room:{id}').emit('new_message', savedMessage)` |
| Client → Server | `mark_read` | `{ dealRoomId, upToMessageId }` | Bulk-set `read_at` on the other participant's unread messages → emit `messages_read` to the room |
| Client → Server | `typing` / `stop_typing` | `{ dealRoomId }` | Ephemeral, not persisted → `socket.to('deal_room:{id}').emit('typing', { userId })` |
| Client → Server | `leave_deal_room` | `{ dealRoomId }` | `socket.leave(...)` |
| Server → Client | `new_message` | full message row | Broadcast to both participants (whoever is connected) |
| Server → Client | `error` | `{ message }` | Auth/authorization/validation failures |

Every event handler re-validates participation server-side — never trust that "already joined the room" is still valid (e.g. deal room could get closed mid-session).

### Offline delivery

If a participant isn't connected, the message is still written to `deal_room_message` (DB is the source of truth) — they see it via the REST history endpoint next time they open the deal room. No push-notification/offline-queue is in scope here.

---

## 3. Media Sharing

Media (images, documents, audio, video) reuses the existing upload pipeline described in `CLAUDE.md`'s "File Handling Flow": **Multer buffers in memory → ClamAV scan (`localhost:3310`) → S3 upload with KMS encryption**. Today that pipeline is wired only for KYC/profile files (`/api/v1/file/scan-img`, `/scan-document`); chat gets its own multer configs and S3 prefix but calls the same `uploadToS3` / `scanBuffer` functions — no new upload mechanism.

### Why media upload is REST, not a socket event

Binary multipart upload, virus scanning, and S3 upload are all inherently request/response — there's no benefit to shoving that through a socket frame, and Multer/ClamAV/S3 integration already exists as Express middleware. The flow is a **hybrid**: upload over REST, then broadcast the resulting message over the socket, same as any other `new_message`.

### New endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/deal-rooms/:dealRoomId/messages/media` | `multipart/form-data`, field name `media`; behind `authMiddleware` + participant + `status === 'Active'` check |

```
Controller (chatController.uploadMedia)
  ↓ multer (chatMediaUpload.single('media')) — memory storage, per-type size/mime limits (see below)
  ├─ scanBuffer(req.file.buffer)                       → 400 if infected (reuses src/configs/scan.js)
  ├─ classify message_type from req.file.mimetype       → IMAGE | DOCUMENT | AUDIO | VIDEO
  ├─ uploadToS3('chat', buffer, fileName, mimeType, companyId, userId)   → reuses src/services/s3.service.js
  ├─ chatRepository.create({ deal_room_id, sender_user_id, sender_role_id,
  │       message_type, attachment_s3_key, attachment_file_name,
  │       attachment_mime_type, attachment_file_size, message: caption || null })
  └─ io.to('deal_room:{id}').emit('new_message', savedMessage)   — same event as a text message
  ↓
Controller → HttpResponse.success (201)
```

### Allowed types & size limits

New multer configs in `src/configs/scan.js` (alongside the existing `picUpload`/`fileUpload`), one per media class so limits/mime-lists stay independent:

| Type | Allowed mime types | Size limit |
|------|--------------------|-----------|
| `IMAGE` | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | 10 MB |
| `DOCUMENT` | `application/pdf`, `.doc`/`.docx`, `.xls`/`.xlsx`, `.ppt`/`.pptx`, `text/csv`, `text/plain` | 25 MB |
| `AUDIO` | `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/ogg` | 25 MB |
| `VIDEO` | `video/mp4`, `video/webm`, `video/quicktime` | 100 MB |

> **Open question worth deciding before building this**: the existing pipeline buffers the *entire* file in memory (no disk write) before scanning/uploading — fine at 5–10 MB, but a 100 MB video means buffering that much per concurrent upload. Options: (a) keep it simple and raise Node's memory ceiling / cap concurrent uploads, accepting the risk since deal-room usage is low-volume 1:1 chat, or (b) switch chat media specifically to Multer disk storage + streaming upload to S3, which changes the "no disk write" invariant `CLAUDE.md` currently documents. Recommend (a) for an MVP given the low expected concurrency, revisit if usage grows.

### Serving media back

Reuses `getFileBuffer(s3Key)` from `s3.service.js`. Unlike KYC/profile previews, chat media is **not watermarked** — the `Bridge | company | user | date` watermark in `filePreview` exists specifically for KYC document integrity, which doesn't apply to a casually shared product photo or spec sheet. A new `GET /api/v1/deal-rooms/:dealRoomId/messages/:messageId/media` streams the raw buffer (with a participant check) instead of routing through the watermarking `filePreview` endpoint.

### Links

No upload involved — a shared link is a `TEXT` message whose body contains a URL. `chatService` can run a lightweight regex over outgoing text messages to set a `has_link` flag for list/preview purposes; rendering an actual link preview (fetching the target page's title/image) is listed under Future Extensibility, not required for MVP.

---

## 4. REST API (history, read receipts, media, fallback for non-socket clients)

Base path: `/api/v1/deal-rooms/:dealRoomId/messages`, behind `authMiddleware` + the same participant check.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/deal-rooms/:dealRoomId/messages` | Paginated history, `?cursor=&limit=`, ordered by `created_at DESC` |
| PUT | `/api/v1/deal-rooms/:dealRoomId/messages/read` | Marks messages as read (REST equivalent of the `mark_read` socket event, for clients that reconnect and need to catch up) |
| POST | `/api/v1/deal-rooms/:dealRoomId/messages/media` | Upload + scan + store an image/document/audio/video attachment (see §3) |
| GET | `/api/v1/deal-rooms/:dealRoomId/messages/:messageId/media` | Stream a previously uploaded attachment back (participant-checked, unwatermarked) |

Sending a **text** message stays **socket-only** — there's no `POST` for it, matching the "real-time" requirement and avoiding two divergent write paths. Media upload is necessarily REST (see §3), but still ends in the same `new_message` socket broadcast as a text message.

---

## 5. Data Flow

### Join + Send (happy path)

```
Client connects → io.use() auth middleware verifies JWT → socket.userId set
  ↓
Client emits join_deal_room { dealRoomId }
  ↓
chatSocketHandler
  ├─ dealRoomRepository.findById(dealRoomId)     → error if not found/deleted
  ├─ isParticipant check (requester/recipient)   → error if not a participant
  └─ socket.join('deal_room:{id}')
  ↓
Client emits send_message { dealRoomId, message }
  ↓
chatSocketHandler
  ├─ re-check participant + dealRoom.status === 'Active'
  ├─ chatService.sendMessage({ dealRoomId, senderUserId, senderRoleId, message })
  │     └─ chatRepository.create({ deal_room_id, sender_user_id, sender_role_id, message })
  └─ io.to('deal_room:{id}').emit('new_message', savedMessage)
```

### Fetch history — `GET /api/v1/deal-rooms/:dealRoomId/messages`

```
Controller → authMiddleware → participant check (reuse dealRoomService logic)
  ↓
chatService.getMessages(dealRoomId, { cursor, limit })
  └─ chatRepository.findByDealRoomId(dealRoomId, { cursor, limit })
       SELECT * FROM deal_room_message
       WHERE deal_room_id = :dealRoomId AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT :limit
```

### Send media — `POST /api/v1/deal-rooms/:dealRoomId/messages/media`

```
Controller (chatController.uploadMedia)
  ↓ authMiddleware → participant + dealRoom.status === 'Active' check
  ↓ chatMediaUpload.single('media')   [multer, memory storage, per-type limits]
  ↓
chatService.sendMediaMessage({ dealRoomId, senderUserId, senderRoleId, file, caption })
  ├─ scanBuffer(file.buffer)                          → 400 if infected
  ├─ classify message_type from file.mimetype
  ├─ s3Service.uploadToS3('chat', file.buffer, file.originalname, file.mimetype, companyId, senderUserId)
  ├─ chatRepository.create({ deal_room_id, sender_user_id, sender_role_id,
  │       message_type, attachment_s3_key, attachment_file_name,
  │       attachment_mime_type, attachment_file_size, message: caption })
  └─ io.to('deal_room:{id}').emit('new_message', savedMessage)   ← same event text messages use
  ↓
Controller → HttpResponse.success (201)
```

---

## 6. Files

```
src/
├── sockets/
│   ├── index.js                 # creates io.use() auth middleware, wires connection handler
│   └── chatSocketHandler.js     # join_deal_room / send_message / mark_read / typing handlers
├── models/
│   └── DealRoomMessage.js
├── repositories/
│   └── chatRepository.js
├── services/
│   └── chatService.js           # sendMessage, sendMediaMessage, getMessages; also exports isParticipant (moved/shared from dealRoomService)
├── controllers/
│   └── chatController.js        # GET history, PUT mark-read, POST media, GET media
├── routes/
│   └── chatRoutes.js            # mounted at /api/v1/deal-rooms/:dealRoomId/messages
└── validations/
    └── chatValidation.js
```

### Updated existing files

| File | Change |
|------|--------|
| `src/app.js` | Wrap `app` in `http.createServer`, attach Socket.IO, `server.listen` instead of `app.listen` |
| `package.json` | Add `socket.io` dependency |
| `src/utils/constant.js` | Add `CHAT_MESSAGES`, `SOCKET_EVENTS`, `CHAT_MESSAGE_TYPE` |
| `src/services/dealRoomService.js` | Extract the existing `isParticipant` check (currently inline in `closeDealRoom`) into an exported helper so both REST and socket code share one authorization rule |
| `src/configs/scan.js` | Add `chatMediaUpload` multer configs (per-type mime/size limits for image/document/audio/video), reusing the existing `scanBuffer` |
| `src/services/s3.service.js` | No code change — reused as-is; chat just passes a new `'chat'` value for the existing `fileType` param on `uploadToS3` |

Everything else is additive — no changes to `connectionService`, `connectionController`, or any migration/model for `user_connection` or the existing parts of `deal_room`.

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Deal room *is* the conversation — no separate conversation/participant table | Membership and active/closed state already live on `deal_room`; avoids duplicated state |
| Socket.IO over raw `ws` | Built-in rooms map 1:1 to deal rooms; built-in reconnection and middleware hooks for JWT auth |
| DB is the source of truth; socket only broadcasts | A disconnected participant still sees messages via REST history on reconnect — no message loss |
| Sending text is socket-only, no REST `POST` | Keeps a single write path; avoids REST and socket writes racing each other |
| Media upload is REST, not a socket event | Multipart binary + ClamAV scan + S3 upload are inherently request/response; the existing scan/upload middleware is Express-based already |
| Media and text share one `deal_room_message` table (`message_type` column) | Same ordering/pagination/read-receipt logic either way; avoids a second history query path |
| Chat media reuses `uploadToS3`/`scanBuffer` instead of a new pipeline | Same virus-scan + KMS-encrypted-S3 guarantees the KYC/profile flow already has, no duplicated logic |
| Chat media previews are **not** watermarked | The `Bridge / company / user / date` watermark exists for KYC document integrity; irrelevant to a shared chat photo/PDF |
| Every socket event re-validates participant + deal room status | A deal room can be closed mid-session; "already joined the room" must not be trusted indefinitely |
| `sender_role_id` denormalized onto each message | Consistent with how `deal_room` already denormalizes role/company IDs off `user_connection`, avoids a join for role display |

---

## 8. Impact on Existing Code

**Small.** One real structural change: `src/app.js` needs to wrap the Express app in a raw `http.Server` so Socket.IO can attach to it (`http.createServer(app)` + `server.listen(...)` instead of `app.listen(...)`) — everything else in `app.js` (middleware order, route mounting, DB-connect-on-listen) is untouched.

Beyond that:
- One new migration + model (`deal_room_message`) — no existing table is altered.
- One new dependency (`socket.io`).
- A small refactor to pull the participant-authorization check that already exists in `dealRoomService.closeDealRoom` into a shared helper, so the socket layer and REST layer enforce the same rule instead of duplicating it.
- A small addition to `src/configs/scan.js` (new multer configs for chat media) — the existing `picUpload`/`fileUpload` configs used by KYC/profile uploads are untouched.
- `src/services/s3.service.js` needs no changes at all — `uploadToS3`/`getFileBuffer` are already generic over file type/path prefix.
- Everything else (repository/service/controller/routes/validation for chat, and the entire `src/sockets/` module) is new code, following the same layered pattern already used by `connection`/`dealRoom`.

No changes needed to `connectionService`, the connection status state machine, or `dealRoomService.createDealRoom`/`closeDealRoom` logic itself. The one open decision to resolve before building is the memory-buffering-of-large-video-files question raised in §3.

---

## 9. Future Extensibility

- **Thumbnails/previews**: image thumbnails can reuse `sharp` (already a dependency, used for image watermarking); video thumbnails would need a new dependency (e.g. `ffmpeg`) — not required for MVP, client can render a generic video icon until then.
- **Link previews**: fetching a shared URL's title/image/description server-side (Open Graph scraping) for a rich preview card — MVP just detects "this text contains a link," no scraping.
- **Horizontal scaling**: if the app ever runs as more than one Node process, Socket.IO needs a shared adapter so a broadcast from one instance reaches sockets connected to another. `@socket.io/redis-adapter` is a drop-in addition, reusing the existing `ioredis` connection/env vars (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`) already configured for OTP. Not needed for a single-instance deployment.
- **Push notifications**: hook into `new_message` for participants who are offline (out of scope here, would need a device-token table).
- **Unread counts**: `read_at IS NULL` count per deal room, surfaced on `GET /api/v1/deal-rooms` (list endpoint already exists).
- **Media compression/transcoding**: large video/audio uploads could be transcoded to a smaller streaming-friendly format after upload — a background job, not inline with the upload request.
