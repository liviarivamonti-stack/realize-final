import { Link, useLocation } from "wouter";
import { Home, Users, Wallet, Target, User, Bell, ChevronDown, Crown, Plus, Hash, Check } from "lucide-react";
import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useListNotifications, useListTeams, useSwitchTeam } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function NavItem({ href, icon: Icon, label, exact = true }: { href: string; icon: any; label: string; exact?: boolean }) {
  const [location] = useLocation();
  const isActive = exact ? location === href : location.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full text-xs gap-1 transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

function TeamSwitcher() {
  const { user, checkAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: teamsData } = useListTeams();
  const teams = teamsData?.teams ?? [];
  const activeTeam = teams.find(t => t.is_active);

  const switchMutation = useSwitchTeam({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        checkAuth();
        setOpen(false);
      },
    },
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors max-w-[160px]"
      >
        <span className="truncate">{activeTeam?.nome ?? "Início"}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-popover border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seus Times</p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => {
                  if (!team.is_active) switchMutation.mutate({ data: { team_id: team.id } });
                  else setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${team.is_active ? "bg-primary" : "bg-muted"}`}>
                  {team.role === "lider" ? (
                    <Crown className={`h-4 w-4 ${team.is_active ? "text-white" : "text-muted-foreground"}`} />
                  ) : (
                    <Users className={`h-4 w-4 ${team.is_active ? "text-white" : "text-muted-foreground"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{team.nome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{team.role}</p>
                </div>
                {team.is_active && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2 grid grid-cols-2 gap-1">
            <Link
              href="/seletor-time"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar time
            </Link>
            <Link
              href="/seletor-time"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Hash className="h-4 w-4" />
              Entrar
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TopHeader() {
  const { data: notifs } = useListNotifications({ lida: false, limit: 99 });
  const unread = notifs?.length ?? 0;

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-sm border-b border-border z-50 flex items-center justify-between px-4">
      <TeamSwitcher />
      <Link href="/notificacoes" className="relative p-1.5 rounded-lg hover:bg-muted transition-colors">
        <Bell className="h-5 w-5 text-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { papel } = useAuth();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <TopHeader />
      <main className="flex-1 pt-14 pb-16 overflow-y-auto">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 pb-safe z-50">
        <NavItem href="/" icon={Home} label="Início" exact={true} />
        {(papel === "lider" || papel === "vendedor") && (
          <NavItem href="/clientes" icon={Users} label="Clientes" exact={false} />
        )}
        {(papel === "lider" || papel === "cobrador") && (
          <NavItem href="/cobranca" icon={Wallet} label="Cobrança" exact={true} />
        )}
        {(papel === "lider" || papel === "vendedor") && (
          <NavItem href="/metas" icon={Target} label="Metas" exact={true} />
        )}
        <NavItem href="/perfil" icon={User} label="Perfil" exact={true} />
      </nav>
    </div>
  );
}
