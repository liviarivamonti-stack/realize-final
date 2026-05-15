import { db, installmentsTable, clientEventsTable, tasksTable } from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";

export function generateInstallmentDates(
  parcelas: number,
  diaVencimento: number,
  startDate: Date = new Date()
): string[] {
  const dates: string[] = [];
  const base = new Date(startDate);

  for (let i = 1; i <= parcelas; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, diaVencimento);
    // If dia_vencimento > last day of month, clamp to last day
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = Math.min(diaVencimento, lastDay);
    const finalDate = new Date(d.getFullYear(), d.getMonth(), day);
    dates.push(finalDate.toISOString().split("T")[0]);
  }

  return dates;
}

export async function generateInstallments(
  clientId: number,
  valorContrato: number,
  parcelas: number,
  diaVencimento: number
): Promise<void> {
  const valorParcela = (valorContrato / parcelas).toFixed(2);
  const dates = generateInstallmentDates(parcelas, diaVencimento);

  const installmentRows = dates.map((vencimento, i) => ({
    clientId,
    numeroParcela: i + 1,
    valor: valorParcela,
    vencimento,
    status: "pendente" as const,
  }));

  await db.insert(installmentsTable).values(installmentRows);
}

export async function processOverdueInstallments(userId: number): Promise<{
  updated: number;
  eventsCreated: number;
  tasksCreated: number;
}> {
  const today = new Date().toISOString().split("T")[0];

  // Find all pending installments past due
  const overdue = await db
    .select()
    .from(installmentsTable)
    .where(
      and(
        eq(installmentsTable.status, "pendente"),
        lt(installmentsTable.vencimento, today)
      )
    );

  if (overdue.length === 0) {
    return { updated: 0, eventsCreated: 0, tasksCreated: 0 };
  }

  const ids = overdue.map((i) => i.id);

  // Update to atrasado
  await db
    .update(installmentsTable)
    .set({ status: "atrasado" })
    .where(inArray(installmentsTable.id, ids));

  // Create events for each
  const events = overdue.map((inst) => ({
    clientId: inst.clientId,
    tipo: "atraso" as const,
    userId,
    observacao: `Parcela ${inst.numeroParcela} em atraso desde ${inst.vencimento}`,
    data: new Date(),
  }));
  await db.insert(clientEventsTable).values(events);

  // Create follow_up tasks for each
  const tasks = overdue.map((inst) => ({
    userId,
    clientId: inst.clientId,
    titulo: `Follow-up: parcela ${inst.numeroParcela} em atraso`,
    data: today,
    tipo: "followup" as const,
    concluido: false,
  }));
  await db.insert(tasksTable).values(tasks);

  return {
    updated: ids.length,
    eventsCreated: events.length,
    tasksCreated: tasks.length,
  };
}

export function calculateCommission(totalVendas: number): {
  comissao: number;
  bonus: number;
  total: number;
} {
  const comissao = totalVendas * 0.10;
  let bonus = 0;
  if (totalVendas >= 20000) bonus = 2000;
  else if (totalVendas >= 10000) bonus = 1500;
  else if (totalVendas >= 5000) bonus = 1000;

  return { comissao, bonus, total: comissao + bonus };
}
