# Data Model: Twitch Chat Bot

## Entity: Command

Represents a streamer-defined chat trigger and its reply, per spec Key Entities and FR-001–FR-011.

| Field              | Type      | Notes                                                                 |
|--------------------|-----------|------------------------------------------------------------------------|
| `id`               | integer, PK, autoincrement | Internal identifier.                                   |
| `trigger`          | text, unique, not null | The chat keyword that invokes the command (e.g. `!discord`). Case-insensitive uniqueness (FR-005). |
| `reply_text`       | text, not null | The configured text sent back in chat on invocation (FR-001, FR-006). |
| `created_by`       | text, not null | Twitch user ID of the broadcaster/moderator who created it.           |
| `created_at`       | text (ISO 8601), not null | Set on creation.                                        |
| `updated_at`       | text (ISO 8601), not null | Updated on any edit (FR-002).                            |
| `global_last_used_at` | text (ISO 8601), nullable | Timestamp of the most recent non-exempt invocation of this command, used to enforce the fixed 10s global cooldown (FR-009). Null until first non-exempt use. |

**Validation rules**:
- `trigger` must be non-empty and unique across all commands (case-insensitive) — enforced at creation (FR-005).
- `reply_text` must be non-empty.
- Only broadcaster/moderator-originated write operations may create, update, or delete rows (enforced in the application layer per FR-004, not by the schema).

**Lifecycle**: created by FR-001, mutated in place by FR-002 (edit reply text, `updated_at` bumped), deleted by FR-003. No soft-delete requirement in the spec — remove is a hard delete.

## Entity: CommandUserCooldown

Tracks the fixed 30-second personal cooldown per (command, user) pair, per FR-008.

| Field           | Type      | Notes                                                        |
|-----------------|-----------|----------------------------------------------------------------|
| `command_id`    | integer, FK → Command.id | Part of composite primary key.                 |
| `user_id`       | text      | Twitch user ID of the invoking chatter. Part of composite primary key. |
| `last_used_at`  | text (ISO 8601), not null | Timestamp of that user's most recent non-exempt invocation of this command. |

**Primary key**: (`command_id`, `user_id`).

**Validation rules**:
- Only written for non-broadcaster/non-moderator invocations (FR-007 exempts broadcaster/mods entirely — no row is created or checked for them).
- Row is upserted (inserted or its `last_used_at` updated) only when an invocation is allowed to proceed (i.e., not currently blocked by either cooldown).

**Lifecycle**: Row is deleted (cascade) when its parent `Command` is removed (FR-003) — there is no reason to retain per-user cooldown state for a command that no longer exists.

## Relationships

- `Command` 1 — N `CommandUserCooldown` (one command has zero or more per-user cooldown records; each cooldown record belongs to exactly one command). `ON DELETE CASCADE` from `Command.id`.

## Out of scope for this data model

- Any table for Channel Points redemptions — explicitly deferred (see spec Assumptions).
- Any table for command cooldown *configuration* — cooldowns are fixed constants in application code (FR-010), not stored per command.
- Any persisted "Chat User" entity — role (broadcaster/moderator/other) is read live from each incoming chat message's badge data (see research.md §4) and is never cached in storage.
