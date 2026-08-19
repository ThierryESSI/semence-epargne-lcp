// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// ============================================================
// backend/src/routes/agence.routes.ts
// Opérations financières en agence (conseiller/distributeur sur compte client)

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  depotEnAgence,
  initierRetrait, confirmerRetrait,
  initierVirement, confirmerVirement,
  historiqueAgence,
} from '../controllers/agence.controller';

const router = Router();
router.use(authenticate);

// [SÉCURITÉ] Réservé aux rôles Conseiller/Distributeur/MASTER/SUPER_ADMIN
// Un CLIENT ne peut PAS utiliser ces routes
const AGENCE_ROLES = ['MASTER', 'SUPER_ADMIN', 'CONSEILLER', 'DISTRIBUTEUR_INTERNE', 'DISTRIBUTEUR_AGREE'];

// Dépôt en agence (crédite le compte client)
router.post('/depot',       authorize(...AGENCE_ROLES), depotEnAgence);

// Retrait en agence (OTP → confirmation → débit)
router.post('/retrait/initier',    authorize(...AGENCE_ROLES), initierRetrait);
router.post('/retrait/confirmer',  authorize(...AGENCE_ROLES), confirmerRetrait);

// Virement en agence (d'un client vers un autre, OTP → confirmation)
router.post('/virement/initier',   authorize(...AGENCE_ROLES), initierVirement);
router.post('/virement/confirmer', authorize(...AGENCE_ROLES), confirmerVirement);

// Historique des opérations en agence
router.get('/historique', authorize(...AGENCE_ROLES), historiqueAgence);

export default router;
