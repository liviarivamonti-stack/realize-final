import { Router, type IRouter } from "express";
import { db, clientsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { calculateCommission } from "../lib/installment-engine";
import { GetRankingQueryParams, GetMyRankingQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildRanking(mes: number, ano: number) {
  const start = new Date(ano, mes - 1, 1);
  const end = new Date(ano, mes, 0, 23, 59, 59);

  const users = await db.select().from(usersTable);

  const entries: Array<{
    posicao: number;
    user_id: number;
    nome: string;
    papel: string;
    total_vendas: number;
    comissao: number;
    bonus: number;
    total_comissao: number;
  }> = [];

  for (const u of users) {
    if (u.papel === "cobrador") continue;
    const rows = await db
      .select({ valorContrato: clientsTable.valorContrato })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.vendedorId, u.id),
          gte(clientsTable.createdAt, start),
          lte(clientsTable.createdAt, end)
        )
      );
    const totalVendas = rows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
    const { comissao, bonus, total } = calculateCommission(totalVendas);

    entries.push({
      posicao: 0,
      user_id: u.id,
      nome: u.nome,
      papel: u.papel,
      total_vendas: totalVendas,
      comissao,
      bonus,
      total_comissao: total,
    });
  }

  entries.sort((a, b) => b.total_vendas - a.total_vendas);
  entries.forEach((e, i) => { e.posicao = i + 1; });

  return entries;
}

router.get("/ranking", requireAuth, async (req, res): Promise<void> => {
  const qp = GetRankingQueryParams.safeParse(req.query);
  const now = new Date();
  const mes = (qp.success && qp.data.mes) ? qp.data.mes : now.getMonth() + 1;
  const ano = (qp.success && qp.data.ano) ? qp.data.ano : now.getFullYear();

  const ranking = await buildRanking(mes, ano);
  res.json(ranking);
});

router.get("/ranking/me", requireAuth, async (req, res): Promise<void> => {
  const qp = GetMyRankingQueryParams.safeParse(req.query);
  const now = new Date();
  const mes = (qp.success && qp.data.mes) ? qp.data.mes : now.getMonth() + 1;
  const ano = (qp.success && qp.data.ano) ? qp.data.ano : now.getFullYear();

  const currentUser = getCurrentUser(req);
  const ranking = await buildRanking(mes, ano);
  const myEntry = ranking.find(e => e.user_id === currentUser.id);

  const META_MENSAL = 20000;
  const metaProgress = myEntry ? Math.min((myEntry.total_vendas / META_MENSAL) * 100, 100) : 0;

  res.json({
    posicao: myEntry?.posicao ?? 0,
    total_vendas: myEntry?.total_vendas ?? 0,
    comissao: myEntry?.comissao ?? 0,
    bonus: myEntry?.bonus ?? 0,
    total_comissao: myEntry?.total_comissao ?? 0,
    meta_progress: metaProgress,
    mes,
    ano,
  });
});

export default router;
