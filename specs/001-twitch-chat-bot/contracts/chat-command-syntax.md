# Contract: Chat Command Management Syntax

This is the interface the broadcaster and moderators use from chat to manage custom commands (FR-001–FR-003), and the interface any viewer uses to invoke one (FR-006). This is an in-chat text contract, not an HTTP API — it must remain stable if a future non-chat management UI is added, since both surfaces read/write the same underlying Command data (FR-011).

## Invoking a command (any user)

```
!<trigger>
```

- `<trigger>` is matched case-insensitively against stored command triggers.
- No arguments are supported in this version — the entire reply is the stored static text.
- Unknown triggers produce no bot reply (spec: "no reply confirms success" pattern also governs unknown triggers — silence, not an error message, to avoid chat noise).

## Managing commands (broadcaster/moderator only)

```
!addcommand <trigger> <reply text...>
!editcommand <trigger> <reply text...>
!delcommand <trigger>
```

- `<trigger>` is the bare command name, without requiring the caller to include the leading `!` that viewers will type to invoke it (the bot stores/matches it consistently either way — leading `!` is stripped if present).
- `<reply text...>` is free text through the end of the message; it is stored verbatim as `reply_text`.
- `!addcommand` on an existing trigger is rejected (FR-005) — bot replies to the moderator/broadcaster with a rejection message; no data changes. Use `!editcommand` instead.
- `!editcommand` / `!delcommand` on a non-existent trigger is rejected — bot replies with a rejection message; no data changes (spec edge case).
- Sent by a non-broadcaster/non-moderator: silently ignored as a management command (no permission-denied reply, to avoid confirming to non-mods which syntax is "management" vs. just an unknown command) — falls through to normal unknown-trigger handling (FR-004).
- These three keywords (`addcommand`, `editcommand`, `delcommand`) are reserved and can never be registered as a custom command trigger (spec edge case on keyword collision).

## Response conventions

- Successful add/edit/delete: bot sends a short chat confirmation (e.g. `Command !discord added.`).
- Rejected add/edit/delete by a broadcaster/moderator (duplicate trigger, trigger not found): bot sends a short rejection reply so the mod/broadcaster gets feedback on their mistake.
- Management syntax sent by a non-broadcaster/non-moderator: no reply at all (treated as an unrecognized/unauthorized message, per FR-004), to avoid leaking management syntax to viewers.
