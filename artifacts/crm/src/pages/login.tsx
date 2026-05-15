import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";

type Papel = "vendedor" | "cobrador" | "lider";

const papelOpcoes: { value: Papel; label: string; descricao: string }[] = [
  { value: "vendedor", label: "Vendedor", descricao: "Gerencia clientes e contratos" },
  { value: "cobrador", label: "Cobrador", descricao: "Gerencia pagamentos e cobrança" },
  { value: "lider", label: "Líder", descricao: "Acesso completo ao sistema" },
];

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");

  // login
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  // register
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regSenha, setRegSenha] = useState("");
  const [regSenhaConfirm, setRegSenhaConfirm] = useState("");
  const [regPapel, setRegPapel] = useState<Papel>("vendedor");
  const [showRegSenha, setShowRegSenha] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [, setLocation] = useLocation();
  const { checkAuth } = useAuth();
  const { toast } = useToast();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        checkAuth();
        setLocation("/");
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nome: regNome.trim(), email: regEmail, senha: regSenha, papel: regPapel }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Erro ao criar conta",
          description: data.error ?? "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Conta criada com sucesso!", description: `Bem-vindo(a), ${data.user.nome}!` });
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
          {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Tab switcher */}
        <div className="flex rounded-xl border bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar conta
          </button>
        </div>

        {/* LOGIN */}
        {mode === "login" && (
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
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
                <button
                  type="button"
                  onClick={() => setShowSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <Label htmlFor="reg-nome">Nome completo</Label>
              <Input
                id="reg-nome"
                type="text"
                autoComplete="name"
                required
                value={regNome}
                onChange={(e) => setRegNome(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-senha">Senha</Label>
              <div className="relative">
                <Input
                  id="reg-senha"
                  type={showRegSenha ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={regSenha}
                  onChange={(e) => setRegSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRegSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showRegSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-confirmar">Confirmar senha</Label>
              <Input
                id="reg-confirmar"
                type={showRegSenha ? "text" : "password"}
                autoComplete="new-password"
                required
                value={regSenhaConfirm}
                onChange={(e) => setRegSenhaConfirm(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>

            {/* Papel / Role selector */}
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <div className="grid gap-2">
                {papelOpcoes.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setRegPapel(op.value)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      regPapel === op.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 bg-transparent"
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      regPapel === op.value ? "border-primary" : "border-muted-foreground"
                    }`}>
                      {regPapel === op.value && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{op.label}</p>
                      <p className="text-xs text-muted-foreground">{op.descricao}</p>
                    </div>
                  </button>
                ))}
              </div>
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
