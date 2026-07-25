// backend/src/routes/super_admin.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listerAdmins, creerAdmin, modifierPermissions, toggleAdmin, resetPasswordAdmin, supprimerAdmin, listePermissions } from '../controllers/super_admin.controller';

const router = Router();
router.use(authenticate);

// Consultation : SUPER_ADMIN + MASTER + permission ADMINS_VOIR
router.get('/admins',      authorize('SUPER_ADMIN','MASTER','ADMINS_VOIR'), listerAdmins);
router.get('/permissions', authorize('SUPER_ADMIN','MASTER','ADMINS_VOIR'), listePermissions);

// Modifications : SUPER_ADMIN uniquement (ou ADMINS_AJOUTER / ADMINS_MODIFIER / ADMINS_SUPPRIMER)
router.post('/admins',                      authorize('SUPER_ADMIN','ADMINS_AJOUTER'),   creerAdmin);
router.patch('/admins/:userId/permissions', authorize('SUPER_ADMIN','ADMINS_MODIFIER'),  modifierPermissions);
router.patch('/admins/:userId/toggle',      authorize('SUPER_ADMIN','ADMINS_MODIFIER'),  toggleAdmin);
router.post('/admins/:userId/reset-pwd',    authorize('SUPER_ADMIN','ADMINS_MODIFIER'),  resetPasswordAdmin);
router.delete('/admins/:userId',            authorize('SUPER_ADMIN','ADMINS_SUPPRIMER'), supprimerAdmin);

export default router;
