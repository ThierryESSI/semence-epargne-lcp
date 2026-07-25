// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function getStats(req: Request, res: Response) {
  const [
    totalClients, totalDistributeurs, totalConseillers,
    totalCartes, cartesUtilisees,
    totalTx, volumeAgg, txAujourdhui,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.distributeur.count(),
    prisma.conseiller.count(),
    prisma.carte.count(),
    prisma.carte.count({ where: { statut: 'UTILISEE' } }),
    prisma.transaction.count({ where: { statut: 'SUCCES' } }),
    prisma.transaction.aggregate({ where: { statut: 'SUCCES', type: 'DEPOT_CARTE' }, _sum: { montantNet: true } }),
    prisma.transaction.count({ where: { statut: 'SUCCES', createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
  ]);

  // Évolution des dépôts sur 7 jours
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const evolutionDepots = await Promise.all(jours.map(async (d) => {
    const debut = new Date(d); debut.setHours(0,0,0,0);
    const fin   = new Date(d); fin.setHours(23,59,59,999);
    const agg   = await prisma.transaction.aggregate({
      where: { statut: 'SUCCES', type: 'DEPOT_CARTE', createdAt: { gte: debut, lte: fin } },
      _sum: { montantNet: true }, _count: true
    });
    return { date: debut.toLocaleDateString('fr-CI', { weekday: 'short', day: 'numeric' }), montant: Number(agg._sum.montantNet || 0), count: agg._count };
  }));

  const recentTransactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      compte: { include: { user: { select: { nom: true, prenom: true } } } },
      carte:  { select: { reference: true } }
    }
  });

  return res.json({
    kpis: {
      totalClients, totalDistributeurs, totalConseillers,
      totalCartes, cartesUtilisees,
      tauxUtilisationCartes: totalCartes > 0 ? Math.round((cartesUtilisees / totalCartes) * 100) : 0,
      totalTransactions: totalTx,
      volumeEpargne: Number(volumeAgg._sum.montantNet || 0),
      transactionsDuJour: txAujourdhui,
    },
    evolutionDepots,
    recentTransactions,
  });
}

export async function getAuditLogs(req: Request, res: Response) {
  const page  = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '50');

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      include: { actor: { select: { nom: true, prenom: true, email: true, role: true } } }
    })
  ]);
  return res.json({ data: logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function getConfig(req: Request, res: Response) {
  const configs = await prisma.config.findMany({ orderBy: { cle: 'asc' } });
  return res.json({ data: configs });
}

export async function updateConfig(req: Request, res: Response) {
  const { cle } = req.params;
  const { valeur } = req.body;
  if (!valeur) return res.status(400).json({ error: 'valeur requis' });

  const cfg = await prisma.config.upsert({
    where: { cle }, update: { valeur }, create: { cle, valeur }
  });

  await prisma.auditLog.create({
    data: { action: 'UPDATE_CONFIG', entite: 'Config', entiteId: cle, actorId: req.user!.userId, details: { cle, valeur } }
  });

  return res.json({ success: true, data: cfg });
}
