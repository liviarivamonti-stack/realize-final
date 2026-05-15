import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useListNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useLogout,
  getListNotesQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { User, Moon, Sun, Monitor, StickyNote, Plus, Pencil, Trash2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const papelLabel: Record<string, string> = {
  vendedor: "Vendedor",
  cobrador: "Cobrador",
  lider: "Líder",
};

export default function Perfil() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const logout = useLogout();
  const { data: notes, isLoading: notesLoading } = useListNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [showNewNote, setShowNewNote] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: number; texto: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<number | null>(null);

  function handleCreateNote() {
    if (!noteText.trim()) return;
    createNote.mutate(
      { data: { texto: noteText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          toast({ title: "Nota criada!" });
          setShowNewNote(false);
          setNoteText("");
        },
      }
    );
  }

  function handleUpdateNote() {
    if (!editingNote || !noteText.trim()) return;
    updateNote.mutate(
      { id: editingNote.id, data: { texto: noteText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          toast({ title: "Nota atualizada!" });
          setEditingNote(null);
          setNoteText("");
        },
      }
    );
  }

  function handleDeleteNote() {
    if (!deleteNoteId) return;
    deleteNote.mutate(
      { id: deleteNoteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          toast({ title: "Nota removida" });
          setDeleteNoteId(null);
        },
      }
    );
  }

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  }

  const themes = [
    { value: "light" as const, label: "Claro", Icon: Sun },
    { value: "dark" as const, label: "Escuro", Icon: Moon },
    { value: "system" as const, label: "Sistema", Icon: Monitor },
  ];

  return (
    <div className="p-4 pb-24 space-y-6 pt-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Perfil</h1>
        <p className="text-sm text-muted-foreground">Configurações e notas pessoais</p>
      </div>

      {/* User info */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate" data-testid="text-user-nome">{user?.nome}</p>
            <p className="text-sm text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
            <Badge variant="outline" className="mt-1 text-xs" data-testid="badge-user-papel">
              {papelLabel[user?.papel ?? "vendedor"]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Theme selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Aparência</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm",
                  theme === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
                data-testid={`button-theme-${value}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Private notes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Anotações Privadas
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setNoteText(""); setShowNewNote(true); }}
            data-testid="button-new-note"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>

        {notesLoading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-20" />)
        ) : (notes ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <StickyNote className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
              <Button size="sm" variant="outline" onClick={() => { setNoteText(""); setShowNewNote(true); }}>
                Criar anotação
              </Button>
            </CardContent>
          </Card>
        ) : (
          (notes ?? []).map((note) => (
            <Card key={note.id} data-testid={`card-note-${note.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.texto}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.createdAt), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingNote({ id: note.id, texto: note.texto }); setNoteText(note.texto); }}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteNoteId(note.id)}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
        onClick={handleLogout}
        disabled={logout.isPending}
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {logout.isPending ? "Saindo..." : "Sair da conta"}
      </Button>

      {/* New note dialog */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Anotação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Escreva sua nota aqui..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
            data-testid="textarea-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNote(false)}>Cancelar</Button>
            <Button onClick={handleCreateNote} disabled={createNote.isPending} data-testid="button-save-note">
              {createNote.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit note dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Anotação</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
            data-testid="textarea-edit-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)}>Cancelar</Button>
            <Button onClick={handleUpdateNote} disabled={updateNote.isPending} data-testid="button-update-note">
              {updateNote.isPending ? "Salvando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete note confirm */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
