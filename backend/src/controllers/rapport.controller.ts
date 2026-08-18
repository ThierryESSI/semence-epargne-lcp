// backend/src/controllers/rapport.controller.ts — Rapports PDF
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToCloudinary } from '../utils/upload';
import { notifier, emailTpl } from '../utils/notifications';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { fCFA } from '../utils/format';

// Générer un rapport PDF mensuel
export async function genererRapportMensuel(req: Request, res: Response) {
  try {
    const { annee, mois } = req.body;
    const a = parseInt(annee || new Date().getFullYear().toString());
    const m = parseInt(mois || (new Date().getMonth() + 1).toString()) || (new Date().getMonth() + 1);
    const periode = `${a}-${String(m).padStart(2,'0')}`;
    const debut = new Date(a, m-1, 1);
    const fin   = new Date(a, m,   1);

    // Données du mois
    const [transactions, clients, virements, plansBonifies] = await Promise.all([
      prisma.transaction.findMany({ where:{ createdAt:{ gte:debut, lt:fin }, statut:'SUCCES' }, include:{ compte:{ include:{ user:{ select:{ nom:true, prenom:true } } } } } }),
      prisma.user.count({ where:{ role:'CLIENT', createdAt:{ gte:debut, lt:fin } } }),
      prisma.virement.findMany({ where:{ statut:'VALIDE', traiteLe:{ gte:debut, lt:fin } } }),
      prisma.planEpargne.count({ where:{ statut:'BONIFIE', updatedAt:{ gte:debut, lt:fin } } }),
    ]);

    const totalDepots    = transactions.filter(t => t.type==='DEPOT_CARTE').reduce((s,t) => s+Number(t.montantNet),0);
    const totalFrais     = transactions.reduce((s,t) => s+Number(t.frais),0);
    const totalVirements = virements.reduce((s,v) => s+Number(v.montant),0);
    const totalBonus     = transactions.filter(t => t.type==='BONUS_EPARGNE').reduce((s,t) => s+Number(t.montant),0);

    // Générer le PDF
    const doc = new PDFDocument({ size:'A4', margin:50 });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));

    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve());

      // Entête
      doc.fontSize(20).fillColor('#F65A04').text('SEMENCE EPARGNE', { align:'center' });
      doc.fontSize(12).fillColor('#1C5B9B').text('Le Credit Panafricain (LCP)', { align:'center' });
      doc.moveDown();
      doc.fontSize(16).fillColor('#0F2E52').text(`RAPPORT MENSUEL — ${periode}`, { align:'center' });
      doc.fontSize(10).fillColor('#5a7a9a').text(`Genere le ${new Date().toLocaleDateString('fr-CI')}`, { align:'center' });
      doc.moveDown();

      // Ligne séparatrice
      doc.moveTo(50,doc.y).lineTo(545,doc.y).stroke('#F65A04');
      doc.moveDown();

      // KPIs
      doc.fontSize(14).fillColor('#0F2E52').text('INDICATEURS CLES');
      doc.moveDown(0.5);
      const kpis = [
        ['Nouveaux clients',    clients.toString()],
        ['Total depots cartes', fCFA(totalDepots)],
        ['Total frais collectes',fCFA(totalFrais)],
        ['Virements internes',  fCFA(totalVirements)],
        ['Bonus epargne verses',fCFA(totalBonus)],
        ['Plans bonifies',      plansBonifies.toString()],
      ];
      kpis.forEach(([k,v]) => {
        doc.fontSize(11).fillColor('#5a7a9a').text(k, 50, doc.y, { continued:true });
        doc.fillColor('#0F2E52').text(v, { align:'right' });
      });
      doc.moveDown();

      // Tableau transactions
      doc.moveTo(50,doc.y).lineTo(545,doc.y).stroke('#dde6f0');
      doc.moveDown();
      doc.fontSize(14).fillColor('#0F2E52').text('DETAIL DES TRANSACTIONS');
      doc.moveDown(0.5);

      // En-tête tableau
      doc.fontSize(9).fillColor('#fff')
        .rect(50,doc.y,495,16).fill('#1C5B9B');
      const y0 = doc.y;
      ['Date','Client','Type','Montant','Net','Frais'].forEach((h,i) => {
        doc.fillColor('#fff').text(h, 50+[0,80,200,300,380,450][i], y0+3, { width:80 });
      });
      doc.moveDown(1.5);

      transactions.slice(0,30).forEach((t,i) => {
        if(doc.y > 720) { doc.addPage(); }
        const bg = i%2===0 ? '#f4f7fb' : '#ffffff';
        doc.rect(50,doc.y,495,14).fill(bg);
        const yRow = doc.y+2;
        doc.fontSize(8).fillColor('#0F2E52');
        doc.text(new Date(t.createdAt).toLocaleDateString('fr-CI'), 50,  yRow, {width:80});
        doc.text(`${t.compte.user.prenom} ${t.compte.user.nom}`.slice(0,18), 130, yRow, {width:110});
        doc.text(t.type.replace(/_/g,' '),    240, yRow, {width:80});
        doc.text(fCFA(Number(t.montant)),       320, yRow, {width:70});
        doc.text(fCFA(Number(t.montantNet)),    390, yRow, {width:70});
        doc.text(fCFA(Number(t.frais)),         460, yRow, {width:60});
        doc.moveDown(1.2);
      });

      // Footer
      doc.moveDown();
      doc.fontSize(8).fillColor('#5a7a9a')
        .text('© 2024-2026 MaGestion Facile — M. Thierry ESSI — +225 07 47 19 67 84', { align:'center' })
        .text('SEMENCE EPARGNE — semenceep.ci — infos@semenceep.ci', { align:'center' });

      doc.end();
    });

    // Upload vers Cloudinary
    const pdfBuffer = Buffer.concat(chunks);
    const { url, publicId } = await uploadToCloudinary(pdfBuffer, {
      folder:       'rapports',
      publicId:     `rapport_mensuel_${periode}`,
      resourceType: 'raw',
    });

    // Enregistrer en DB
    const rapport = await prisma.rapportPDF.upsert({
      where:  { periode_type: { periode, type:'MENSUEL' } } as any,
      update: { url, publicId, statut:'GENERE', genereAt:new Date() },
      create: { type:'MENSUEL', periode, url, publicId, statut:'GENERE', genereAt:new Date() },
    });

    // Envoyer par email au Master
    const master = await prisma.user.findFirst({ where:{ role:'MASTER', actif:true }, select:{ email:true, telephone:true, nom:true, prenom:true } });
    if (master && !master.email.includes('noemail')) {
      await notifier({
        userId: req.user!.userId, telephone: master.telephone,
        email:  master.email, notifEmail: true,
        messageSms: `SEMENCE EPARGNE: Rapport mensuel ${periode} disponible. Consultez votre email.`,
        sujetEmail: `Rapport mensuel ${periode} — Semence Epargne`,
        htmlEmail: `<div style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#F65A04">Rapport mensuel ${periode}</h2>
          <p>Bonjour ${master.prenom} ${master.nom},</p>
          <p>Le rapport mensuel <strong>${periode}</strong> est disponible.</p>
          <ul>
            <li>Nouveaux clients : <strong>${clients}</strong></li>
            <li>Total depots : <strong>${fCFA(totalDepots)}</strong></li>
            <li>Total frais : <strong>${fCFA(totalFrais)}</strong></li>
            <li>Virements : <strong>${fCFA(totalVirements)}</strong></li>
          </ul>
          <a href="${url}" style="background:#F65A04;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Telecharger le PDF</a>
          <p style="color:#5a7a9a;font-size:12px;margin-top:20px">SEMENCE EPARGNE · semenceep.ci</p>
        </div>`,
      }).catch(() => {});
      await prisma.rapportPDF.update({ where:{ id:rapport.id }, data:{ envoye:true } });
    }

    return res.json({ success:true, message:`Rapport ${periode} genere et envoye`, data:{ url, periode } });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Lister les rapports générés
export async function listerRapports(req: Request, res: Response) {
  try {
    const rapports = await prisma.rapportPDF.findMany({ orderBy:{ createdAt:'desc' }, take:24 });
    return res.json({ data: rapports });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Rapport à la demande (export JSON ou XLSX)
type Feuille = { nom: string; lignes: Record<string, any>[] };

const dateFmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : '';

const fmtF = (n: any) => (n === null || n === undefined ? '' : Number(n));

async function collecterFeuilles(): Promise<Feuille[]> {
  const [clients, transactions, virements, cartes] = await Promise.all([
    prisma.user.findMany({
      where: { role:'CLIENT' },
      select: { nom:true, prenom:true, telephone:true, createdAt:true,
        compte: { select:{ numeroCompte:true, rib:true, solde:true, statut:true } },
        clients: { select:{ region:true, ville:true, commune:true } } },
      orderBy: { createdAt:'desc' },
    }),
    prisma.transaction.findMany({
      take: 1000,
      orderBy: { createdAt:'desc' },
      include: { compte:{ include:{ user:{ select:{ nom:true, prenom:true } } } } },
    }),
    prisma.virement.findMany({
      take: 1000,
      orderBy: { createdAt:'desc' },
      include: {
        compteSource:{ include:{ user:{ select:{ nom:true, prenom:true } } } },
        compteDest:  { include:{ user:{ select:{ nom:true, prenom:true } } } },
      },
    }),
    prisma.carte.findMany({
      take: 1000,
      orderBy: { createdAt:'desc' },
      select: { reference:true, refCourt:true, montant:true, statut:true, lotId:true, createdAt:true },
    }),
  ]);

  return [
    { nom:'Clients', lignes: clients.map(c => ({
      'Nom': c.nom || '', 'Prénom': c.prenom || '', 'Téléphone': c.telephone || '',
      'Numéro compte': c.compte?.numeroCompte || '', 'RIB': c.compte?.rib || '',
      'Solde (FCFA)': fmtF(c.compte?.solde), 'Statut compte': c.compte?.statut || '',
      'Région': c.clients?.[0]?.region || '', 'Ville': c.clients?.[0]?.ville || '', 'Commune': c.clients?.[0]?.commune || '',
      'Inscrit le': dateFmt(c.createdAt),
    })) },
    { nom:'Transactions', lignes: transactions.map(t => ({
      'Référence': t.reference, 'Type': t.type,
      'Client': `${t.compte?.user?.prenom || ''} ${t.compte?.user?.nom || ''}`.trim(),
      'Montant (FCFA)': fmtF(t.montant), 'Frais (FCFA)': fmtF(t.frais), 'Net (FCFA)': fmtF(t.montantNet),
      'Statut': t.statut, 'Date': dateFmt(t.createdAt),
    })) },
    { nom:'Recharges SMS', lignes: transactions.filter(t => t.type === 'DEPOT_CARTE').map(t => ({
      'Référence': t.reference, 'Canal': (t.metadata as any)?.canal || '',
      'Client': `${t.compte?.user?.prenom || ''} ${t.compte?.user?.nom || ''}`.trim(),
      'Montant (FCFA)': fmtF(t.montant), 'Net (FCFA)': fmtF(t.montantNet),
      'Description': t.description || '', 'Date': dateFmt(t.createdAt),
    })) },
    { nom:'Bonus Epargne', lignes: transactions.filter(t => t.type === 'BONUS_EPARGNE').map(t => ({
      'Référence': t.reference, 'Client': `${t.compte?.user?.prenom || ''} ${t.compte?.user?.nom || ''}`.trim(),
      'Bonus (FCFA)': fmtF(t.montant), 'Date': dateFmt(t.createdAt),
    })) },
    { nom:'Virements', lignes: virements.map(v => ({
      'Référence': v.reference,
      'Émetteur': `${v.compteSource?.user?.prenom || ''} ${v.compteSource?.user?.nom || ''}`.trim(),
      'Bénéficiaire': `${v.compteDest?.user?.prenom || ''} ${v.compteDest?.user?.nom || ''}`.trim(),
      'Montant (FCFA)': fmtF(v.montant), 'Statut': v.statut, 'Motif': v.motif || '',
      'Traité le': dateFmt(v.traiteLe), 'Créé le': dateFmt(v.createdAt),
    })) },
    { nom:'Cartes', lignes: cartes.map(c => ({
      'Référence': c.reference, 'Réf. courte': c.refCourt,
      'Montant (FCFA)': fmtF(c.montant), 'Statut': c.statut,
      'Lot': c.lotId || '', 'Émise le': dateFmt(c.createdAt),
    })) },
  ];
}

export async function exporterDonnees(req: Request, res: Response) {
  try {
    const { type = 'clients', format = 'json' } = req.query;

    if (format === 'xlsx') {
      const feuilles = await collecterFeuilles();
      const wb = XLSX.utils.book_new();
      for (const f of feuilles) {
        const ws = XLSX.utils.json_to_sheet(f.lignes.length ? f.lignes : [{ 'Info':'Aucune donnée pour la période' }]);
        ws['!cols'] = Object.keys(f.lignes[0] || { Info:'' }).map((_, i) => ({ wch: 24 }));
        XLSX.utils.book_append_sheet(wb, ws, f.nom.slice(0, 31));
      }
      const buffer = XLSX.write(wb, { type:'buffer', bookType:'xlsx' }) as Buffer;
      const filename = `semence_export_${new Date().toISOString().slice(0,10)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    const feuilles = await collecterFeuilles();
    const feuille = feuilles.find(f => f.nom.toLowerCase() === String(type).toLowerCase())
      || feuilles.find(f => ['clients','transactions'].includes(f.nom.toLowerCase()))
      || feuilles[0];
    return res.json({ data: feuille.lignes, count: feuille.lignes.length, type });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
