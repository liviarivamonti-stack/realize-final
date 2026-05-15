import { Link, useRoute } from "wouter";
import { Home, Users, Wallet, Target, User } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [isActive] = useRoute(href);
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
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <main className="flex-1 pb-16 overflow-y-auto">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 pb-safe z-50">
        <NavItem href="/" icon={Home} label="Início" />
        <NavItem href="/clientes" icon={Users} label="Clientes" />
        <NavItem href="/cobranca" icon={Wallet} label="Cobrança" />
        <NavItem href="/metas" icon={Target} label="Metas" />
        <NavItem href="/perfil" icon={User} label="Perfil" />
      </nav>
    </div>
  );
}
