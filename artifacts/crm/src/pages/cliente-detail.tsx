import { useRoute, Link } from "wouter";
import {
  useGetClient,
  usePayInstallment,
  useCreateEvent,
  getGetClientQueryKey,
  getGetCobrancaSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Phone,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  DollarSign,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  em_cobranca: { label: "Em Cobrança", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  quitado: { label: "Quitado", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const installmentStatusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pendente: { label: "Pendente", icon: Clock, className: "text-muted-foreground" },
  pago: { label: "Pago", icon: CheckCircle2, className: "text-green-500" },
  atrasado: { label: "Atrasado", icon: AlertCircle, className: "text-destructive" },
};

const eventTypeConfig: Record<string, { label: string; color: string }> = {
  venda_fechada: { label: "Venda fechada", color: "bg-green-500" },
  parcela_paga: { label: "Pagamento", color: "bg-blue-500" },
  atraso: { label: "Atraso", color: "bg-destructive" },
  renovacao: { label: "Renovação", color: "bg-amber-500" },
  follow_up: { label: "Follow-up", color: "bg-purple-500" },
  anotacao: { label: "Anotação", color: "bg-slate-400" },
};

export default function ClienteDetail() {
  const [, params] = useRoute("/clientes/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) },
  });

  const payInstallment = usePayInstallment();
  const createEvent = useCreateEvent();

  const [payingInstallment, setPayingInstallment] = useState<any | null>(null);
  const [valorPago, setValorPago] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  const canPay = user?.papel === "cobrador" || user?.papel === "lider";

  function handlePay(inst: any) {
    setPayingInstallment(inst);
    setValorPago(String(inst.valor));
  }

  function confirmPayment() {
    if (!payingInstallment) return;
    const amount = parseFloat(valorPago);
    if (isNaN(amount) || amount <= 0) return;

    payInstallment.mutate(
      { id: payingInstallment.id, data: { valor_pago: amount } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetCobrancaSummaryQueryKey() });
          toast({ title: "Pagamento registrado!" });
          setPayingInstallment(null);
        },
        onError: () => {
          toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
        },
      }
    );
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    createEvent.mutate(
      { data: { client_id: id, tipo: "anotacao", observacao: noteText } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(id) });
          toast({ title: "Anotação adicionada!" });
          setShowNote(false);
          setNoteText("");
        },
      }
    );
  }

  if (isLoading || !client) {
    return (
      <div className="p-4 pt-6 pb-24 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-28" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const installments = (client as any).installments ?? [];
  const events = [...((client as any).events ?? [])].reverse();
  const statusCfg = statusConfig[client.status] ?? statusConfig.ativo;
  const paidCount = installments.filter((i: any) => i.status === "pago").length;
  const overdueCount = installments.filter((i: any) => i.status === "atrasado").length;

  return (
    <div className="p-4 pb-24 space-y-5 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate" data-testid="text-client-nome">
            {client.nome}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusCfg.className)}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Client info card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground" data-testid="text-client-telefone">{client.telefone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground truncate">{client.vendedor_nome ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-foreground" data-testid="text-client-valor">
                {formatCurrency(client.valor_contrato)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">Dia {client.dia_vencimento}/mês</span>
            </div>
          </div>

          {/* Installment progress */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso do contrato</span>
              <span className="font-medium">{paidCount}/{client.parcelas} parcelas</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${client.parcelas > 0 ? (paidCount / client.parcelas) * 100 : 0}%` }}
              />
            </div>
            {overdueCount > 0 && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {overdueCount} parcela{overdueCount > 1 ? "s" : ""} em atraso
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => { setNoteText(""); setShowNote(true); }}
          data-testid="button-add-note"
        >
          <MessageSquare className="h-4 w-4 mr-1.5" />
          Anotação
        </Button>
        <a
          href={`tel:${client.telefone}`}
          className="flex-1"
        >
          <Button variant="outline" size="sm" className="w-full" data-testid="button-call">
            <Phone className="h-4 w-4 mr-1.5" />
            Ligar
          </Button>
        </a>
      </div>

      {/* Installments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Parcelas ({installments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {installments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma parcela encontrada.</p>
          ) : (
            installments.map((inst: any) => {
              const cfg = installmentStatusConfig[inst.status] ?? installmentStatusConfig.pendente;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={inst.id}
                  className={cn(
                    "flex items-center justify-between py-2.5 px-3 rounded-lg",
                    inst.status === "atrasado" ? "bg-destructive/5 border border-destructive/20" :
                    inst.status === "pago" ? "bg-green-50/50 dark:bg-green-900/10" : "bg-muted/30"
                  )}
                  data-testid={`row-installment-${inst.id}`}
                >
                  <div className="flex items-center gap-2.5">
                    <StatusIcon className={cn("h-4 w-4 flex-shrink-0", cfg.className)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Parcela {inst.numero_parcela}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inst.status === "pago" && inst.pago_em
                          ? `Pago em ${format(new Date(inst.pago_em), "dd/MM/yy")}`
                          : `Vence: ${format(new Date(inst.vencimento + "T00:00:00"), "dd/MM/yy")}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {formatCurrency(inst.valor)}
                    </span>
                    {canPay && inst.status !== "pago" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handlePay(inst)}
                        data-testid={`button-pay-${inst.id}`}
                      >
                        Pagar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Event history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento registrado.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4 pl-8">
                {events.map((event: any) => {
                  const cfg = eventTypeConfig[event.tipo] ?? { label: event.tipo, color: "bg-muted" };
                  return (
                    <div key={event.id} className="relative" data-testid={`event-${event.id}`}>
                      <div className={cn("absolute -left-5 top-1 h-2.5 w-2.5 rounded-full", cfg.color)} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{cfg.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.data), "dd/MM/yy HH:mm")}
                          </span>
                        </div>
                        {event.observacao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.observacao}</p>
                        )}
                        {event.user_nome && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">por {event.user_nome}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay dialog */}
      <Dialog open={!!payingInstallment} onOpenChange={(open) => !open && setPayingInstallment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {payingInstallment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p>Parcela <strong>{payingInstallment.numero_parcela}</strong> — {formatCurrency(payingInstallment.valor)}</p>
                <p className="text-muted-foreground mt-0.5">Vencimento: {format(new Date(payingInstallment.vencimento + "T00:00:00"), "dd/MM/yyyy")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Valor recebido (R$)</Label>
                <Input
                  type="number"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  data-testid="input-valor-pago"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingInstallment(null)}>Cancelar</Button>
            <Button onClick={confirmPayment} disabled={payInstallment.isPending} data-testid="button-confirm-pay">
              {payInstallment.isPending ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note dialog */}
      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Anotação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Escreva uma observação sobre o cliente..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            data-testid="textarea-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNote(false)}>Cancelar</Button>
            <Button onClick={handleAddNote} disabled={createEvent.isPending} data-testid="button-save-note">
              {createEvent.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
