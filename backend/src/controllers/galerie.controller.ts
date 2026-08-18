// backend/src/controllers/galerie.controller.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/upload';

export async function listerPhotos(_req: Request, res: Response) {
  try {
    const configs = await prisma.siteConfig.findMany({
      where: { cle: { startsWith: 'GALERIE_PHOTO_' } },
      orderBy: { cle: 'asc' }
    });
    const photos = configs.map(c => {
      try { return { ...JSON.parse(c.valeur), cle: c.cle }; }
      catch { return null; }
    }).filter(Boolean);
    return res.json({ data: photos });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function ajouterPhoto(req: Request, res: Response) {
  try {
    const { titre, descriptif } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Image requise' });
    const { url, publicId } = await uploadToCloudinary(req.file.buffer, {
      folder: 'galerie', resourceType: 'image'
    });
    // [CORRECTION] Numérotation par max existant (et non count) pour éviter
    // les collisions de clé quand des photos ont été supprimées.
    const existing = await prisma.siteConfig.findMany({
      where: { cle: { startsWith: 'GALERIE_PHOTO_' } },
      select: { cle: true }
    });
    let maxOrdre = 0;
    for (const c of existing) {
      const n = parseInt(c.cle.replace('GALERIE_PHOTO_', ''), 10);
      if (!Number.isNaN(n) && n > maxOrdre) maxOrdre = n;
    }
    const ordre = maxOrdre + 1;
    const cle = `GALERIE_PHOTO_${String(ordre).padStart(3, '0')}`;
    await prisma.siteConfig.create({
      data: {
        cle,
        valeur: JSON.stringify({ url, publicId, titre: titre || '', descriptif: descriptif || '', ordre }),
        type: 'IMAGE',
        label: `Photo galerie ${ordre}`,
        updatedBy: req.user!.userId
      }
    });
    await prisma.auditLog.create({
      data: { action: 'GALERIE_AJOUT_PHOTO', entite: 'SiteConfig', entiteId: cle, actorId: req.user!.userId }
    });
    return res.status(201).json({ success: true, data: { cle, url, titre, descriptif } });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function modifierPhoto(req: Request, res: Response) {
  try {
    const { cle } = req.params;
    // [SÉCURITÉ] Seules les clés galerie sont modifiables via ce endpoint
    if (!cle.startsWith('GALERIE_PHOTO_'))
      return res.status(400).json({ error: 'Clé invalide — seules les photos galerie sont modifiables' });
    const { titre, descriptif } = req.body;
    const existing = await prisma.siteConfig.findUnique({ where: { cle } });
    if (!existing) return res.status(404).json({ error: 'Photo introuvable' });
    const data = JSON.parse(existing.valeur);
    const updated = { ...data, titre: titre ?? data.titre, descriptif: descriptif ?? data.descriptif };
    await prisma.siteConfig.update({
      where: { cle }, data: { valeur: JSON.stringify(updated), updatedBy: req.user!.userId }
    });
    return res.json({ success: true, data: updated });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

export async function supprimerPhoto(req: Request, res: Response) {
  try {
    const { cle } = req.params;
    // [SÉCURITÉ] Seules les clés galerie sont supprimables via ce endpoint
    if (!cle.startsWith('GALERIE_PHOTO_'))
      return res.status(400).json({ error: 'Clé invalide — seules les photos galerie sont supprimables' });
    const existing = await prisma.siteConfig.findUnique({ where: { cle } });
    if (!existing) return res.status(404).json({ error: 'Photo introuvable' });
    const data = JSON.parse(existing.valeur);
    if (data.publicId) await deleteFromCloudinary(data.publicId);
    await prisma.siteConfig.delete({ where: { cle } });
    await prisma.auditLog.create({
      data: { action: 'GALERIE_SUPPRESSION_PHOTO', entite: 'SiteConfig', entiteId: cle, actorId: req.user!.userId }
    });
    return res.json({ success: true, message: 'Photo supprimee' });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
