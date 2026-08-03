// backend/src/controllers/virements.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSms } from '../utils/sms';
import { notifier, emailTpl } from '../utils/notifications';

function genRef() { return `VIR-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; }
function genOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function fmt(n: number) { return new Intl.NumberFormat('fr-CI').format(n) + ' F'; }

class ErreurVirement extends Error {}

export async function initierVirement(req: Request, res: Response) {
  try {
    const { ribDest, montant, motif } = req.body;
    if (!ribDest || !montant) return res.status(400).json({ error:'RIB destinataire et montant requis' });
    if (montant < 100) return res.status(400).json({ error:'Montant minimum : 100 F' });

    const compteSource = await prisma.compte.findUnique({
      where:   { userId:req.user!.userId },
      include: { user:{ select:{ nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } }
    });
    if (!compteSource) return res.status(404).json({ error:'Compte introuvable' });
    if (compteSource.statut !== 'ACTIF') return res.status(403).json({ error:'Votre compte n\'est pas actif' });
    if (Number(compteSource.solde) < montant)
      return res.status(400).json({ error:`Solde insuffisant. Votre solde : ${fmt(Number(compteSource.solde))}` });

    const compteDest = await prisma.compte.findUnique({
      where:   { rib:ribDest.trim().toUpperCase() },
      include: { user:{ select:{ nom:true, prenom:true } } }
    });
    if (!compteDest) return res.status(404).json({ error:`Aucun compte LCP trouvé avec le RIB : ${ribDest}` });
    if (compteDest.statut !== 'ACTIF') return res.status(400).json({ error:'Le compte destinataire n\'est pas actif' });
    if (compteDest.id === compteSource.id) return res.status(400).json({ error:'Vous ne pouvez pas vous virer à vous-même' });

    const otp      = genOTP();
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);

    const virement = await prisma.virement.create({
      data:{ reference:genRef(), compteSourceId:compteSource.id, compteDestId:compteDest.id, montant, motif:motif||'', statut:'EN_ATTENTE', codeConfirm:otp, codeExpireAt:expireAt }
    });

    // SMS OTP
    sendSms({ to:compteSource.user.telephone, message:`SEMENCE EPARGNE LCP: Code confirmation virement: ${otp}. Valable 10 min. Virement de ${fmt(montant)} vers ${compteDest.user.prenom} ${compteDest.user.nom}. Ne communiquez jamais ce code.`, userId:req.user!.userId }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Code OTP envoyé par SMS. Confirmez le virement.',
      data: {
        virementId:   virement.id,
        reference:    virement.reference,
        montant,
        motif:        motif || '',
        expireAt:     expireAt.toISOString(),
        destinataire: { rib:ribDest, nom:compteDest.user.nom, prenom:compteDest.user.prenom, compte:compteDest.numeroCompte }
      }
    });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function confirmerVirement(req: Request, res: Response) {
  try {
    const { virementId, codeOtp } = req.body;
    if (!virementId || !codeOtp) return res.status(400).json({ error:'virementId et codeOtp requis' });

    const virement = await prisma.virement.findUnique({
      where:   { id:virementId },
      include: {
        compteSource: { include:{ user:{ select:{ id:true, nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } } },
        compteDest:   { include:{ user:{ select:{ id:true, nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } } },
      }
    });
    if (!virement) return res.status(404).json({ error:'Virement introuvable' });
    if (virement.compteSource.userId !== req.user!.userId) return res.status(403).json({ error:'Ce virement ne vous appartient pas' });
    if (virement.statut !== 'EN_ATTENTE') return res.status(400).json({ error:`Virement déjà ${virement.statut.toLowerCase()}` });
    if (virement.codeExpireAt && new Date() > virement.codeExpireAt) return res.status(400).json({ error:'Code OTP expiré. Recommencez.' });
    if (virement.codeConfirm !== codeOtp) return res.status(400).json({ error:'Code OTP incorrect' });

    const montant = Number(virement.montant);

    // [SÉCURITÉ] Traitement atomique : claim conditionnel + débit/crédit dans la même
    // transaction. Deux confirmations concurrentes : la première gagne, la seconde
    // reçoit "déjà traité" (élimine le double-débit / double-crédit).
    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.virement.updateMany({
          where: { id: virementId, statut: 'EN_ATTENTE', codeConfirm: codeOtp },
          data:   { statut: 'VALIDE', codeConfirm: null, traiteLe: new Date() },
        });
        if (claim.count !== 1) throw new ErreurVirement('Virement déjà traité');

        // Re-vérification du solde dans la transaction (données à jour)
        const source = await tx.compte.findUnique({ where:{ id:virement.compteSourceId }, select:{ solde:true } });
        if (!source || Number(source.solde) < montant) {
          throw new ErreurVirement(`Solde insuffisant. Solde : ${fmt(Number(source?.solde || 0))}`);
        }

        await tx.compte.update({ where:{ id:virement.compteSourceId }, data:{ solde:{ decrement:montant } } });
        await tx.compte.update({ where:{ id:virement.compteDestId   }, data:{ solde:{ increment:montant } } });
        await tx.transaction.create({ data:{ reference:`TXN-VIR-${Date.now()}-S`, type:'VIREMENT_LCP', montant, frais:0, montantNet:-montant, statut:'SUCCES', compteId:virement.compteSourceId, description:`Virement vers ${virement.compteDest.user.prenom} ${virement.compteDest.user.nom} — ${virement.motif}`, metadata:{ virementId, sens:'DEBIT' } } });
        await tx.transaction.create({ data:{ reference:`TXN-VIR-${Date.now()}-D`, type:'VIREMENT_LCP', montant, frais:0, montantNet:montant, statut:'SUCCES', compteId:virement.compteDestId, description:`Virement de ${virement.compteSource.user.prenom} ${virement.compteSource.user.nom} — ${virement.motif}`, metadata:{ virementId, sens:'CREDIT' } } });
      });
    } catch (err: any) {
      if (err instanceof ErreurVirement) return res.status(409).json({ error: err.message });
      throw err;
    }

    await prisma.auditLog.create({ data:{ action:'VIREMENT_LCP', entite:'Virement', entiteId:virement.id, actorId:req.user!.userId, details:{ montant } } });

    const [src, dst] = [virement.compteSource, virement.compteDest];
    const soldeNouveau = Number(src.solde) - montant;
    const soldeDest    = Number(dst.solde) + montant;

    // Notif expéditeur
    const tplSrc = emailTpl.virementEnvoye(`${src.user.prenom} ${src.user.nom}`, virement.reference, montant, `${dst.user.prenom} ${dst.user.nom}`, soldeNouveau);
    notifier({ userId:src.user.id, telephone:src.user.telephone, whatsapp:src.user.whatsapp, email:src.user.email, notifWhatsapp:src.user.notifWhatsapp, notifEmail:src.user.notifEmail,
      messageSms:`LCP SEMENCE: Virement de ${fmt(montant)} effectué vers ${dst.user.prenom} ${dst.user.nom}. Nouveau solde: ${fmt(soldeNouveau)}.`,
      sujetEmail:tplSrc.sujet, htmlEmail:tplSrc.html }).catch(() => {});

    // Notif destinataire
    const tplDst = emailTpl.virementRecu(`${dst.user.prenom} ${dst.user.nom}`, virement.reference, montant, `${src.user.prenom} ${src.user.nom}`, soldeDest);
    notifier({ userId:dst.user.id, telephone:dst.user.telephone, whatsapp:dst.user.whatsapp, email:dst.user.email, notifWhatsapp:dst.user.notifWhatsapp, notifEmail:dst.user.notifEmail,
      messageSms:`LCP SEMENCE: Reçu ${fmt(montant)} de ${src.user.prenom} ${src.user.nom}. Motif: ${virement.motif||'Virement LCP'}.`,
      sujetEmail:tplDst.sujet, htmlEmail:tplDst.html }).catch(() => {});

    return res.json({ success:true, message:'Virement effectué !', data:{ reference:virement.reference, montant, motif:virement.motif, soldeNouveau, destinataire:{ nom:dst.user.nom, prenom:dst.user.prenom, compte:dst.numeroCompte } } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function annulerVirement(req: Request, res: Response) {
  try {
    const virement = await prisma.virement.findUnique({ where:{ id:req.params.virementId } });
    if (!virement) return res.status(404).json({ error:'Virement introuvable' });

    // [SÉCURITÉ] Seul le propriétaire (compte source) ou un admin peut annuler
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId }, select:{ id:true } });
    if (virement.compteSourceId !== compte?.id && !['MASTER','SUPER_ADMIN'].includes(req.user!.role))
      return res.status(403).json({ error:'Ce virement ne vous appartient pas' });

    // Claim conditionnel — empêche d'annuler un virement déjà traité (course)
    const maj = await prisma.virement.updateMany({
      where: { id:req.params.virementId, statut:'EN_ATTENTE' },
      data:  { statut:'ANNULE' },
    });
    if (maj.count !== 1) return res.status(409).json({ error:'Ce virement ne peut plus être annulé' });
    return res.json({ success:true, message:'Virement annulé' });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function mesVirements(req: Request, res: Response) {
  try {
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
    if (!compte) return res.status(404).json({ error:'Compte introuvable' });
    const page  = Math.max(1, parseInt(req.query.page as string||'1'));
    const limit = parseInt(req.query.limit as string||'20');
    const [total, virements] = await Promise.all([
      prisma.virement.count({ where:{ OR:[{ compteSourceId:compte.id },{ compteDestId:compte.id }] } }),
      prisma.virement.findMany({ where:{ OR:[{ compteSourceId:compte.id },{ compteDestId:compte.id }] }, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, include:{ compteSource:{ include:{ user:{ select:{ nom:true, prenom:true } } } }, compteDest:{ include:{ user:{ select:{ nom:true, prenom:true } } } } } })
    ]);
    return res.json({ data:virements.map(v=>({ ...v, montant:Number(v.montant), sens:v.compteSourceId===compte.id?'DEBIT':'CREDIT' })), pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function rechercherParRib(req: Request, res: Response) {
  try {
    const { rib } = req.params;
    if (!rib || rib.length < 5) return res.status(400).json({ error:'RIB trop court' });
    const compte = await prisma.compte.findUnique({ where:{ rib:rib.trim().toUpperCase() }, select:{ numeroCompte:true, rib:true, statut:true, user:{ select:{ nom:true, prenom:true } } } });
    if (!compte) return res.status(404).json({ error:'Aucun compte LCP avec ce RIB' });
    if (compte.statut !== 'ACTIF') return res.status(400).json({ error:'Ce compte est inactif' });
    return res.json({ data:{ rib:compte.rib, numeroCompte:compte.numeroCompte, nom:compte.user.nom, prenom:compte.user.prenom } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function tousLesVirements(req: Request, res: Response) {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string||'1'));
    const limit  = parseInt(req.query.limit as string||'20');
    const statut = req.query.statut as string|undefined;
    const where: any = {};
    if (statut) where.statut = statut;
    const [total, virements] = await Promise.all([
      prisma.virement.count({ where }),
      prisma.virement.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, include:{ compteSource:{ include:{ user:{ select:{ nom:true, prenom:true, telephone:true } } } }, compteDest:{ include:{ user:{ select:{ nom:true, prenom:true, telephone:true } } } } } })
    ]);
    return res.json({ data:virements.map(v=>({ ...v, montant:Number(v.montant) })), pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}
