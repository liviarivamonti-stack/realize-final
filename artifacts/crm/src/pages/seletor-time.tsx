import { useState } from "react";
import { useLocation } from "wouter";
import { useListTeams, useCreateTeam, useJoinTeam, useSwitchTeam } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Users, Plus, Hash, ChevronRight, Wallet, Sparkles, LogOut } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";

type ViewMode = "list" | "create" | "join";

export default function SeletorTime() {
  const [, setLocation] = useLocation();
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [newTeamNome, setNewTeamNome] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const { data: teamsData, refetch: refetchTeams } = useListTeams();
  const teams = teamsData?.teams ?? [];

  const switchMutation = useSwitchTeam({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        checkAuth();
        setLocation("/");
      },
    },
  });

  const createMutation = useCreateTeam({
    mutation: {
      onSuccess: async (team) => {
        toast({ title: `Time "${team.nome}" criado!` });
        await queryClient.invalidateQueries();
        checkAuth();
        setLocation("/");
      },
      onError: (e: any) => {
        toast({ title: "Erro ao criar time", description: e?.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const joinMutation = useJoinTeam({
    mutation: {
      onSuccess: async (team) => {
        toast({ title: `Entrou no time "${team.nome}"!` });
        await queryClient.invalidateQueries();
        checkAuth();
        setLocation("/");
      },
      onError: (e: any) => {
        toast({ title: "Código inválido", description: e?.message ?? "Time não encontrado.", variant: "destructive" });
      },
    },
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        checkAuth();
        setLocation("/login");
      },
    },
  });

  const roleLabel: Record<string, string> = { lider: "Líder", vendedor: "Vendedor", cobrador: "Cobrador" };
  const roleColor: Record<string, string> = {
    lider: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    vendedor: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    cobrador: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs">Olá,</p>
            <p className="text-white font-bold text-base leading-tight">{user?.nome ?? "..."}</p>
          </div>
        </div>
        <button
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>

      {/* Main card */}
      <div className="flex-1 bg-background rounded-t-3xl px-5 pt-8 pb-10">
        {viewMode === "list" && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground">Seus Times</h1>
              <p className="text-sm text-muted-foreground mt-1">Selecione um time para continuar</p>
            </div>

            {teams.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">Você ainda não tem times.</p>
                <p className="text-muted-foreground text-xs mt-1">Crie um time ou entre com um código de convite.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => switchMutation.mutate({ data: { team_id: team.id } })}
                    disabled={switchMutation.isPending}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                      team.is_active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      team.is_active ? "bg-primary" : "bg-muted"
                    }`}>
                      {team.role === "lider" ? (
                        <Crown className={`h-6 w-6 ${team.is_active ? "text-white" : "text-muted-foreground"}`} />
                      ) : (
                        <Users className={`h-6 w-6 ${team.is_active ? "text-white" : "text-muted-foreground"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground text-sm truncate">{team.nome}</span>
                        {team.is_active && (
                          <span className="flex-shrink-0 text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-semibold">
                            Ativo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleColor[team.role ?? "vendedor"] ?? ""}`}>
                          {roleLabel[team.role ?? "vendedor"] ?? team.role}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{team.invite_code}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setViewMode("create")}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Criar time</span>
              </button>
              <button
                onClick={() => setViewMode("join")}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-foreground">Entrar por código</span>
              </button>
            </div>
          </>
        )}

        {viewMode === "create" && (
          <>
            <button onClick={() => setViewMode("list")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
              ← Voltar
            </button>
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">Criar novo time</h2>
            <p className="text-sm text-muted-foreground mb-6">Você será o líder e poderá convidar outros membros.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Nome do time</label>
                <Input
                  value={newTeamNome}
                  onChange={(e) => setNewTeamNome(e.target.value)}
                  placeholder="Ex: Time de Vendas SP"
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                disabled={createMutation.isPending || !newTeamNome.trim()}
                onClick={() => createMutation.mutate({ data: { nome: newTeamNome.trim() } })}
              >
                {createMutation.isPending ? "Criando..." : "Criar time"}
              </Button>
            </div>
          </>
        )}

        {viewMode === "join" && (
          <>
            <button onClick={() => setViewMode("list")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
              ← Voltar
            </button>
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <Hash className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">Entrar por convite</h2>
            <p className="text-sm text-muted-foreground mb-6">Peça o código de convite ao líder do time.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Código de convite</label>
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: A1B2C3D4"
                  className="font-mono tracking-widest text-lg text-center"
                  maxLength={8}
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                disabled={joinMutation.isPending || inviteCode.length < 4}
                onClick={() => joinMutation.mutate({ data: { invite_code: inviteCode } })}
              >
                {joinMutation.isPending ? "Entrando..." : "Entrar no time"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
