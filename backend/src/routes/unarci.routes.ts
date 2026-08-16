// backend/src/routes/unarci.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { adherer, configUnarci, listerAdherents, getAdherent, activerAdherent, statsAdherents, rechercherAdherent, rejeterAdherent, supprimerAdherent, validerPieces, pdfAdherent, modifierAdherent } from '../controllers/unarci.controller';
import { upload } from '../utils/upload';

const router = Router();

// Limite stricte sur l'inscription publique (anti-spam)
const adhesionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

// Pièces jointes du formulaire d'adhésion (photo d'identité + pièces recto/verso)
const champsPieces = upload.fields([
  { name: 'photo',       maxCount: 1 },
  { name: 'pieceRecto',  maxCount: 1 },
  { name: 'pieceVerso',  maxCount: 1 },
]);

// [ROBUSTESSE] Convertir les erreurs Multer (fichier trop gros, format invalide)
// en 400 JSON propre au lieu d'un 500 générique en production.
function multerAvecMessage(req: Request, res: Response, next: NextFunction) {
  champsPieces(req as any, res, (err: any) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux (5 Mo maximum par pièce)'
        : String(err.message || '').includes('Format non supporté')
          ? err.message
          : 'Pièces jointes invalides. Formats acceptés : JPG, PNG, WebP, PDF.';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

// ─── Public ──────────────────────────────────────────────────────────
router.get('/config',  configUnarci);
router.post('/adhesion', adhesionLimiter, multerAvecMessage, adherer);

// ─── Agence UNARCI (authentifiée) ────────────────────────────────────
router.use('/agence', authenticate);
router.get('/agence/adherents', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), listerAdherents);
router.get('/agence/adherents/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), getAdherent);
router.get('/agence/adherents/:id/pdf', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), pdfAdherent);
router.post('/agence/pieces/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), validerPieces);
router.delete('/agence/adherents/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE'), supprimerAdherent);
router.patch('/agence/adherents/:id', authorize('SUPER_ADMIN','MASTER'), modifierAdherent);
router.get('/agence/recherche',   authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), rechercherAdherent);
router.get('/agence/stats',       authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), statsAdherents);
router.post('/agence/activer/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), activerAdherent);
router.post('/agence/rejeter/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE','CONSEILLER'), rejeterAdherent);

export default router;
