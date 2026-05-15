import { useAuth } from "@/lib/auth-context";
import { useGetDashboardSummary, useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Award, CheckSquare, Target, Activity, Users, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: tasks, isLoading: isTasksLoading } = useListTasks({
    concluido: false
  });

  if (isSummaryLoading || isTasksLoading) {
    return (
      <div className="p-4 space-y-4 pt-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const pendingTasksCount = tasks?.length || 0;

  return (
    <div className="p-4 pb-20 space-y-6 pt-8 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Olá, {user?.nome?.split(' ')[0]}</h1>
        <p className="text-muted-foreground text-sm">Aqui está o seu resumo de hoje.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium opacity-90 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Comissões
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {formatCurrency((summary?.comissao_mes || 0) + (summary?.bonus || 0))}
            </div>
            <p className="text-xs opacity-80 mt-1">
              Bônus: {formatCurrency(summary?.bonus || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" /> Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">
              {summary?.ranking_position ? `${summary.ranking_position}º` : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Posição atual
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center p-3 bg-card border rounded-xl text-center">
          <Users className="h-5 w-5 text-primary mb-1" />
          <span className="text-lg font-semibold">{summary?.clientes_ativos || 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ativos</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-card border rounded-xl text-center">
          <CheckSquare className="h-5 w-5 text-green-500 mb-1" />
          <span className="text-lg font-semibold">{summary?.parcelas_pagas_mes || 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pagas</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-card border rounded-xl text-center">
          <AlertCircle className={cn("h-5 w-5 mb-1", (summary?.parcelas_atrasadas || 0) > 0 ? "text-accent" : "text-muted-foreground")} />
          <span className="text-lg font-semibold">{summary?.parcelas_atrasadas || 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Atrasos</span>
        </div>
      </div>

      {pendingTasksCount > 0 && (
        <Card className="border-l-4 border-l-accent">
          <CardHeader className="p-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              Tarefas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Você tem {pendingTasksCount} tarefa{pendingTasksCount > 1 ? 's' : ''} para hoje.
            </p>
            <Link href="/metas" className="text-sm font-medium text-primary hover:underline">
              Ver tarefas
            </Link>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" /> Atividade Recente
        </h2>
        
        {(!summary?.recent_events || summary.recent_events.length === 0) ? (
          <div className="text-center p-8 bg-card rounded-xl border border-dashed">
            <p className="text-muted-foreground text-sm">Nenhuma atividade recente.</p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {summary.recent_events.map((event, i) => (
              <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {event.tipo === 'venda_fechada' && <DollarSign className="h-4 w-4 text-primary" />}
                  {event.tipo === 'parcela_paga' && <CheckSquare className="h-4 w-4 text-green-500" />}
                  {event.tipo === 'atraso' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {event.tipo === 'renovacao' && <Activity className="h-4 w-4 text-accent" />}
                  {(event.tipo === 'follow_up' || event.tipo === 'anotacao') && <Users className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{event.client_nome}</span>
                    <time className="text-xs text-muted-foreground">
                      {format(new Date(event.data), "dd/MM HH:mm")}
                    </time>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.tipo.replace('_', ' ')}
                    {event.observacao ? ` - ${event.observacao}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}