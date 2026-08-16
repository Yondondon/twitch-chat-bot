# Feature Specification: Twitch Chat Bot

**Feature Branch**: `[001-twitch-chat-bot]`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Product Brief: Twitch Chat Bot — A Twitch bot for a single channel that responds to custom chat commands. Connects via EventSub + Helix API. Supports streamer-defined custom commands manageable via chat (with a future management UI planned). Broadcaster/mods have unrestricted command access and are the only ones who can add/edit/remove commands; other users face personal and global cooldowns. Bot uses a separate dedicated account. Node.js + TypeScript, SQLite storage. Update: Channel Points reward-redemption tracking is deferred to a later version and is out of scope for this feature. Update: cooldowns are static (not per-command configurable) — global cooldown is 10 seconds, personal (per-user) cooldown is 30 seconds. Update: the bot sends chat replies using the broadcaster's own Twitch account instead of a separate dedicated bot account."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage custom commands from chat (Priority: P1)

The broadcaster or a moderator wants to create, update, and remove chat commands (e.g. `!discord`) directly from the Twitch chat, without needing any external tool, so they can respond to common viewer questions automatically.

**Why this priority**: Without the ability to manage commands, the bot has no custom behavior at all — this is the foundational capability the rest of the feature depends on.

**Independent Test**: A moderator sends a chat message that adds a new command with a trigger and reply text; the command becomes usable by chat immediately. The moderator then edits its reply text and later removes it, each change taking effect immediately. Can be fully tested using only chat, without any other feature.

**Acceptance Scenarios**:

1. **Given** no command named `!discord` exists, **When** the broadcaster sends a chat message creating the command with a reply text, **Then** the command is saved and any subsequent `!discord` message in chat receives the configured reply.
2. **Given** a command already exists, **When** a moderator sends a chat message editing its reply text, **Then** future invocations return the updated text.
3. **Given** a command already exists, **When** a moderator sends a chat message removing it, **Then** future invocations of that trigger produce no reply.
4. **Given** a regular viewer (not broadcaster or moderator) sends a chat message attempting to add, edit, or remove a command, **When** the message is processed, **Then** the command list is unchanged and no reply confirms success.

---

### User Story 2 - Viewers use custom commands with cooldowns (Priority: P1)

A viewer types a known command trigger in chat and receives the configured reply, while the broadcaster and moderators can use any command freely and viewers are rate-limited by fixed cooldowns to prevent chat spam.

**Why this priority**: This is the primary viewer-facing value of the bot — command replies are only useful if viewers can actually invoke them, and cooldowns are required for the feature to be usable in a live, high-traffic chat.

**Independent Test**: With an existing command, a viewer triggers it and gets a reply, then immediately triggers it again and gets no reply for 30 seconds (personal cooldown); a different viewer also gets no reply until 10 seconds after the first invocation (global cooldown) has elapsed. Meanwhile a moderator can trigger the same command repeatedly with no restriction. Testable independently once at least one command exists.

**Acceptance Scenarios**:

1. **Given** an existing command, **When** a viewer triggers it and then triggers it again within 30 seconds, **Then** only the first invocation produces a reply (personal cooldown).
2. **Given** an existing command, **When** one viewer triggers it and a different viewer triggers it within 10 seconds of that first invocation, **Then** only the first invocation produces a reply (global cooldown).
3. **Given** an existing command, **When** the broadcaster or a moderator triggers it multiple times in immediate succession, **Then** every invocation produces a reply with no cooldown applied.
4. **Given** a chat message that does not match any known command trigger, **When** it is processed, **Then** the bot produces no reply.

---

### Edge Cases

- What happens when someone tries to add a command whose trigger name already exists? The existing command must not be silently overwritten; the action is rejected or requires an explicit edit instead.
- What happens when someone tries to edit or remove a command that doesn't exist? The action fails without effect and does not create a new command.
- How does the system handle a command trigger that collides with the syntax used for command management itself (e.g. a viewer command named the same as an add/edit/remove keyword)? Management keywords take precedence and cannot be overridden by a custom command trigger.
- How does the system handle the bot losing and regaining connectivity to Twitch? Command management state and cooldown state already recorded are preserved, and the bot resumes receiving new chat messages once reconnected, without needing manual restart.
- What happens when a broadcaster/mod's status changes (e.g. a moderator is demoted) mid-session? Subsequent commands from that user are evaluated against their current role, not a cached one.
- Since the bot now posts replies using the broadcaster's own account, how does the system avoid treating its own replies as new incoming commands? The bot MUST recognize and ignore chat messages it sent itself, so a reply never re-triggers command processing or creates a reply loop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the broadcaster and moderators to create a new custom command consisting of a trigger word/phrase and a text reply, via a chat message.
- **FR-002**: System MUST allow the broadcaster and moderators to edit the text reply of an existing custom command via a chat message.
- **FR-003**: System MUST allow the broadcaster and moderators to remove an existing custom command via a chat message.
- **FR-004**: System MUST reject attempts to create, edit, or remove a command from any chat user who is not the broadcaster or a moderator, leaving existing command data unchanged.
- **FR-005**: System MUST reject attempts to create a command whose trigger already matches an existing command.
- **FR-006**: System MUST allow any chat user to invoke an existing custom command by sending its trigger, receiving the configured text reply in chat.
- **FR-007**: System MUST allow the broadcaster and moderators to invoke any custom command with no cooldown or other restriction.
- **FR-008**: System MUST enforce, for every command, a fixed 30-second personal (per-user) cooldown that prevents a non-broadcaster/non-moderator user from triggering that same command again until 30 seconds have passed since their last invocation of it.
- **FR-009**: System MUST enforce, for every command, a fixed 10-second global cooldown that prevents any non-broadcaster/non-moderator user from triggering that command again until 10 seconds have passed since its last invocation, regardless of which user last triggered it.
- **FR-010**: The personal and global cooldown durations MUST be static, system-wide values (30 seconds and 10 seconds respectively) applied uniformly to every command; they are not configurable per command or per streamer.
- **FR-011**: System MUST store custom command data (trigger, reply text) in a way that is not tied exclusively to chat as the access path, so that a future non-chat interface can read and modify the same commands.
- **FR-012**: System MUST determine a chat user's role (broadcaster, moderator, or other) at the time each message is processed, rather than relying on a cached or stale role.
- **FR-013**: System MUST send all chat replies using the broadcaster's own Twitch account as the bot identity; no separate, dedicated bot account is used or required.
- **FR-014**: System MUST process new chat messages as they occur, without requiring a manual trigger or refresh by the broadcaster.
- **FR-015**: System MUST retain custom commands across bot restarts.
- **FR-016**: System MUST identify chat messages that the bot itself sent (as the broadcaster's account) and MUST NOT process those messages as command invocations or command-management actions, preventing a reply from re-triggering itself or another command.

### Key Entities

- **Command**: A streamer-defined chat trigger and its configuration — trigger text, reply text, and timestamps of last use (overall, and per user) needed to enforce the fixed cooldowns. Created, edited, and removed only by broadcaster/moderators.
- **Chat User**: A participant in the channel's chat, identified by their Twitch identity, with a role (broadcaster, moderator, or other) that determines their command permissions and cooldown treatment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly created custom command is usable by viewers within seconds of being added from chat, with no separate deployment or restart step.
- **SC-002**: Non-broadcaster/non-moderator users are never able to trigger a given command more than once per 30 seconds themselves, or more than once per 10 seconds channel-wide.
- **SC-003**: The broadcaster and moderators can fully manage commands (add, edit, remove) using chat alone, with no external tool required.
- **SC-004**: The bot continues responding to chat commands for the full duration of a multi-hour stream session without requiring manual intervention.
- **SC-005**: Command replies continue to function correctly after the bot restarts, using previously stored data.

## Assumptions

- "Global cooldown" means the cooldown is shared across all non-exempt users for a given command (i.e., the command becomes usable again for anyone only after the global cooldown elapses, in addition to each user's own personal cooldown).
- Editing a command in this spec refers to changing its reply text; renaming a command's trigger is treated as removing the old command and adding a new one.
- Cooldowns are fixed, system-wide values (10-second global, 30-second personal) applied to every command the same way; they are not part of a command's per-command configuration and are not exposed for the streamer to customize in this version.
- Subscriber/VIP chat roles, if present, are treated the same as any other non-broadcaster/non-moderator user for the purposes of command permissions and cooldowns, since the brief only distinguishes broadcaster/mods from everyone else.
- The bot serves exactly one Twitch channel per deployment, consistent with the "single channel" scope in the brief; multi-channel support is out of scope.
- Channel Points reward-redemption tracking is explicitly out of scope for this feature and deferred to a later version; this spec covers custom chat commands only.
- A future, separate management interface (outside chat) for commands is anticipated but out of scope for this feature; this feature only needs to ensure the underlying storage/access design does not preclude it.
- Connectivity, hosting, and storage technology choices described in the brief (event-driven Twitch API integration, single-process deployment, embedded database) are treated as implementation constraints to be honored during planning, not as user-facing requirements in this spec.
- Because the bot now authenticates and posts as the broadcaster's own Twitch account, only one Twitch account/token is required for the bot to operate; no separate bot-account registration, invite, or bot-specific channel permission grant is needed.
- The broadcaster's account already has unrestricted, cooldown-free command access (FR-007); the self-message exclusion in FR-016 is an additional safeguard against reply loops, not a change to the broadcaster's command permissions.
