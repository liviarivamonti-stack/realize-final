import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import ClienteNovo from "@/pages/cliente-novo";
import ClienteDetail from "@/pages/cliente-detail";
import Cobranca from "@/pages/cobranca";
import Metas from "@/pages/metas";
import Perfil from "@/pages/perfil";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Spinner while auth loads
function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// Guard: must be logged in
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

// Guard: vendedor cannot access cobrança
function RequireLiderOrCobrador({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.papel === "vendedor") return <Redirect to="/" />;
  return <>{children}</>;
}

// Guard: cobrador cannot access clientes
function RequireLiderOrVendedor({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.papel === "cobrador") return <Redirect to="/" />;
  return <>{children}</>;
}

function AppRouter() {
  const { isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* All protected routes share the Layout (bottom nav) */}
      <Route>
        <RequireAuth>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />

              {/* Clientes – Líder e Vendedor */}
              <Route path="/clientes">
                <RequireLiderOrVendedor>
                  <Clientes />
                </RequireLiderOrVendedor>
              </Route>
              <Route path="/clientes/novo">
                <RequireLiderOrVendedor>
                  <ClienteNovo />
                </RequireLiderOrVendedor>
              </Route>
              <Route path="/clientes/:id">
                <RequireLiderOrVendedor>
                  <ClienteDetail />
                </RequireLiderOrVendedor>
              </Route>

              {/* Cobrança – Líder e Cobrador */}
              <Route path="/cobranca">
                <RequireLiderOrCobrador>
                  <Cobranca />
                </RequireLiderOrCobrador>
              </Route>

              {/* Metas / Ranking – Líder e Vendedor */}
              <Route path="/metas">
                <RequireLiderOrVendedor>
                  <Metas />
                </RequireLiderOrVendedor>
              </Route>

              <Route path="/perfil" component={Perfil} />
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
