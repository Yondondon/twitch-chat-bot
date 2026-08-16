# Implementation Plan: Twitch Chat Bot

**Branch**: `001-twitch-chat-bot` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-twitch-chat-bot/spec.md`

## Summary

A single-channel Twitch bot that lets the broadcaster and moderators manage custom chat commands (add/edit/remove) from chat itself, and lets any viewer invoke those commands, subject to a fixed 10-second global cooldown and 30-second personal cooldown for non-privileged users. The bot connects to Twitch via EventSub over WebSocket (`channel.chat.message`) and the Helix "Send Chat Message" API, authenticating chat replies using the broadcaster's own Twitch account rather than a separate dedicated bot account, and recognizes its own sent messages to avoid reply loops. Commands and cooldown state are persisted in SQLite so they survive restarts. Channel Points redemption tracking is explicitly out of scope for this feature (deferred).

## Technical Context

**Language/Version**: TypeScript 7.x on Node.js 24

**Primary Dependencies**: `@twurple/auth`, `@twurple/api`, `@twurple/eventsub-ws` (Twitch Helix + EventSub WebSocket client), `node:sqlite` built-in module (embedded storage — no third-party dependency)

**Storage**: SQLite (single file, via the built-in `node:sqlite` module) — see data-model.md and research.md §5

**Testing**: `vitest` (unit tests for command parsing/permission/cooldown logic; integration tests with Twurple client calls mocked)

**Target Platform**: Long-running Node.js background process on a single host (developer machine or small VPS) — no server/HTTP surface exposed

**Project Type**: Single project — background service, no frontend (per brief: "simple local/single-process deployment")

**Performance Goals**: Sub-second reply latency from message receipt to chat reply under normal single-channel chat volume (tens of messages/minute); not a high-throughput system

**Constraints**: No public inbound network endpoint required (WebSocket EventSub, outbound-only); must survive process restart without losing commands or cooldown state (FR-015); must recover from Twitch WebSocket disconnects without manual intervention (FR-014, edge cases)

**Scale/Scope**: Single Twitch channel, expected command catalog in the tens, chat concurrency typical of an individual streamer's channel (not partnered-scale, thousands of concurrent chatters)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unpopulated template (no ratified project principles exist yet) — there are no constitution-defined gates to evaluate against. This check is a no-op until the constitution is ratified; no violations to record.

## Project Structure

### Documentation (this feature)

```text
specs/001-twitch-chat-bot/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── chat-command-syntax.md
│   └── twitch-eventsub-helix.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── twitch/
│   ├── eventsub.ts       # WebSocket session lifecycle, subscription registration, reconnect handling
│   ├── auth.ts           # Broadcaster token loading/refresh (Twurple auth provider) — single account, used for both reading and sending chat
│   └── chat.ts           # Sends replies via Helix "Send Chat Message"
├── commands/
│   ├── parser.ts         # Parses incoming chat text into invocation vs. management syntax (contracts/chat-command-syntax.md)
│   ├── permissions.ts    # Broadcaster/moderator role check from message badges (FR-012)
│   ├── cooldown.ts       # Personal/global cooldown checks + state updates (FR-008-010)
│   └── service.ts        # add/edit/remove/invoke orchestration (FR-001-007)
├── storage/
│   ├── db.ts              # SQLite connection + migration runner
│   ├── migrations/        # SQL migration files (commands, command_user_cooldowns)
│   └── commandRepository.ts # Data access for Command / CommandUserCooldown (data-model.md)
├── config.ts              # Env var loading (client id/secret, tokens, channel id)
└── index.ts                # Process entrypoint: wires auth, eventsub, commands, storage together

tests/
├── unit/
│   ├── parser.test.ts
│   ├── permissions.test.ts
│   └── cooldown.test.ts
└── integration/
    └── commandFlow.test.ts  # add → invoke → cooldown → edit → remove, with Twurple client mocked
```

**Structure Decision**: Single Node.js project at the repo root (Option 1 from the template) — there is no frontend/backend split or mobile target, matching the "simple local/single-process deployment" constraint. Code is organized by responsibility (`twitch/` for external API integration, `commands/` for domain logic, `storage/` for persistence) rather than by technical layer, keeping the cooldown/permission/parsing logic testable in isolation from the live Twitch connection (see `tests/unit/`).

## Complexity Tracking

*No constitution gates are defined yet (see Constitution Check above), so no violations require justification.*
