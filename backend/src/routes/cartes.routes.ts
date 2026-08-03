// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/cartes.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { emettreCartes, listerCartes, listerLots, grillerLot, verifierCarte, activerCarte, attribuerCarte } from '../controllers/cartes.controller';

const router = Router();
router.use(authenticate);

// Master : émettre un lot de cartes
router.post('/emettre',   authorize('MASTER'), emettreCartes);

// Liste des cartes (avec filtre statut) — utilisée par l'onglet Émission
router.get('/emettre', listerCartes);

// Lots de cartes : liste + grillage (fraude)
router.get('/lots',          authorize('MASTER', 'SUPER_ADMIN'), listerLots);
router.post('/lots/:id/griller', authorize('MASTER', 'SUPER_ADMIN'), grillerLot);

// Vérification authenticité (accessible à tous les rôles authentifiés)
router.post('/verifier',  verifierCarte);

// Client : activer une carte (dépôt épargne)
router.post('/activer',   authorize('CLIENT'), activerCarte);

// Attribution aux distributeurs/conseillers
router.put('/:id/attribuer', authorize('MASTER', 'DISTRIBUTEUR_INTERNE', 'DISTRIBUTEUR_AGREE'), attribuerCarte);

// Liste des cartes
router.get('/', listerCartes);

export default router;
