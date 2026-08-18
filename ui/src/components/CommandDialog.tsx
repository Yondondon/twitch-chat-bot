import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiError, Command } from "@/lib/api";

interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing command; absent when creating one. */
  command?: Command;
  onSubmit: (input: { trigger: string; replyText: string }) => Promise<unknown>;
  pending: boolean;
}

/** Add/edit form for a command — trigger rename is allowed directly, matching the UI's superset-of-chat edit semantics (data-model.md). */
export function CommandDialog({ open, onOpenChange, command, onSubmit, pending }: CommandDialogProps) {
  const [trigger, setTrigger] = useState("");
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTrigger(command?.trigger ?? "");
      setReplyText(command?.replyText ?? "");
      setError(null);
    }
  }, [open, command]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await onSubmit({ trigger: trigger.trim(), replyText: replyText.trim() });
      onOpenChange(false);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.body?.error === "duplicate_trigger") {
        setError("A command with that trigger already exists.");
      } else if (apiError.body?.error === "validation" || apiError.body?.error === "reserved_trigger") {
        setError("Trigger and reply text can't be empty, and the trigger can't be a reserved name.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{command ? "Edit command" : "Add command"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="trigger">Trigger</Label>
              <Input
                id="trigger"
                value={trigger}
                onChange={(event) => setTrigger(event.target.value)}
                placeholder="discord"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="replyText">Reply text</Label>
              <Input
                id="replyText"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Join us: https://discord.gg/example"
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {command ? "Save changes" : "Add command"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
