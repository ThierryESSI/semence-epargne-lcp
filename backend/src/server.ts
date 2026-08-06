// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/server.ts
import 'dotenv/config';
import app from './app';
import { relancerAdherents } from './controllers/unarci.controller';

const PORT = Number(process.env.PORT) || 4000;

// Relances automatiques UNARCI (paiement en attente) : 1ère à 48h, 2nde à 7j.
// Lancement 30s après le démarrage, puis toutes les 6h.
function demarrerRelancesUnarci() {
  const tour = () => {
    relancerAdherents()
      .then(r => console.log(`[Relances UNARCI] 1ères relances: ${r.premieres}, 2ndes: ${r.secondes}`))
      .catch((err: any) => console.error('[Relances UNARCI] Erreur:', err?.message));
  };
  setTimeout(tour, 30_000);
  setInterval(tour, 6 * 3600 * 1000);
}

app.listen(PORT, () => {
  console.log(`
🚀 SEMENCE EPARGNE — API démarrée`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Environnement : ${process.env.NODE_ENV}
`);
  demarrerRelancesUnarci();
});
