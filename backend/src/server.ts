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

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`
🚀 SEMENCE EPARGNE — API démarrée`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Environnement : ${process.env.NODE_ENV}
`);
});
