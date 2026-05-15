import { useState } from "react";
import {
  useGetMyRanking,
  useGetRanking,
  useListTasks,
  useCreateTask,
  useCompleteTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetMyRankingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Plus, Trash2, Trophy, Medal, Award, Target, Calendar, ListTodo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const META_MENSAL = 20000;

export default function Metas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: myRanking, isLoading: rankingLoading } = useGetMyRanking({});
  const { data: fullRanking, isLoading: fullRankingLoading } = useGetRanking({});
  const { data: tasks, isLoading: tasksLoading } = useListTasks({});
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitulo, setNewTaskTitulo] = useState("");
  const [newTaskData, setNewTaskData] = useState(new Date().toISOString().split("T")[0]);
  const [newTaskTipo, setNewTaskTipo] = useState<"followup" | "lembrete" | "pessoal">("pessoal");
  const [taskFilter, setTaskFilter] = useState<"all" | "pendente" | "concluido">("pendente");

  function handleComplete(id: number) {
    completeTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Tarefa concluída!" });
        },
      }
    );
  }

  function handleDelete(id: number) {
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Tarefa removida" });
        },
      }
    );
  }

  function handleCreateTask() {
    if (!newTaskTitulo.trim()) return;
    createTask.mutate(
      { data: { titulo: newTaskTitulo, data: newTaskData, tipo: newTaskTipo } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Tarefa criada!" });
          setShowNewTask(false);
          setNewTaskTitulo("");
        },
      }
    );
  }

  const filteredTasks = tasks?.filter((t) => {
    if (taskFilter === "pendente") return !t.concluido;
    if (taskFilter === "concluido") return t.concluido;
    return true;
  }) ?? [];

  const top3 = (fullRanking ?? []).slice(0, 3);

  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  const podiumIcons = [Medal, Trophy, Award];
  const podiumColors = ["text-slate-400", "text-amber-400", "text-amber-600"];
  const podiumHeights = ["h-20", "h-28", "h-16"];

  const tipoLabel = { followup: "Follow-up", lembrete: "Lembrete", pessoal: "Pessoal" };
  const tipoColor: Record<string, string> = {
    followup: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    lembrete: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    pessoal: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <div className="p-4 pb-24 space-y-6 pt-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Metas</h1>
        <p className="text-sm text-muted-foreground">Desempenho e tarefas</p>
      </div>

      {/* Commission & Progress */}
      {rankingLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-primary to-primary/30" style={{ width: `${myRanking?.meta_progress ?? 0}%`, transition: "width 1s ease" }} />
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Meta do mês</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(myRanking?.total_vendas ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">de {formatCurrency(META_MENSAL)}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  {Math.round(myRanking?.meta_progress ?? 0)}%
                </div>
                <p className="text-xs text-muted-foreground">concluído</p>
              </div>
            </div>
            <Progress value={myRanking?.meta_progress ?? 0} className="h-2" data-testid="progress-meta" />
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Comissão</p>
                <p className="font-semibold text-foreground">{formatCurrency(myRanking?.comissao ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bônus</p>
                <p className="font-semibold text-amber-500">{formatCurrency(myRanking?.bonus ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-green-600">{formatCurrency(myRanking?.total_comissao ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking Podium */}
      {!fullRankingLoading && top3.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Ranking do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-center gap-3 mb-4 pt-2">
              {podiumOrder.map((entry, i) => {
                if (!entry) return null;
                const origPos = entry.posicao - 1;
                const Icon = podiumIcons[origPos] ?? Award;
                const color = podiumColors[origPos] ?? "text-slate-400";
                const height = podiumHeights[i];
                return (
                  <div key={entry.user_id} className="flex flex-col items-center gap-1">
                    <Icon className={cn("h-5 w-5", color)} />
                    <div className={cn("w-16 rounded-t-lg bg-muted flex items-end justify-center pb-2", height)}>
                      <span className="text-xs font-bold text-foreground">{entry.posicao}º</span>
                    </div>
                    <p className="text-xs font-medium text-foreground text-center max-w-[70px] truncate">{entry.nome.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(entry.total_vendas)}</p>
                  </div>
                );
              })}
            </div>
            {(fullRanking ?? []).slice(3).map((entry) => (
              <div key={entry.user_id} className="flex items-center justify-between py-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-6 text-center">{entry.posicao}º</span>
                  <span className="text-sm font-medium text-foreground">{entry.nome}</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatCurrency(entry.total_vendas)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tarefas
          </h2>
          <Button size="sm" onClick={() => setShowNewTask(true)} data-testid="button-new-task">
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>

        <div className="flex gap-2">
          {(["pendente", "all", "concluido"] as const).map((f) => (
            <Button
              key={f}
              variant={taskFilter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setTaskFilter(f)}
              className="text-xs"
            >
              {f === "pendente" ? "Pendentes" : f === "concluido" ? "Concluídas" : "Todas"}
            </Button>
          ))}
        </div>

        {tasksLoading ? (
          [1,2,3].map(i => <Skeleton key={i} className="h-16" />)
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <Target className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa aqui.</p>
              <Button size="sm" variant="outline" onClick={() => setShowNewTask(true)}>Criar tarefa</Button>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className={cn("transition-all", task.concluido && "opacity-60")} data-testid={`card-task-${task.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <button
                  onClick={() => !task.concluido && handleComplete(task.id)}
                  disabled={task.concluido}
                  className={cn(
                    "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    task.concluido ? "border-green-500 bg-green-500" : "border-muted-foreground hover:border-primary"
                  )}
                  data-testid={`button-complete-${task.id}`}
                >
                  {task.concluido && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", task.concluido && "line-through text-muted-foreground")}>
                    {task.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", tipoColor[task.tipo])}>
                      {tipoLabel[task.tipo]}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.data + "T00:00:00"), "dd/MM")}
                    </span>
                    {task.client_nome && (
                      <span className="text-xs text-muted-foreground truncate">{task.client_nome}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(task.id)}
                  data-testid={`button-delete-task-${task.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* New task dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Ligar para cliente..."
                value={newTaskTitulo}
                onChange={(e) => setNewTaskTitulo(e.target.value)}
                data-testid="input-task-titulo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={newTaskData}
                  onChange={(e) => setNewTaskData(e.target.value)}
                  data-testid="input-task-data"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={newTaskTipo} onValueChange={(v) => setNewTaskTipo(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="pessoal">Pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={createTask.isPending} data-testid="button-create-task">
              {createTask.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
