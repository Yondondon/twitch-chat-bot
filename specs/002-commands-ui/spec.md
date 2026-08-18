# Feature Specification: Commands Management UI

**Feature Branch**: `[002-commands-ui]`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "I want to add UI for managing commands. Login should be via twitch account. Users can only see the list of command, while broadcaster and moderators could add, edit and remove commands via UI. Commands management via chat should work too."

## Clarifications

### Session 2026-08-18

- Q: Does the command list in the UI need to update live as commands change, or is refresh-to-see-latest acceptable? → A: List is always current as of the last page load; visitor must reload/reopen to see new changes (no push/real-time updates required).
- Q: When checking whether a trigger already exists (for duplicate rejection), is matching case-sensitive or case-insensitive? → A: Case-insensitive — `!Discord` and `!discord` are treated as the same trigger.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Broadcaster/moderator manages commands from a web UI (Priority: P1)

The broadcaster or a moderator signs in to a web dashboard using their Twitch account and adds, edits, or removes custom chat commands through a visual interface, instead of typing chat management syntax.

**Why this priority**: This is the core value of the feature — giving broadcaster/mods a friendlier, more discoverable way to manage commands than raw chat syntax. Without it, the feature delivers no new capability over the existing chat-only management.

**Independent Test**: Sign in as the broadcaster (or a moderator), open the commands dashboard, create a new command with a trigger and reply text, confirm it appears in the list and works when triggered in chat. Edit its reply text and confirm the change is reflected. Remove it and confirm it's gone from both the UI list and chat. Testable independently of chat-based management once sign-in and the dashboard exist.

**Acceptance Scenarios**:

1. **Given** the broadcaster is signed in with their Twitch account, **When** they submit a new command with a trigger and reply text through the UI, **Then** the command is saved and appears in the command list, and is immediately usable in chat.
2. **Given** a moderator is signed in, **When** they edit an existing command's trigger and/or reply text through the UI, **Then** the change is saved and future invocations use the updated values.
3. **Given** a moderator is signed in, **When** they remove a command through the UI, **Then** the command disappears from the list and no longer responds in chat.
4. **Given** a user who is neither the broadcaster nor a moderator (signed in or not), **When** they view the dashboard, **Then** they can see the command list but have no controls to add, edit, or remove commands.
5. **Given** the broadcaster attempts to create a command with a trigger that already exists, **When** they submit the form, **Then** the UI rejects the submission and explains the trigger is already in use, without altering the existing command.

---

### User Story 2 - Anyone views the command list without signing in (Priority: P2)

Any visitor, including someone who has not signed in with Twitch at all, opens the dashboard and browses the current list of custom commands and their reply text, without any ability to modify them.

**Why this priority**: Read access lets any viewer discover available commands without needing to memorize or guess them from chat, improving the bot's usability for the whole audience — and without the friction of requiring sign-in just to look. It depends on the underlying command list existing (User Story 1's data layer) but is independently valuable and testable.

**Independent Test**: Without signing in, open the dashboard and confirm the full list of existing commands and reply text is visible with no add/edit/remove controls present or usable. Separately, confirm the same is true for a signed-in viewer who is neither broadcaster nor moderator.

**Acceptance Scenarios**:

1. **Given** one or more commands exist, **When** an anonymous (not signed-in) visitor opens the dashboard, **Then** they see every command's trigger and reply text.
2. **Given** an anonymous visitor is viewing the dashboard, **When** they inspect the page, **Then** no add, edit, or remove controls are available to them, and no sign-in prompt blocks the list from being viewed.
3. **Given** a signed-in user who is neither broadcaster nor moderator, **When** they view the dashboard, **Then** they see the same read-only command list as an anonymous visitor.
4. **Given** a command was added, edited, or removed (via UI or chat) while a visitor had the dashboard open, **When** the visitor reloads or reopens the dashboard, **Then** they see the current, up-to-date command list; no live/real-time update while the page stays open is required.

---

### User Story 3 - Chat-based command management continues to work unchanged (Priority: P1)

The broadcaster or a moderator continues to add, edit, and remove commands directly from Twitch chat, exactly as before, and those changes are reflected in the web UI.

**Why this priority**: The existing chat-based management (delivered in the prior feature) must not regress when the UI is introduced — both interfaces manage the same underlying command data, and streamers who prefer chat must retain that option.

**Independent Test**: With the UI available, add a command via chat and confirm it appears in the UI's command list; edit and remove it via chat and confirm each change is reflected in the UI without needing to touch the dashboard.

**Acceptance Scenarios**:

1. **Given** the web UI exists, **When** the broadcaster adds a command via chat, **Then** the command appears in the UI's command list.
2. **Given** a command was created via the UI, **When** a moderator edits its reply text via chat, **Then** the UI reflects the updated reply text.
3. **Given** a command was created via chat, **When** the broadcaster removes it via the UI, **Then** it no longer responds in chat.

---

### Edge Cases

- What happens when someone who is not signed in tries to reach the dashboard? They can view the full command list immediately, with no sign-in prompt; sign-in is only requested when they attempt (or the UI offers) an add/edit/remove action.
- What happens when an anonymous visitor tries to add, edit, or remove a command (e.g. by directly invoking a management action without signing in first)? The action is rejected and they are prompted to sign in with Twitch; no command data changes.
- What happens when a moderator is demoted (or a viewer promoted to moderator) while they have the dashboard open? Their next add/edit/remove attempt is evaluated against their current role; if no longer authorized, the action is rejected and edit controls are no longer shown once their session/role is refreshed.
- What happens if two people (e.g. a moderator via UI and the broadcaster via chat) edit or remove the same command at nearly the same time? The system applies changes in the order received; the last write for a given command wins, and no corrupted or duplicate command state results.
- What happens when someone submits a command with an empty trigger or empty reply text via the UI? The submission is rejected with a validation message, and no command is created or altered.
- What happens when a signed-in user's Twitch account is not affiliated with the bot's configured channel at all? They are treated as a regular viewer: read-only access to the command list, no management controls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a web-based interface for viewing and managing custom commands.
- **FR-002**: System MUST allow any visitor to view the full list of existing commands (trigger and reply text) in the UI without requiring sign-in.
- **FR-003**: System MUST require a user to sign in with their Twitch account only when determining their role for the purpose of authorizing a management action (create, edit, or remove); sign-in is not required merely to view the command list.
- **FR-004**: System MUST allow only the broadcaster and moderators to create new commands through the UI, consisting of a trigger and a reply text, after verifying their role via Twitch sign-in.
- **FR-005**: System MUST allow only the broadcaster and moderators to edit the trigger and/or reply text of an existing command through the UI, after verifying their role via Twitch sign-in.
- **FR-006**: System MUST allow only the broadcaster and moderators to remove an existing command through the UI, after verifying their role via Twitch sign-in.
- **FR-007**: System MUST prevent any visitor who is not signed in, or who is signed in but is not the broadcaster or a moderator, from creating, editing, or removing commands through the UI, hiding or disabling those controls for them and prompting sign-in when appropriate.
- **FR-008**: System MUST reject UI attempts to create a command whose trigger already matches (case-insensitively) an existing command, and MUST reject UI attempts to edit a command's trigger to one that already matches (case-insensitively) a different existing command.
- **FR-009**: System MUST reject UI attempts to create or edit a command with an empty trigger or empty reply text.
- **FR-010**: System MUST continue to support adding, editing, and removing commands via chat exactly as before, with the same permission rules (broadcaster/moderators only).
- **FR-011**: System MUST ensure the UI and chat management paths operate on the same underlying command data, so a change made through one path is visible through the other.
- **FR-012**: System MUST NOT require sign-in or any Twitch-account association for a command to be usable by viewers in chat; the sign-in requirement applies only to authorizing management actions in the web UI.

### Key Entities

- **Command**: A streamer-defined chat trigger and its reply text (as introduced in the prior chat-commands feature). The UI reads and writes the same trigger/reply data that chat management already operates on. Trigger matching (for both duplicate detection and invocation) is case-insensitive, so `!Discord` and `!discord` refer to the same command.
- **Dashboard User**: Any visitor to the web UI. Anonymous visitors and those signed in via Twitch can both view commands; a visitor who signs in with their Twitch account is identified by their Twitch identity and assigned a role (broadcaster, moderator, or other) from their current Twitch channel role, which governs whether they can also manage (not just view) commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The broadcaster or a moderator can create, edit, or remove a command through the UI in under 30 seconds per action, without using chat.
- **SC-002**: 100% of commands visible in the UI list match the commands currently usable in chat at any point in time.
- **SC-003**: Any visitor, signed in or anonymous, can view the complete, current command list within a few seconds of opening the dashboard, with no sign-in step required to do so.
- **SC-004**: Visitors who are not the broadcaster or a moderator (whether anonymous or signed in) are never able to successfully create, edit, or remove a command through the UI.
- **SC-005**: Commands added, edited, or removed via chat appear correctly in the UI on next page load/reload (no manual sync step beyond a normal reload), and vice versa.

## Assumptions

- The command list is public within the dashboard: any visitor can view it without signing in. Twitch sign-in exists solely to establish identity/role when a management action (create/edit/remove) is attempted, not as a gate on viewing.
- The UI's edit capability is a superset of chat's: unlike chat management (where changing a trigger means remove-then-add), the UI allows directly renaming a command's trigger in a single edit action, since a form-based interface makes this natural and the underlying data model already supports it.
- The dashboard manages commands for the single Twitch channel the bot is configured for (consistent with the bot's single-channel scope); a signed-in user's role is evaluated against that one channel.
- "Broadcaster and moderators" in the UI carries the same meaning and determination method (current Twitch channel role, not cached) as already established for chat management in the prior feature.
- Session/role freshness: a signed-in user's role is re-checked at least on each management action (create/edit/remove), so a demotion or promotion takes effect without requiring the user to sign out and back in.
- Visual/branding design of the dashboard is not specified and is left to implementation, following standard, accessible web UI conventions.
- No additional dashboard-only settings (e.g. cooldown configuration) are introduced by this feature; scope is limited to command list viewing and add/edit/remove management, matching the prior feature's command entity (trigger, reply text).
