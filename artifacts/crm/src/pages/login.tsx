import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regSenhaConfirm, setRegSenhaConfirm] = useState("");
  const [showRegSenha, setShowRegSenha] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [, setLocation] = useLocation();
  const { checkAuth } = useAuth();
  const { toast } = useToast();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        checkAuth();
        if (data.needs_team) {
          setLocation("/seletor-time");
        } else {
          setLocation("/");
        }
      },
      onError: () => {
        toast({
          title: "Erro no login",
          description: "Email ou senha inválidos. Verifique e tente novamente.",
          variant: "destructive",
        });
      },
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, senha } });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNome.trim() || regNome.trim().length < 2) {
      toast({ title: "Informe seu nome completo", variant: "destructive" });
      return;
    }
    if (!regEmail.includes("@")) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    if (regSenha.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (regSenha !== regSenhaConfirm) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setIsRegistering(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nome: regNome.trim(), email: regEmail, senha: regSenha }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Erro ao criar conta", description: data.error ?? "Tente novamente.", variant: "destructive" });
        return;
      }

      toast({ title: `Bem-vindo(a), ${data.user.nome}!`, description: `Time "${data.team?.nome}" criado automaticamente.` });
      checkAuth();
      setLocation("/");
    } catch {
      toast({ title: "Erro de conexão. Verifique sua internet.", variant: "destructive" });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-6 py-10 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm flex flex-col items-center">
        <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
          <Wallet className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">REALIZE CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? "Acesse sua conta" : "Crie sua conta e seu time"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="flex rounded-xl border bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar conta
          </button>
        </div>

        {mode === "login" && (
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}

        {mode === "register" && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <Label htmlFor="reg-nome">Nome completo</Label>
              <Input id="reg-nome" type="text" autoComplete="name" required value={regNome} onChange={(e) => setRegNome(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" autoComplete="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-senha">Senha</Label>
              <div className="relative">
                <Input id="reg-senha" type={showRegSenha ? "text" : "password"} autoComplete="new-password" required minLength={6} value={regSenha} onChange={(e) => setRegSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                <button type="button" onClick={() => setShowRegSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showRegSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-confirmar">Confirmar senha</Label>
              <Input id="reg-confirmar" type={showRegSenha ? "text" : "password"} autoComplete="new-password" required value={regSenhaConfirm} onChange={(e) => setRegSenhaConfirm(e.target.value)} placeholder="Repita a senha" />
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              Ao criar sua conta, um time pessoal é criado automaticamente. Você pode convidar pessoas ou entrar em outros times depois.
            </div>
            <Button type="submit" className="w-full" disabled={isRegistering}>
              {isRegistering ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
