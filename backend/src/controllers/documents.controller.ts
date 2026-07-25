// backend/src/controllers/documents.controller.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/upload';

const TYPES_VALIDES = ['CNI_RECTO','CNI_VERSO','PHOTO_FACIALE','AUTRE'];

// Upload un document pour un client
export async function uploadDocument(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { type = 'AUTRE' } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    if (!TYPES_VALIDES.includes(type))
      return res.status(400).json({ error: `Type invalide. Valeurs : ${TYPES_VALIDES.join(', ')}` });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, nom: true } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Supprimer l'ancien document du même type s'il existe
    const ancien = await prisma.document.findFirst({ where: { userId, type } });
    if (ancien) {
      await deleteFromCloudinary(ancien.publicId, req.file.mimetype === 'application/pdf' ? 'raw' : 'image');
      await prisma.document.delete({ where: { id: ancien.id } });
    }

    const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
    const { url, publicId, taille } = await uploadToCloudinary(req.file.buffer, {
      folder:       `clients/${userId}`,
      publicId:     `${userId}_${type.toLowerCase()}`,
      resourceType,
    });

    const doc = await prisma.document.create({
      data: { userId, type, url, publicId, taille }
    });

    await prisma.auditLog.create({ data: { action:'UPLOAD_DOCUMENT', entite:'Document', entiteId:doc.id, actorId:req.user!.userId, details:{ type, userId } } });

    return res.status(201).json({ success: true, data: { id: doc.id, type, url, taille } });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Lister les documents d'un client
export async function getDocuments(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const docs = await prisma.document.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
      select: { id:true, type:true, url:true, taille:true, createdAt:true }
    });
    return res.json({ data: docs });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Supprimer un document
export async function deleteDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    await deleteFromCloudinary(doc.publicId);
    await prisma.document.delete({ where: { id } });
    await prisma.auditLog.create({ data: { action:'SUPPRESSION_DOCUMENT', entite:'Document', entiteId:id, actorId:req.user!.userId, details:{ type:doc.type } } });
    return res.json({ success: true, message: 'Document supprimé' });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
