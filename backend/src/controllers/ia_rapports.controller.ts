// backend/src/controllers/ia_rapports.controller.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmt(n: number) {
  return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' FCFA';
}

async function collecterDonnees(periode?: string) {
  const now   = new Date();
  // [SÉCURITÉ] Valider le format YYYY-MM pour éviter toute injection de date invalide
  if (periode && !/^\d{4}-\d{2}$/.test(periode)) {
    throw new Error('Période invalide. Format attendu : YYYY-MM');
  }
  const debut = periode
    ? new Date(periode + '-01')
    : new Date(now.getFullYear(), now.getMonth(), 1);
  if (isNaN(debut.getTime())) throw new Error('Période invalide. Format attendu : YYYY-MM');
  const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 1);

  const [
    totalClients, nouveauxClients, clientsActifs,
    transactions, virements,
    plansActifs, plansBonifies,
    topConseillers, rechargesSMS, soldeTotal,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: debut, lt: fin } } }),
    prisma.user.count({ where: { role: 'CLIENT', actif: true } }),
    prisma.transaction.findMany({
      where: { createdAt: { gte: debut, lt: fin }, statut: 'SUCCES' },
      select: { type: true, montant: true, frais: true, montantNet: true, createdAt: true }
    }),
    prisma.virement.findMany({
      where: { statut: 'VALIDE', traiteLe: { gte: debut, lt: fin } },
      select: { montant: true }
    }),
    prisma.planEpargne.count({ where: { statut: 'EN_COURS' } }),
    prisma.planEpargne.count({ where: { statut: 'BONIFIE', updatedAt: { gte: debut, lt: fin } } }),
    prisma.conseiller.findMany({
      include: { user: { select: { nom: true, prenom: true } }, clients: { select: { id: true } } },
      take: 5, orderBy: { clients: { _count: 'desc' } }
    }),
    prisma.auditLog.count({ where: { action: 'SMS_RECHARGE_SUCCES', createdAt: { gte: debut, lt: fin } } }),
    prisma.compte.aggregate({ _sum: { solde: true } }),
  ]);

  const depots         = transactions.filter(t => t.type === 'DEPOT_CARTE');
  const bonus          = transactions.filter(t => t.type === 'BONUS_EPARGNE');
  const totalDepots    = depots.reduce((s, t) => s + Number(t.montant), 0);
  const totalFrais     = transactions.reduce((s, t) => s + Number(t.frais), 0);
  const totalVirements = virements.reduce((s, v) => s + Number(v.montant), 0);
  const totalBonus     = bonus.reduce((s, t) => s + Number(t.montant), 0);
  const solde          = Number(soldeTotal._sum.solde || 0);

  return {
    periode: debut.toLocaleDateString('fr-CI', { month: 'long', year: 'numeric' }),
    clients: { total: totalClients, nouveaux: nouveauxClients, actifs: clientsActifs },
    transactions: {
      nombre: transactions.length,
      depots: { nombre: depots.length, total: totalDepots },
      fraisCollectes: totalFrais,
      virements: { nombre: virements.length, total: totalVirements },
      rechargesSMS,
    },
    epargne: { plansActifs, plansBonifies, totalBonus },
    financier: { soldeTotal: solde },
    conseillers: topConseillers.map(c => ({
      nom: `${c.user.prenom} ${c.user.nom}`,
      nombreClients: c.clients.length
    })),
  };
}

export async function genererAnalyseIA(req: Request, res: Response) {
  try {
    const { periode, typeAnalyse = 'MENSUEL' } = req.body;
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Cle API Anthropic non configuree (ANTHROPIC_API_KEY)' });
    }
    const donnees = await collecterDonnees(periode);
    const prompt = `Tu es un expert en microfinance africaine. Analyse ces donnees de la plateforme Semence Epargne du Credit Panafricain (LCP) en Cote d'Ivoire pour ${donnees.periode}.

DONNEES :
- Clients : ${donnees.clients.total} total, ${donnees.clients.nouveaux} nouveaux ce mois, ${donnees.clients.actifs} actifs
- Transactions : ${donnees.transactions.nombre} operations, ${donnees.transactions.depots.nombre} depots cartes (${fmt(donnees.transactions.depots.total)}), ${donnees.transactions.rechargesSMS} recharges SMS zone rurale
- Frais collectes : ${fmt(donnees.transactions.fraisCollectes)}
- Virements LCP : ${donnees.transactions.virements.nombre} virements (${fmt(donnees.transactions.virements.total)})
- Epargne : ${donnees.epargne.plansActifs} plans actifs, ${donnees.epargne.plansBonifies} plans bonifies ce mois, ${fmt(donnees.epargne.totalBonus)} de bonus verses
- Solde total plateforme : ${fmt(donnees.financier.soldeTotal)}
- Top conseillers : ${donnees.conseillers.map(c => `${c.nom} (${c.nombreClients} clients)`).join(', ')}

Fournis une analyse structuree en francais avec :
1. **Synthese executive** (3 phrases max)
2. **Points forts** du mois (3 points)
3. **Points d'attention** (2-3 points)
4. **Recommandations concretes** pour le mois prochain (3 actions)
5. **Indicateur de sante global** : Excellent / Bon / Correct / A surveiller (avec justification)`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    const analyse = message.content[0].type === 'text' ? message.content[0].text : '';

    await prisma.auditLog.create({
      data: {
        action: 'IA_ANALYSE_GENEREE', entite: 'RapportIA', entiteId: periode || 'courant',
        actorId: req.user!.userId,
        details: { typeAnalyse, periode, tokensUtilises: message.usage.input_tokens + message.usage.output_tokens }
      }
    });

    return res.json({
      success: true,
      data: {
        periode: donnees.periode, analyse, donnees,
        genereAt: new Date().toISOString(),
        tokensUtilises: message.usage.input_tokens + message.usage.output_tokens,
        coutEstime: `~$${((message.usage.input_tokens + message.usage.output_tokens) * 0.000001).toFixed(4)}`
      }
    });
  } catch(err: any) {
    if (err?.status === 401) return res.status(500).json({ error: 'Cle API Anthropic invalide' });
    return res.status(500).json({ error: err.message });
  }
}

export async function questionIA(req: Request, res: Response) {
  try {
    const { question, periode } = req.body;
    if (!question) return res.status(400).json({ error: 'Question requise' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Cle API Anthropic non configuree (ANTHROPIC_API_KEY)' });
    }
    const donnees = await collecterDonnees(periode);
    const message = await client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Tu es un assistant expert en microfinance pour Semence Epargne (LCP, Cote d'Ivoire).
Donnees actuelles : ${JSON.stringify(donnees, null, 2)}
Question : ${question}
Reponds en francais, de facon concise et precise.`
      }]
    });
    const reponse = message.content[0].type === 'text' ? message.content[0].text : '';
    return res.json({ success: true, data: { question, reponse, periode: donnees.periode } });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function historiqueAnalyses(req: Request, res: Response) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { action: 'IA_ANALYSE_GENEREE' },
      orderBy: { createdAt: 'desc' }, take: 20,
      include: { actor: { select: { nom: true, prenom: true, role: true } } }
    });
    return res.json({ data: logs });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
