// backend/src/app.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes         from './routes/auth.routes';
import comptesRoutes      from './routes/comptes.routes';
import cartesRoutes       from './routes/cartes.routes';
import transactionsRoutes from './routes/transactions.routes';
import distributeursRoutes from './routes/distributeurs.routes';
import conseillersRoutes  from './routes/conseillers.routes';
import clientsRoutes      from './routes/clients.routes';
import adminRoutes        from './routes/admin.routes';
import syncRoutes         from './routes/sync.routes';
import epargneRoutes      from './routes/epargne.routes';
import virementsRoutes    from './routes/virements.routes';
import smsEntrantRoutes   from './routes/sms_entrant.routes';
import superAdminRoutes   from './routes/super_admin.routes';
import documentsRoutes    from './routes/documents.routes';
import rapportRoutes      from './routes/rapport.routes';
import siteConfigRoutes   from './routes/site_config.routes';
import galerieRoutes      from './routes/galerie.routes';
import iaRapportsRoutes   from './routes/ia_rapports.routes';
import chatRoutes         from './routes/chat.routes';
import unarciRoutes       from './routes/unarci.routes';
import agenceRoutes       from './routes/agence.routes';
import { errorHandler }   from './middleware/error.middleware';
import { initSiteConfig } from './controllers/site_config.controller';

const app = express();

// [SÉCURITÉ] L'API est derrière un reverse-proxy (Cloudflare/Nginx).
// Sans ce réglage, req.ip vaut l'IP du proxy et les rate-limits par IP
// (login, refresh, codes) deviennent globaux. '1' = un seul proxy de confiance.
app.set('trust proxy', 1);

// ── Sécurité ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Géré par Cloudflare en prod
}));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'https://app.semenceep.ci',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));
app.use(rateLimit({ windowMs:15*60*1000, max:300, standardHeaders:true }));
app.use(express.json({ limit:'10mb', verify:(req: any, _res: any, buf: Buffer) => { req.rawBody = buf.toString('utf8'); } }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/comptes',       comptesRoutes);
app.use('/api/cartes',        cartesRoutes);
app.use('/api/transactions',  transactionsRoutes);
app.use('/api/distributeurs', distributeursRoutes);
app.use('/api/conseillers',   conseillersRoutes);
app.use('/api/clients',       clientsRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api',               syncRoutes);
app.use('/api/epargne',       epargneRoutes);
app.use('/api/virements',     virementsRoutes);
app.use('/api/sms',           smsEntrantRoutes);
app.use('/api/super-admin',   superAdminRoutes);
app.use('/api/documents',     documentsRoutes);
app.use('/api/rapports',      rapportRoutes);
app.use('/api/site-config',   siteConfigRoutes);
app.use('/api/galerie',       galerieRoutes);
app.use('/api/ia',            iaRapportsRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/unarci',        unarciRoutes);
app.use('/api/agence',        agenceRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  status:  'OK',
  service: 'Semence Epargne API',
  version: '1.0.0',
  domain:  'semenceep.ci',
}));

app.use('*', (_, res) => res.status(404).json({ error: 'Route introuvable' }));
app.use(errorHandler);

// Initialiser la config du site au démarrage
initSiteConfig().catch(console.error);

export default app;
