// frontend/src/pages/admin/UnarciAgency.tsx
// Agence UNARCI — liste des adhérents, fiche détaillée, validation des pièces,
// validation manuelle des paiements et export PDF.
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner, Badge, StatCard, TableWrapper, THead, TR, TD, SearchBar, Empty, Modal, Icon, ICONS } from '../../components/ui/DS';

const STATUTS = [
  { key:'',       label:'Tous' },
  { key:'INSCRIT',label:'Inscrits (paiement en attente)' },
  { key:'ACTIF',  label:'Actifs (payé + activé)' },
  { key:'REJETE', label:'Rejetés' },
];

// Styles de badge pour le statut des pièces jointes
const PIECES_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  EN_ATTENTE: { bg:'#fef3c7', color:'#92400e', label:'Pièces à vérifier' },
  CONFORMES:  { bg:C.greenPale, color:C.green, label:'Pièces conformes' },
  A_REVOIR:   { bg:C.redPale, color:C.red, label:'Pièces à revoir' },
};
const piecesBadge = (s: string) => {
  const st = PIECES_STYLES[s] || PIECES_STYLES.EN_ATTENTE;
  return <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>{st.label}</span>;
};

// ─── Fiche détaillée (modale) ─────────────────────────────────────
function FicheAdherent({ fiche, onClose, onValider, onPdf, saving, pdfLoading }: any) {
  if (!fiche) return null;
  const st = PIECES_STYLES[fiche.piecesStatut] || PIECES_STYLES.EN_ATTENTE;

  const PieceCard = ({ label, url }: { label: string; url?: string | null }) => (
    <div style={{ flex:1, minWidth:140 }}>
      <div style={{ fontSize:11.5, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 }}>{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Ouvrir dans un nouvel onglet">
          {url.includes('/raw/upload') || url.toLowerCase().endsWith('.pdf') ? (
            <div style={{ background:C.secondaryPl, borderRadius:10, padding:'14px 12px', textAlign:'center', fontSize:12, color:C.blue, fontWeight:700 }}>
              📄 Ouvrir le document PDF
            </div>
          ) : (
            <img src={url} alt={label} loading="lazy"
              style={{ width:'100%', height:130, objectFit:'cover', borderRadius:10, border:`1px solid ${C.border}`, cursor:'zoom-in' }} />
          )}
        </a>
      ) : (
        <div style={{ border:`1.5px dashed ${C.border}`, borderRadius:10, height:130, display:'flex', alignItems:'center', justifyContent:'center', color:C.textLight, fontSize:12 }}>
          Non fournie
        </div>
      )}
    </div>
  );

  const Row = ({ label, value }: { label: string; value: any }) => (
    <div style={{ display:'flex', borderBottom:`1px solid ${C.borderLight}`, padding:'7px 0', fontSize:13 }}>
      <span style={{ width:190, flexShrink:0, color:C.textMuted }}>{label}</span>
      <span style={{ color:C.text, fontWeight:600 }}>{value || '—'}</span>
    </div>
  );

  const Section = ({ title, children }: any) => (
    <div style={{ marginTop:18 }}>
      <div style={{ fontSize:11, fontWeight:800, color:C.primary, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <Modal title={`Fiche adhérent — ${fiche.reference}`} onClose={onClose} wide>
      {/* En-tête */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>{fiche.nomComplet}</div>
        <Badge v={fiche.statut === 'ACTIF' ? 'Actif' : fiche.statut === 'INSCRIT' ? 'En attente de paiement' : 'Rejeté'} />
        {piecesBadge(fiche.piecesStatut)}
      </div>
      <div style={{ fontSize:12.5, color:C.textMuted, marginBottom:4 }}>
        📞 {fiche.telephone || '—'} &nbsp;·&nbsp; ✉️ {fiche.email || '—'} &nbsp;·&nbsp; 📍 {fiche.ville || fiche.region || '—'}
      </div>
      <div style={{ fontSize:12, color:C.textMuted }}>
        Inscrit le {new Date(fiche.createdAt).toLocaleString('fr-CI')}
        {fiche.activateAt && <> · Activé le {new Date(fiche.activateAt).toLocaleString('fr-CI')}</>}
        {fiche.piecesVerifieesAt && <> · Pièces vérifiées le {new Date(fiche.piecesVerifieesAt).toLocaleString('fr-CI')}</>}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', margin:'14px 0 4px' }}>
        {fiche.piecesStatut !== 'CONFORMES' && (
          <Btn size="sm" loading={saving === 'conformes'} onClick={() => onValider(true)}
            style={{ background:C.green, color:'#fff', border:'none' }}>
            ✓ Pièces conformes
          </Btn>
        )}
        {fiche.piecesStatut !== 'A_REVOIR' && (
          <Btn size="sm" variant="danger" loading={saving === 'arevoir'} onClick={() => onValider(false)}>
            ✗ Pièces à revoir
          </Btn>
        )}
        <Btn size="sm" variant="ghost" loading={pdfLoading} onClick={onPdf} style={{ marginLeft:'auto' }}>
          <Icon d={ICONS.download} size={15} /> Exporter PDF
        </Btn>
      </div>

      {fiche.piecesStatut === 'A_REVOIR' && fiche.piecesMotif && (
        <Alert type="warning">Motif : {fiche.piecesMotif}</Alert>
      )}

      {/* Pièces jointes */}
      <div style={{ marginTop:16, padding:14, background:'#fbfdff', border:`1px solid ${C.border}`, borderRadius:12 }}>
        <div style={{ fontSize:11, fontWeight:800, color:C.primary, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Pièces jointes</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <PieceCard label="Photo d'identité" url={fiche.pieces?.photo} />
          <PieceCard label="Pièce recto" url={fiche.pieces?.pieceRecto} />
          <PieceCard label="Pièce verso" url={fiche.pieces?.pieceVerso} />
        </div>
      </div>

      <Section title="État civil & localisation">
        <Row label="Nom et prénoms" value={fiche.nomComplet} />
        <Row label="Région / Ville / Village" value={[fiche.region, fiche.ville, fiche.village].filter(Boolean).join(' · ')} />
        <Row label="CNI N°" value={fiche.numeroCni} />
        <Row label="Passeport N°" value={fiche.numeroPasseport} />
        <Row label="Permis N°" value={fiche.numeroPermis} />
        <Row label="Situation matrimoniale" value={fiche.situation === 'MARIEE' ? 'Marié(e)' : fiche.situation === 'CELIBATAIRE' ? 'Célibataire' : fiche.situation} />
        <Row label="Conjoint(e)" value={fiche.nomConjoint} />
        <Row label="Enfants à charge" value={fiche.nombreEnfantsCharge} />
        <Row label="Ayant droit" value={fiche.nomAyantDroit} />
      </Section>

      <Section title="Vie professionnelle & personne morale">
        <Row label="Nom d'artiste" value={fiche.nomArtiste} />
        <Row label="Début de carrière" value={fiche.debutCarriere} />
        <Row label="Corps de métier" value={fiche.corpsMetier} />
        <Row label="Type de structure" value={fiche.typeStructure} />
        <Row label="Nom du groupe / association" value={fiche.nomStructure} />
        <Row label="Représentant légal" value={fiche.representantLegal} />
        <Row label="Spécialités" value={fiche.specialites} />
      </Section>

      <Section title="Urgence">
        <Row label="Personne à contacter" value={fiche.urgenceNom} />
        <Row label="Contacts" value={fiche.urgenceContacts} />
        <Row label="Filiation" value={fiche.urgenceFiliation} />
      </Section>

      <Section title="Compte & provenance">
        <Row label="Numéro de compte" value={fiche.compte?.numeroCompte} />
        <Row label="RIB" value={fiche.compte?.rib} />
        <Row label="Statut du compte" value={fiche.compte?.statut} />
        <Row label="Code client" value={fiche.client?.code} />
        <Row label="Distributeur" value={fiche.provenance?.distributeur ? `${fiche.provenance.distributeur.code} — ${fiche.provenance.distributeur.nomEntreprise}` : null} />
        <Row label="Conseiller" value={fiche.provenance?.conseiller ? `${fiche.provenance.conseiller.prenom || ''} ${fiche.provenance.conseiller.nom || ''}`.trim() : null} />
        <Row label="Cotisation" value={`${Number(fiche.montantAdhesion).toLocaleString('fr-CI')} FCFA`} />
        <Row label="Numéro de paie LCP" value={fiche.numeroPaie} />
      </Section>
    </Modal>
  );
}

// ─── Page principale ──────────────────────────────────────────────
export default function UnarciAgency() {
  const [adherents, setAdherents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total:0, inscrits:0, actifs:0, rejetes:0 });
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statut, setStatut] = useState('');
  const [search, setSearch] = useState('');

  const [fiche, setFiche] = useState<any>(null);
  const [ficheLoading, setFicheLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [a, s] = await Promise.all([
        api.get('/unarci/agence/adherents', { params:{ statut: statut || undefined, search: search || undefined } }),
        api.get('/unarci/agence/stats'),
      ]);
      setAdherents(a.data.data || []);
      setStats(s.data.data || {});
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statut, search]);

  async function activer(id: string, nom: string) {
    if (!confirm(`Valider le paiement et activer le compte de ${nom} ?`)) return;
    setActivating(id); setError(''); setSuccess('');
    try {
      await api.post(`/unarci/agence/activer/${id}`);
      setSuccess(`Compte de ${nom} activé — paiement validé.`);
      load();
      if (fiche?.id === id) setFiche((f: any) => ({ ...f, statut:'ACTIF' }));
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setActivating(null); }
  }

  async function openFiche(a: any) {
    setError(''); setFiche(null); setFicheLoading(true);
    try {
      const { data } = await api.get(`/unarci/agence/adherents/${a.id}`);
      setFiche(data.data);
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur de chargement de la fiche'); }
    finally { setFicheLoading(false); }
  }

  async function validerPieces(conformes: boolean) {
    if (!fiche) return;
    let motif = '';
    if (!conformes) {
      motif = prompt(`Motif des pièces à revoir (ex: photo floue, CNI illisible) :`)?.trim() || '';
      if (!motif) return;
    }
    setSaving(conformes ? 'conformes' : 'arevoir'); setError(''); setSuccess('');
    try {
      const { data } = await api.post(`/unarci/agence/pieces/${fiche.id}`, { conformes, motif });
      setFiche((f: any) => ({ ...f, piecesStatut: data.data.piecesStatut, piecesMotif: data.data.piecesMotif, piecesVerifieesAt: new Date().toISOString() }));
      setSuccess(conformes ? 'Pièces marquées conformes.' : 'Pièces à revoir notées.');
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setSaving(null); }
  }

  async function downloadPdf() {
    if (!fiche) return;
    setPdfLoading(true); setError('');
    try {
      const r = await api.get(`/unarci/agence/adherents/${fiche.id}/pdf`, { responseType:'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `fiche-adherent-${fiche.reference}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur de génération du PDF'); }
    finally { setPdfLoading(false); }
  }

  const badge = (s: string) => {
    const map: Record<string, [string, string]> = {
      INSCRIT: ['#a16207', '#fff8e7'],
      ACTIF:   ['#2d6a4f', '#e6f6ef'],
      REJETE:  ['#b3261e', '#fdecea'],
    };
    const [color, bg] = map[s] || ['#0F2E52', '#eef3fa'];
    return { color, bg, label: s === 'ACTIF' ? 'Payé / Actif' : s === 'INSCRIT' ? 'En attente de paiement' : s };
  };

  return (
    <div>
      <PageHeader title="Adhésions UNARCI" subtitle="Adhérents enregistrés via le formulaire public — vérifiez les pièces, validez les paiements, exportez les fiches" />

      {error   && <Alert type="error"  >{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        <StatCard label="Total adhérents" value={stats.total || 0} icon="◎" iconColor={C.primary} />
        <StatCard label="En attente de paiement" value={stats.inscrits || 0} icon="⏳" iconColor="#a16207" />
        <StatCard label="Payés / Actifs" value={stats.actifs || 0} icon="✓" iconColor="#2d6a4f" />
        <StatCard label="Rejetés" value={stats.rejetes || 0} icon="✗" iconColor="#b3261e" />
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        {STATUTS.map(s => (
          <button key={s.key} onClick={() => setStatut(s.key)}
            style={{ background: statut === s.key ? C.primary : '#fff', color: statut === s.key ? '#fff' : C.textMuted,
              border: statut === s.key ? 'none' : `1.5px solid ${C.border}`, borderRadius: 8, padding:'7px 14px',
              fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher (nom, référence, téléphone)..." />

      {loading ? <Spinner /> : adherents.length === 0 ? (
        <Empty msg="Aucun adhérent pour ce filtre" />
      ) : (
        <TableWrapper>
          <THead cols={['Référence','Adhérent','Téléphone / Email','Ville','Pièces','Statut','Inscrit le','Action']} />
          {adherents.map(a => {
            const b = badge(a.statut);
            return (
              <TR key={a.id} onClick={() => openFiche(a)}>
                <TD mono>{a.reference}</TD>
                <TD bold>{a.nomComplet}</TD>
                <TD>{a.user?.telephone}<br/><span style={{ color:C.textMuted, fontSize:11 }}>{a.user?.email}</span></TD>
                <TD>{a.ville || '—'}</TD>
                <TD>{piecesBadge(a.piecesStatut || 'EN_ATTENTE')}</TD>
                <TD><Badge v={b.label} /></TD>
                <TD>{new Date(a.createdAt).toLocaleDateString('fr-CI')}</TD>
                <TD onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button onClick={() => openFiche(a)} title="Voir la fiche détaillée"
                      style={{ background:C.secondaryPl, border:'none', borderRadius:7, padding:'6px 9px', cursor:'pointer', color:C.blue, display:'flex', alignItems:'center' }}>
                      <Icon d={ICONS.eye} size={15} />
                    </button>
                    {a.statut === 'INSCRIT' && (
                      <Btn size="sm" loading={activating === a.id} onClick={() => activer(a.id, a.nomComplet)}>
                        Valider paiement
                      </Btn>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TableWrapper>
      )}

      {ficheLoading && <Spinner />}
      <FicheAdherent
        fiche={fiche}
        onClose={() => setFiche(null)}
        onValider={validerPieces}
        onPdf={downloadPdf}
        saving={saving}
        pdfLoading={pdfLoading}
      />
    </div>
  );
}
