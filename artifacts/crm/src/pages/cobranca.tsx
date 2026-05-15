import { useState } from "react";
import {
  useGetCobrancaSummary,
  usePayInstallment,
  getGetCobrancaSummaryQueryKey,
  getListInstallmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, DollarSign, Users, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function daysOverdue(vencimento: string): number {
  const today = new Date();
  const due = new Date(vencimento + "T00:00:00");
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function Cobranca() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useGetCobrancaSummary();
  const payInstallment = usePayInstallment();

  const [selectedInstallment, setSelectedInstallment] = useState<any | null>(null);
  const [valorPago, setValorPago] = useState("");

  const canPay = user?.papel === "cobrador" || user?.papel === "lider";

  function handlePay(inst: any) {
    setSelectedInstallment(inst);
    setValorPago(String(inst.valor));
  }

  function confirmPayment() {
    if (!selectedInstallment) return;
    const amount = parseFloat(valorPago);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    payInstallment.mutate(
      { id: selectedInstallment.id, data: { valor_pago: amount } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCobrancaSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
          toast({ title: "Pagamento registrado!", description: `Parcela de ${formatCurrency(amount)} marcada como paga.` });
          setSelectedInstallment(null);
        },
        onError: () => {
          toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-4 pt-6 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        {[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const installments = summary?.installments_atrasadas ?? [];

  return (
    <div className="p-4 pb-24 space-y-5 pt-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Cobrança</h1>
        <p className="text-sm text-muted-foreground">Parcelas em atraso</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Em Atraso</span>
            </div>
            <div className="text-2xl font-bold text-destructive" data-testid="text-total-atrasados">
              {summary?.total_atrasados ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">parcelas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Valor Total</span>
            </div>
            <div className="text-lg font-bold text-foreground" data-testid="text-valor-atrasado">
              {formatCurrency(summary?.valor_total_atrasado ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">a receber</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-vendedor breakdown */}
      {(summary?.atrasados_por_vendedor?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {summary?.atrasados_por_vendedor?.map((v) => (
              <div key={v.vendedor_id} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{v.vendedor_nome}</span>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {v.total} parcela{v.total !== 1 ? "s" : ""}
                  </Badge>
                  <span className="text-muted-foreground">{formatCurrency(v.valor)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Installments list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Parcelas ({installments.length})
        </h2>

        {installments.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-semibold text-foreground">Nenhuma parcela em atraso</p>
                <p className="text-sm text-muted-foreground mt-1">Tudo em dia. Bom trabalho!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          installments.map((inst) => {
            const overdueDays = daysOverdue(inst.vencimento);
            return (
              <Card
                key={inst.id}
                className={cn("border-l-4", overdueDays > 30 ? "border-l-destructive" : "border-l-amber-400")}
                data-testid={`card-installment-${inst.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{inst.client_nome}</p>
                      <p className="text-xs text-muted-foreground">Parcela {inst.numero_parcela}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            overdueDays > 30
                              ? "text-destructive border-destructive/30 bg-destructive/5"
                              : "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/10"
                          )}
                        >
                          {overdueDays}d em atraso
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Venceu: {format(new Date(inst.vencimento + "T00:00:00"), "dd/MM/yyyy")}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-2">
                      <span className="font-bold text-foreground">{formatCurrency(inst.valor)}</span>
                      {canPay && (
                        <Button
                          size="sm"
                          onClick={() => handlePay(inst)}
                          data-testid={`button-pay-${inst.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Pago
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Payment dialog */}
      <Dialog open={!!selectedInstallment} onOpenChange={(open) => !open && setSelectedInstallment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Cliente:</span> <strong>{selectedInstallment.client_nome}</strong></p>
                <p><span className="text-muted-foreground">Parcela:</span> {selectedInstallment.numero_parcela}</p>
                <p><span className="text-muted-foreground">Vencimento:</span> {format(new Date(selectedInstallment.vencimento + "T00:00:00"), "dd/MM/yyyy")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-pago">Valor recebido (R$)</Label>
                <Input
                  id="valor-pago"
                  type="number"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  data-testid="input-valor-pago"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInstallment(null)}>Cancelar</Button>
            <Button onClick={confirmPayment} disabled={payInstallment.isPending} data-testid="button-confirm-payment">
              {payInstallment.isPending ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
