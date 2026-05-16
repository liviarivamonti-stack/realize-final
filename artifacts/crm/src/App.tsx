import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import SeletorTime from "@/pages/seletor-time";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import ClienteNovo from "@/pages/cliente-novo";
import ClienteDetail from "@/pages/cliente-detail";
import Cobranca from "@/pages/cobranca";
import Metas from "@/pages/metas";
import Perfil from "@/pages/perfil";
import Notificacoes from "@/pages/notificacoes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsTeam } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (needsTeam) return <Redirect to="/seletor-time" />;
  return <>{children}</>;
}

function RequireLiderOrCobrador({ children }: { children: React.ReactNode }) {
  const { papel } = useAuth();
  if (papel === "vendedor") return <Redirect to="/" />;
  return <>{children}</>;
}

function RequireLiderOrVendedor({ children }: { children: React.ReactNode }) {
  const { papel } = useAuth();
  if (papel === "cobrador") return <Redirect to="/" />;
  return <>{children}</>;
}

function AppRouter() {
  const { isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/seletor-time" component={SeletorTime} />

      <Route>
        <RequireAuth>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />

              <Route path="/clientes">
                <RequireLiderOrVendedor><Clientes /></RequireLiderOrVendedor>
              </Route>
              <Route path="/clientes/novo">
                <RequireLiderOrVendedor><ClienteNovo /></RequireLiderOrVendedor>
              </Route>
              <Route path="/clientes/:id">
                <RequireLiderOrVendedor><ClienteDetail /></RequireLiderOrVendedor>
              </Route>

              <Route path="/cobranca">
                <RequireLiderOrCobrador><Cobranca /></RequireLiderOrCobrador>
              </Route>

              <Route path="/metas">
                <RequireLiderOrVendedor><Metas /></RequireLiderOrVendedor>
              </Route>

              <Route path="/perfil" component={Perfil} />
              <Route path="/notificacoes" component={Notificacoes} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="realize-crm-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
