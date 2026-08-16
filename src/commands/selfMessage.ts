const TRACK_DURATION_MS = 30_000;

/**
 * Tracks message IDs the bot has just sent so they can be recognized and
 * skipped if they come back through EventSub (FR-016) — necessary now that
 * the bot sends and receives chat as the same (broadcaster) account.
 */
export class SelfMessageTracker {
  private readonly sentMessageIds = new Set<string>();

  track(messageId: string): void {
    this.sentMessageIds.add(messageId);
    setTimeout(() => this.sentMessageIds.delete(messageId), TRACK_DURATION_MS).unref();
  }

  isOwnMessage(messageId: string): boolean {
    return this.sentMessageIds.has(messageId);
  }
}
