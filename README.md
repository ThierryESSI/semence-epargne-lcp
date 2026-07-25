# SEMENCE EPARGNE — Le Crédit Panafricain
## Plateforme Web Microfinance & Mobile Banking

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend API | Node.js + Express + TypeScript |
| Base de données | PostgreSQL 16 |
| ORM | Prisma |
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Auth | JWT (access + refresh tokens) |
| QR Code | qrcode (génération) + jsQR (scan navigateur) |
| SMS | Africa's Talking API |
| State | Zustand |
| Charts | Recharts |

---

## Structure du projet

```
semence-epargne/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      ← Schéma base de données
│   │   └── seed.ts            ← Données initiales
│   ├── src/
│   │   ├── server.ts          ← Point d'entrée
│   │   ├── app.ts             ← Configuration Express
│   │   ├── routes/            ← Définition des routes
│   │   ├── controllers/       ← Logique métier
│   │   ├── middleware/        ← Auth, audit, erreurs
│   │   └── utils/             ← Prisma, JWT, crypto, SMS, QR
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx            ← Routeur principal
    │   ├── lib/               ← api.ts, store.ts, utils.ts
    │   ├── components/ui/     ← Composants réutilisables
    │   └── pages/
    │       ├── auth/          ← Login
    │       ├── client/        ← Dashboard, Scanner, Historique
    │       ├── conseiller/    ← Dashboard, Clients, OuvrirCompte
    │       ├── distributeur/  ← Dashboard, Conseillers
    │       └── master/        ← Dashboard, Cartes, Acteurs, Config
    └── package.json
```

---

## Installation et démarrage

### 1. Prérequis
- Node.js 18+
- PostgreSQL 16
- npm ou yarn

### 2. Backend

```bash
cd backend
cp .env.example .env
# Éditez .env avec vos vraies valeurs

npm install
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts   # Crée le compte Master + démo

npm run dev   # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

---

## Comptes de démonstration (après seed)

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Master LCP | master@lcp-microfinance.ci | Master@LCP2026! |
| Distributeur | distrib.abidjan@lcp-microfinance.ci | Distrib@Demo2026! |

---

## API Endpoints

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/auth/login | Connexion |
| POST | /api/auth/refresh | Renouveler le token |
| GET | /api/auth/me | Profil courant |
| PUT | /api/auth/password | Changer mot de passe |

### Comptes
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/comptes/ouvrir | Ouvrir un compte client |
| POST | /api/comptes/activer | Activer un compte |
| GET | /api/comptes/solde | Solde du compte client |
| GET | /api/comptes/:id | Détail d'un compte |

### Cartes
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/cartes/emettre | Émettre des cartes (Master) |
| POST | /api/cartes/verifier | Vérifier authenticité (QR Auth) |
| POST | /api/cartes/activer | Activer une carte = dépôt épargne |
| PUT | /api/cartes/:id/attribuer | Attribuer à distributeur/conseiller |
| GET | /api/cartes | Lister les cartes |

### Transactions
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/transactions | Lister (filtres: type, statut, dates) |
| GET | /api/transactions/:id | Détail d'une transaction |

### Distributeurs / Conseillers / Clients
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/distributeurs | Créer un distributeur |
| GET | /api/distributeurs | Lister |
| GET | /api/distributeurs/:id/stats | Stats du distributeur |
| POST | /api/conseillers | Créer un conseiller |
| GET | /api/conseillers | Lister |
| GET | /api/clients | Lister les clients |

### Admin (Master uniquement)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/admin/stats | KPIs globaux + évolution 7j |
| GET | /api/admin/audit | Logs d'audit |
| GET | /api/admin/config | Configuration système |
| PUT | /api/admin/config/:cle | Modifier une config |

---

## Sécurité

- **JWT** access token (24h) + refresh token (7d)
- **RBAC** : 5 rôles (MASTER, DISTRIBUTEUR_INTERNE, DISTRIBUTEUR_AGREE, CONSEILLER, CLIENT)
- **AES-256-GCM** pour chiffrement données sensibles
- **HMAC-SHA256** pour signature des QR Codes (anti-contrefaçon)
- **bcrypt** (rounds: 12) pour mots de passe
- **Rate limiting** : 100 req/15min global, 10 req/15min sur /auth/login
- **Helmet** : headers HTTP sécurisés
- **Audit logs** immuables sur toutes les opérations financières
- Cartes à **usage unique** — invalidation atomique en transaction PostgreSQL

---

## Flux carte Semence Épargne (6 étapes)

```
Client achète carte
        ↓
[1] Scan QR Auth (recto) → POST /api/cartes/verifier → ✅ Authentique
        ↓
[2] Remet espèces au distributeur
        ↓
[3] Scan QR Épargne (verso) → token extrait
        ↓
[4] Saisit code 4 chiffres → POST /api/cartes/activer
        ↓
[5] Vérification HMAC en DB
        ↓
[6] Transaction atomique : carte UTILISEE + compte crédité + SMS envoyé
```

---

## Déploiement production

```bash
# Backend
npm run build
node dist/server.js

# Variables production essentielles
DATABASE_URL=postgresql://...
JWT_SECRET=<secret-fort-256-bits>
ENCRYPTION_KEY=<64-hex-chars>
QR_SIGNING_KEY=<secret-fort>
AT_API_KEY=<africa-talking-key>
NODE_ENV=production
```

---

*Document technique — Le Crédit Panafricain (LCP) — 2026*
