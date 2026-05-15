import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  useCreateClient,
  useListUsers,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  telefone: z.string().min(8, "Telefone inválido"),
  valor_contrato: z.coerce.number().min(100, "Valor mínimo R$ 100"),
  parcelas: z.coerce.number().int().min(1).max(60),
  dia_vencimento: z.coerce.number().int().min(1).max(28),
  vendedor_id: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export default function ClienteNovo() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createClient = useCreateClient();
  const { data: users } = useListUsers();

  const isLider = user?.papel === "lider";
  const vendedores = users?.filter((u) => u.papel === "vendedor" || u.papel === "lider") ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      telefone: "",
      valor_contrato: 0,
      parcelas: 12,
      dia_vencimento: 10,
      vendedor_id: null,
    },
  });

  function onSubmit(values: FormValues) {
    createClient.mutate(
      {
        data: {
          nome: values.nome,
          telefone: values.telefone,
          valor_contrato: values.valor_contrato,
          parcelas: values.parcelas,
          dia_vencimento: values.dia_vencimento,
          vendedor_id: values.vendedor_id ?? null,
        },
      },
      {
        onSuccess: (client) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({ title: "Cliente cadastrado!", description: `${client.nome} foi adicionado com sucesso.` });
          setLocation("/clientes");
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível cadastrar o cliente.", variant: "destructive" });
        },
      }
    );
  }

  const valorContrato = form.watch("valor_contrato");
  const parcelas = form.watch("parcelas");
  const valorParcela = valorContrato > 0 && parcelas > 0 ? valorContrato / parcelas : 0;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Novo Cliente</h1>
          <p className="text-sm text-muted-foreground">Cadastrar contrato de empréstimo</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João Silva" data-testid="input-nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-0000" data-testid="input-telefone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valor_contrato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10000" data-testid="input-valor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parcelas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcelas</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={60} data-testid="input-parcelas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {valorParcela > 0 && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm">
                  <span className="text-muted-foreground">Valor da parcela: </span>
                  <span className="font-semibold text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorParcela)}
                  </span>
                </div>
              )}

              <FormField
                control={form.control}
                name="dia_vencimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de vencimento (todo mês)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={28} placeholder="10" data-testid="input-dia-vencimento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLider && vendedores.length > 0 && (
                <FormField
                  control={form.control}
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor responsável</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vendedor">
                            <SelectValue placeholder="Selecionar vendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendedores.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={createClient.isPending}
                data-testid="button-submit"
              >
                {createClient.isPending ? "Cadastrando..." : "Cadastrar Cliente"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
