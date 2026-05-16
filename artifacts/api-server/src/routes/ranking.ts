import { Router, type IRouter } from "express";
import { db, clientsTable, usersTable, teamMembersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, getCurrentUser, requireTeam } from "../lib/auth";
import { calculateCommission } from "../lib/installment-engine";
import { GetRankingQueryParams, GetMyRankingQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildRanking(teamId: number, mes: number, ano: number) {
  const start = new Date(ano, mes - 1, 1);
  const end = new Date(ano, mes, 0, 23, 59, 59);

  const members = await db
    .select({ member: teamMembersTable, user: usersTable })
    .from(teamMembersTable)
    .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, teamId));

  const entries: Array<{
    posicao: number;
    user_id: number;
    nome: string;
    role: string;
    total_vendas: number;
    comissao: number;
    bonus: number;
    total_comissao: number;
  }> = [];

  for (const { member, user } of members) {
    if (member.role === "cobrador" || !user) continue;
    const rows = await db
      .select({ valorContrato: clientsTable.valorContrato })
      .from(clientsTable)
      .where(and(eq(clientsTable.teamId, teamId), eq(clientsTable.vendedorId, member.userId), gte(clientsTable.createdAt, start), lte(clientsTable.createdAt, end)));
    const totalVendas = rows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
    const { comissao, bonus, total } = calculateCommission(totalVendas);

    entries.push({
      posicao: 0,
      user_id: user.id,
      nome: user.nome,
      role: member.role,
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
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const qp = GetRankingQueryParams.safeParse(req.query);
  const now = new Date();
  const mes = (qp.success && qp.data.mes) ? qp.data.mes : now.getMonth() + 1;
  const ano = (qp.success && qp.data.ano) ? qp.data.ano : now.getFullYear();

  const ranking = await buildRanking(teamId, mes, ano);
  res.json(ranking);
});

router.get("/ranking/me", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const qp = GetMyRankingQueryParams.safeParse(req.query);
  const now = new Date();
  const mes = (qp.success && qp.data.mes) ? qp.data.mes : now.getMonth() + 1;
  const ano = (qp.success && qp.data.ano) ? qp.data.ano : now.getFullYear();

  const currentUser = getCurrentUser(req);
  const ranking = await buildRanking(teamId, mes, ano);
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
