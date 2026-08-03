// backend/src/controllers/rapport.controller.ts — Rapports PDF
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToCloudinary } from '../utils/upload';
import { notifier, emailTpl } from '../utils/notifications';
import PDFDocument from 'pdfkit';

function fmt(n: number) { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }

// Générer un rapport PDF mensuel
export async function genererRapportMensuel(req: Request, res: Response) {
  try {
    const { annee, mois } = req.body;
    const a = parseInt(annee || new Date().getFullYear().toString());
    const m = parseInt(mois  || new Date().getMonth().toString()) || new Date().getMonth();
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
        ['Total depots cartes', fmt(totalDepots)],
        ['Total frais collectes',fmt(totalFrais)],
        ['Virements internes',  fmt(totalVirements)],
        ['Bonus epargne verses',fmt(totalBonus)],
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
        doc.text(fmt(Number(t.montant)),       320, yRow, {width:70});
        doc.text(fmt(Number(t.montantNet)),    390, yRow, {width:70});
        doc.text(fmt(Number(t.frais)),         460, yRow, {width:60});
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
            <li>Total depots : <strong>${fmt(totalDepots)}</strong></li>
            <li>Total frais : <strong>${fmt(totalFrais)}</strong></li>
            <li>Virements : <strong>${fmt(totalVirements)}</strong></li>
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

// Rapport à la demande (export JSON → CSV côté frontend)
export async function exporterDonnees(req: Request, res: Response) {
  try {
    const { type = 'clients', format = 'json' } = req.query;
    let data: any[] = [];

    if (type === 'clients') {
      data = await prisma.user.findMany({
        where: { role:'CLIENT' },
        select: { nom:true, prenom:true, telephone:true, createdAt:true,
          compte: { select:{ numeroCompte:true, rib:true, solde:true, statut:true } },
          clients: { select:{ region:true, ville:true, commune:true } } },
        orderBy: { createdAt:'desc' }
      });
    } else if (type === 'transactions') {
      data = await prisma.transaction.findMany({
        take: 1000,
        orderBy: { createdAt:'desc' },
        select: { reference:true, type:true, montant:true, frais:true, montantNet:true, statut:true, createdAt:true,
          compte:{ select:{ user:{ select:{ nom:true, prenom:true } } } } }
      });
    }

    return res.json({ data, count: data.length });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
