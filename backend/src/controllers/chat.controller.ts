// backend/src/controllers/chat.controller.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function getMessages(req: Request, res: Response) {
  try {
    const { clientId } = req.params;
    const userId = req.user!.userId;
    const role   = req.user!.role;
    if (role === 'CLIENT' && userId !== clientId) {
      return res.status(403).json({ error: 'Acces refuse' });
    }
    // 100 messages les plus récents, retournés en ordre chronologique pour l'affichage
    const messages = await prisma.chatMessage.findMany({
      where: { clientId }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { expediteur: { select: { nom: true, prenom: true, role: true } } }
    });
    messages.reverse();
    await prisma.chatMessage.updateMany({
      where: { clientId, lu: false, expediteurId: { not: userId } },
      data: { lu: true }
    });
    return res.json({ data: messages });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function envoyerMessage(req: Request, res: Response) {
  try {
    const { clientId } = req.params;
    const { contenu }  = req.body;
    if (!contenu?.trim()) return res.status(400).json({ error: 'Message vide' });
    // [SÉCURITÉ] Un client ne peut écrire que dans SA conversation
    if (req.user!.role === 'CLIENT' && req.user!.userId !== clientId) {
      return res.status(403).json({ error: 'Acces refuse' });
    }
    const message = await prisma.chatMessage.create({
      data: { clientId, expediteurId: req.user!.userId, contenu: contenu.trim(), lu: false },
      include: { expediteur: { select: { nom: true, prenom: true, role: true } } }
    });
    return res.status(201).json({ success: true, data: message });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function conversationsNonLues(req: Request, res: Response) {
  try {
    const nonLus = await prisma.chatMessage.groupBy({
      by: ['clientId'],
      where: { lu: false, expediteur: { role: 'CLIENT' } },
      _count: { id: true }
    });
    const details = await Promise.all(nonLus.map(async nl => {
      const client = await prisma.user.findUnique({
        where: { id: nl.clientId },
        select: { nom: true, prenom: true, telephone: true }
      });
      const dernierMsg = await prisma.chatMessage.findFirst({
        where: { clientId: nl.clientId }, orderBy: { createdAt: 'desc' },
        select: { contenu: true, createdAt: true }
      });
      return { clientId: nl.clientId, client, messagesNonLus: nl._count.id, dernierMessage: dernierMsg };
    }));
    return res.json({ data: details });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
