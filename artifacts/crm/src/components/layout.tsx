import { Link, useRoute, useLocation } from "wouter";
import { Home, Users, Wallet, Target, User } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

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

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const papel = user?.papel ?? "vendedor";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <main className="flex-1 pb-16 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 pb-safe z-50">
        {/* Início — todos */}
        <NavItem href="/" icon={Home} label="Início" exact={true} />

        {/* Clientes — líder e vendedor */}
        {(papel === "lider" || papel === "vendedor") && (
          <NavItem href="/clientes" icon={Users} label="Clientes" exact={false} />
        )}

        {/* Cobrança — líder e cobrador */}
        {(papel === "lider" || papel === "cobrador") && (
          <NavItem href="/cobranca" icon={Wallet} label="Cobrança" exact={true} />
        )}

        {/* Metas — líder e vendedor */}
        {(papel === "lider" || papel === "vendedor") && (
          <NavItem href="/metas" icon={Target} label="Metas" exact={true} />
        )}

        {/* Perfil — todos */}
        <NavItem href="/perfil" icon={User} label="Perfil" exact={true} />
      </nav>
    </div>
  );
}
