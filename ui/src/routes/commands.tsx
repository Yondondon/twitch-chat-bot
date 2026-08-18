import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommandDialog } from "@/components/CommandDialog";
import { api, ApiError, type Command } from "@/lib/api";

export const Route = createFileRoute("/commands")({
  component: CommandsPage,
});

export function CommandsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["auth", "me"], queryFn: api.getMe });
  const { data, isLoading } = useQuery({ queryKey: ["commands"], queryFn: api.getCommands });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<Command | undefined>(undefined);
  const [deletingCommand, setDeletingCommand] = useState<Command | undefined>(undefined);

  const canManage = me?.role === "broadcaster" || me?.role === "moderator";

  const onAuthOrForbidden = (error: unknown) => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      toast.error("You're no longer able to manage commands.");
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      return true;
    }
    return false;
  };

  const createMutation = useMutation({
    mutationFn: api.createCommand,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["commands"] });
      toast.success("Command added.");
    },
    onError: (error) => {
      onAuthOrForbidden(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; trigger: string; replyText: string }) =>
      api.updateCommand(input.id, { trigger: input.trigger, replyText: input.replyText }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["commands"] });
      toast.success("Command updated.");
    },
    onError: (error) => {
      onAuthOrForbidden(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCommand(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["commands"] });
      toast.success("Command removed.");
      setDeletingCommand(undefined);
    },
    onError: (error) => {
      if (!onAuthOrForbidden(error)) {
        toast.error("Couldn't remove the command.");
      }
      setDeletingCommand(undefined);
    },
  });

  const openAddDialog = () => {
    setEditingCommand(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (command: Command) => {
    setEditingCommand(command);
    setDialogOpen(true);
  };

  const handleSubmit = (input: { trigger: string; replyText: string }) => {
    if (editingCommand) {
      return updateMutation.mutateAsync({ id: editingCommand.id, ...input });
    }
    return createMutation.mutateAsync(input);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Commands</h1>
        {canManage && <Button onClick={openAddDialog}>Add command</Button>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Reply text</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.commands.map((command) => (
              <TableRow key={command.id}>
                <TableCell className="font-mono">!{command.trigger}</TableCell>
                <TableCell>{command.replyText}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(command)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingCommand(command)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canManage && (
        <CommandDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          command={editingCommand}
          onSubmit={handleSubmit}
          pending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <AlertDialog open={!!deletingCommand} onOpenChange={(open) => !open && setDeletingCommand(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove !{deletingCommand?.trigger}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The command will stop responding in chat immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCommand && deleteMutation.mutate(deletingCommand.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
