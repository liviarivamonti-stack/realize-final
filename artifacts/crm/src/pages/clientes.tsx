import { useListClients, ClientStatus } from "@workspace/api-client-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Phone } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Clientes() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "todos">("todos");

  const { data: clients, isLoading } = useListClients({
    search: search.length > 2 ? search : undefined,
    status: statusFilter !== "todos" ? statusFilter : undefined
  });

  const canCreate = user?.papel === 'vendedor' || user?.papel === 'lider';

  return (
    <div className="p-4 pb-20 space-y-4 pt-8 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie sua carteira</p>
        </div>
        {canCreate && (
          <Button size="sm" asChild>
            <Link href="/clientes/novo">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar clientes..." 
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
        {(['todos', 'ativo', 'em_cobranca', 'quitado'] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            className="rounded-full flex-shrink-0"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'todos' ? 'Todos' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (!clients || clients.length === 0) ? (
        <div className="text-center p-12 bg-card rounded-xl border border-dashed">
          <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <Link key={client.id} href={`/clientes/${client.id}`}>
              <Card className="hover-elevate cursor-pointer transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{client.nome}</h3>
                      <div className="flex items-center text-xs text-muted-foreground mt-1 gap-1">
                        <Phone className="h-3 w-3" /> {client.telefone}
                      </div>
                    </div>
                    <Badge variant={
                      client.status === 'ativo' ? 'default' : 
                      client.status === 'em_cobranca' ? 'destructive' : 'secondary'
                    }>
                      {client.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-end mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Contrato</p>
                      <p className="font-medium">{formatCurrency(client.valor_contrato)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Vencimento</p>
                      <p className="font-medium">Dia {client.dia_vencimento}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}