// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/clients.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function listerClients(req: Request, res: Response) {
  const page   = parseInt(req.query.page as string || '1');
  const limit  = parseInt(req.query.limit as string || '20');
  const search = req.query.search as string | undefined;
  const role   = req.user!.role;

  const where: any = {};

  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findUnique({ where: { userId: req.user!.userId } });
    if (c) where.conseillerId = c.id;
  } else if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findUnique({ where: { userId: req.user!.userId } });
    if (d) {
      const conseillers = await prisma.conseiller.findMany({ where: { distributeurId: d.id }, select: { id: true } });
      where.conseillerId = { in: conseillers.map(c => c.id) };
    }
  }

  if (search) {
    where.user = { OR: [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      { telephone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ]};
  }

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, actif: true, createdAt: true } },
        compte: { select: { numeroCompte: true, solde: true, statut: true } },
        conseiller: { select: { code: true, user: { select: { nom: true } } } }
      }
    })
  ]);
  return res.json({ data: clients, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function getClient(req: Request, res: Response) {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, actif: true, createdAt: true } },
      compte: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10, include: { carte: { select: { reference: true } } } } } },
      conseiller: { include: { user: { select: { nom: true, prenom: true } }, distributeur: { select: { nomEntreprise: true } } } }
    }
  });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  return res.json({ data: client });
}
