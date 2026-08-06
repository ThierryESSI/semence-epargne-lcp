// frontend/src/pages/public/UnarciPage.tsx
// Formulaire d'adhésion UNARCI — semenceep.ci/unarci
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import logo from '../../assets/logo.png';
import WhatsAppButton from '../../components/ui/WhatsAppButton';

const PRI  = '#F65A04';
const PRID = '#C94800';
const SEC  = '#1C5B9B';
const DARK = '#0F2E52';
const BG   = '#F7F9FC';
const WHITE = '#FFFFFF';
const MUTED = '#6B7C9A';
const BORDER = '#DDE6F0';

// Pièces jointes — mêmes règles que le backend (max 5 Mo, JPG/PNG/WebP/PDF)
const MAX_FILE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const EMPTY = {
  pays:'Côte d\'Ivoire', region:'', ville:'', village:'', campement:'',
  nomComplet:'', nomPere:'', nomMere:'', telephone:'', email:'',
  numeroCni:'', numeroPasseport:'', numeroPermis:'',
  situation:'', nomConjoint:'', naissanceConjoint:'', nombreEnfantsCharge:'', nomAyantDroit:'', naissanceAyantDroit:'',
  nomArtiste:'', debutCarriere:'', corpsMetier:'',
  typeStructure:'', nomStructure:'', representantLegal:'', dateCreationStructure:'', specialites:'',
  urgenceNom:'', urgenceContacts:'', urgenceFiliation:'',
};

type Form = typeof EMPTY;

export default function UnarciPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [montant, setMontant] = useState(10000);
  const [numeroPaie, setNumeroPaie] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [files, setFiles] = useState<{ photo?: File; pieceRecto?: File; pieceVerso?: File }>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [whatsapp, setWhatsapp] = useState('+2250708249583');

  useEffect(() => {
    api.get('/unarci/config')
      .then(r => { setMontant(r.data.data?.montant || 10000); setNumeroPaie(r.data.data?.numeroPaie || ''); })
      .catch(() => {});
    api.get('/site-config/public')
      .then(r => { if (r.data.data?.SITE_WHATSAPP) setWhatsapp(r.data.data.SITE_WHATSAPP); })
      .catch(() => {});
  }, []);

  const set = (k: keyof Form) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  function onFile(k: keyof typeof files, file?: File) {
    setFileErrors(prev => ({ ...prev, [k]: '' }));
    if (!file) return setFiles(f => ({ ...f, [k]: undefined }));
    if (!ALLOWED_TYPES.includes(file.type))
      return setFileErrors(prev => ({ ...prev, [k]: 'Format non supporté. Accepté : JPG, PNG, WebP ou PDF.' }));
    if (file.size > MAX_FILE)
      return setFileErrors(prev => ({ ...prev, [k]: 'Fichier trop volumineux (5 Mo maximum).' }));
    setFiles(f => ({ ...f, [k]: file }));
  }

  const sections = [
    { id:'localisation', title:'1. Localisation', fields:[
      { k:'region',   label:'Région *', type:'text' },
      { k:'ville',    label:'Ville',     type:'text' },
      { k:'village',  label:'Villages',  type:'text' },
      { k:'campement',label:'Campement', type:'text' },
    ]},
    { id:'civil', title:'2. État civil', fields:[
      { k:'nomComplet', label:'Nom et prénoms *', type:'text' },
      { k:'nomPere',    label:'Nom du père',      type:'text' },
      { k:'nomMere',    label:'Nom de la mère',   type:'text' },
      { k:'telephone',  label:'Contacts (téléphone CI) *', type:'tel' },
      { k:'email',      label:'E-mail',           type:'email' },
      { k:'numeroCni',  label:'Carte nationale d\'identité ivoirienne', type:'text' },
      { k:'numeroPasseport', label:'Passeport N°', type:'text' },
      { k:'numeroPermis',    label:'Permis de conduire N°', type:'text' },
    ]},
    { id:'matrimonial', title:'3. Situation matrimoniale', fields:[
      { k:'nomConjoint',     label:'Nom et prénoms conjoint(e)', type:'text' },
      { k:'naissanceConjoint',label:'Date et lieu de naissance conjoint(e)', type:'text' },
      { k:'nombreEnfantsCharge', label:'Nombre d\'enfants à charge', type:'number' },
      { k:'nomAyantDroit',   label:'Nom et prénoms d\'un ayant droit', type:'text' },
      { k:'naissanceAyantDroit', label:'Date et lieu de naissance de l\'ayant droit', type:'text' },
    ]},
    { id:'profession', title:'4. Vie professionnelle', fields:[
      { k:'nomArtiste',   label:'Nom d\'artiste', type:'text' },
      { k:'debutCarriere',label:'Début de carrière', type:'text' },
      { k:'corpsMetier',  label:'Corps de métier (ex: peintre, artiste chanteur)', type:'text' },
    ]},
    { id:'morale', title:'5. Personne morale (groupe ou association)', fields:[
      { k:'nomStructure', label:'Nom du groupe / association', type:'text' },
      { k:'representantLegal', label:'Représentant légal', type:'text' },
      { k:'dateCreationStructure', label:'Date de création', type:'text' },
      { k:'specialites',  label:'Spécialités', type:'text' },
    ]},
    { id:'urgence', title:'6. Personne à contacter en cas d\'urgence', fields:[
      { k:'urgenceNom',       label:'Nom et prénoms', type:'text' },
      { k:'urgenceContacts',  label:'Contacts', type:'text' },
      { k:'urgenceFiliation', label:'Filiation (frère/sœur/père/mère/cousin/ami/époux)', type:'text' },
    ]},
  ];

  const inputStyle: React.CSSProperties = {
    width:'100%', border:`1.5px solid ${BORDER}`, borderRadius:8, padding:'10px 12px',
    fontSize:14, fontFamily:'inherit', boxSizing:'border-box', outline:'none', background:'#fff',
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nomComplet.trim()) return setError('Le nom complet est requis.');
    if (!form.telephone.trim()) return setError('Le téléphone est requis.');
    if (form.telephone.replace(/\D/g,'').length < 8) return setError('Numéro de téléphone invalide.');
    if (!form.region.trim()) return setError('La région est requise.');
    if (Object.values(fileErrors).some(Boolean)) return setError('Vérifiez les pièces jointes (format et taille).');
    setLoading(true);
    try {
      // Envoi multipart : champs texte + pièces jointes (photo + pièce d'identité)
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v); });
      const { data } = await api.post('/unarci/adhesion', fd, { timeout: 90000 });
      setResult(data.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi. Réessayez.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ fontFamily:"'Segoe UI', system-ui, sans-serif", color:DARK, lineHeight:1.6, background:BG, minHeight:'100vh' }}>
      {/* Navbar */}
      <nav style={{ background:WHITE, borderBottom:`1px solid ${BORDER}`, padding:'0 6%', height:66, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <img src={logo} alt="Logo" style={{ height:40 }}/>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:DARK, lineHeight:1.1 }}>Semence Epargne</div>
            <div style={{ fontSize:10, color:MUTED }}>Le Crédit Panafricain</div>
          </div>
        </Link>
        <Link to="/" style={{ color:SEC, textDecoration:'none', fontSize:13, fontWeight:600, padding:'7px 16px', border:`1.5px solid ${SEC}`, borderRadius:8 }}>Retour à l'accueil</Link>
      </nav>

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, ${DARK}, ${SEC})`, padding:'56px 6% 120px', textAlign:'center' }}>
        <div style={{ display:'inline-block', background:'rgba(246,90,4,0.2)', color:'#FFB380', borderRadius:20, padding:'4px 14px', fontSize:12, fontWeight:700, marginBottom:16, letterSpacing:'.05em' }}>UNARCI · Le Crédit Panafricain</div>
        <h1 style={{ color:WHITE, fontSize:38, fontWeight:900, margin:'0 0 10px' }}>Adhésion UNARCI</h1>
        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:15, maxWidth:560, margin:'0 auto' }}>
          Devenez membre de l'UNARCI et ouvrez automatiquement votre compte d'épargne Semence.
          Une cotisation de <strong style={{ color:'#FFB380' }}>{montant.toLocaleString('fr-CI')} FCFA</strong> suffit.
        </p>
      </div>

      {/* Formulaire */}
      <div style={{ maxWidth:760, margin:'-80px auto 60px', padding:'0 6%' }}>
        {result ? (
          <div style={{ background:WHITE, borderRadius:20, border:`1px solid ${BORDER}`, boxShadow:'0 8px 40px rgba(15,46,82,0.12)', padding:'40px 32px', textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:'0 0 8px' }}>Adhésion enregistrée !</h2>
            <p style={{ color:MUTED, margin:'0 0 20px' }}>
              Un SMS a été envoyé à votre numéro avec vos identifiants et les instructions de paiement.
            </p>
            <div style={{ background:BG, borderRadius:14, padding:20, textAlign:'left', maxWidth:480, margin:'0 auto' }}>
              <Row label="Référence" value={result.reference} />
              <Row label="Numéro de compte" value={result.numeroCompte} />
              <Row label="Cotisation" value={`${result.montant.toLocaleString('fr-CI')} FCFA`} />
              <Row label="Numéro de paie LCP" value={result.numeroPaie} bold />
            </div>
            <div style={{ background:'#fff8e7', color:'#a16207', borderRadius:10, padding:'12px 16px', fontSize:13, margin:'18px auto 0', maxWidth:480 }}>
              Payez la cotisation par mobile money au <strong>{result.numeroPaie}</strong>, conservez la preuve,
              puis informez l'agence UNARCI. Votre compte sera activé après validation du paiement.
            </div>
            <Link to="/" style={{ display:'inline-block', marginTop:24, background:`linear-gradient(135deg,${PRI},${PRID})`, color:WHITE, padding:'12px 28px', borderRadius:10, fontWeight:700, textDecoration:'none' }}>Retour à l'accueil</Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background:WHITE, borderRadius:20, border:`1px solid ${BORDER}`, boxShadow:'0 8px 40px rgba(15,46,82,0.12)', overflow:'hidden' }}>
            {error && <div style={{ background:'#fdecea', color:'#b3261e', padding:'12px 20px', fontSize:13, fontWeight:600 }}>{error}</div>}
            <div style={{ padding:'26px 28px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:18 }}>Formulaire UNARCI</div>
                <div style={{ fontSize:12, color:MUTED }}>Tous les champs marqués * sont obligatoires</div>
              </div>
              <div style={{ background:'#fff8e7', color:'#a16207', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700 }}>
                Cotisation : {montant.toLocaleString('fr-CI')} FCFA
              </div>
            </div>

            {sections.map(sec => (
              <fieldset key={sec.id} style={{ border:'none', borderBottom:`1px solid ${BORDER}`, padding:'22px 28px', margin:0 }}>
                <legend style={{ fontWeight:700, fontSize:14, color:SEC, marginBottom:14, padding:0 }}>{sec.title}</legend>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {sec.fields.map(f => (
                    <div key={f.k} style={f.k === 'corpsMetier' || f.k === 'specialites' ? { gridColumn:'1 / -1' } : {}}>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, color:MUTED, marginBottom:5 }}>{f.label}</label>
                      <input type={f.type} value={(form as any)[f.k]} onChange={set(f.k as keyof Form)}
                        style={inputStyle} required={f.k === 'nomComplet' || f.k === 'telephone' || f.k === 'region'} />
                    </div>
                  ))}
                </div>
                {sec.id === 'matrimonial' && (
                  <div style={{ marginTop:14 }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:MUTED, marginBottom:6 }}>Situation matrimoniale</label>
                    <select value={form.situation} onChange={set('situation')} style={{ ...inputStyle }}>
                      <option value="">— Choisir —</option>
                      <option value="MARIEE">Marié(e)</option>
                      <option value="CELIBATAIRE">Célibataire</option>
                    </select>
                  </div>
                )}
                {sec.id === 'morale' && (
                  <div style={{ marginTop:14 }}>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:MUTED, marginBottom:6 }}>Type de structure</label>
                    <select value={form.typeStructure} onChange={set('typeStructure')} style={{ ...inputStyle }}>
                      <option value="">— Aucune / Individuel —</option>
                      <option value="GROUPE">Groupe</option>
                      <option value="ASSOCIATION">Association</option>
                    </select>
                  </div>
                )}
              </fieldset>
            ))}

            {/* 7. Pièces à fournir */}
            <fieldset style={{ border:'none', borderBottom:`1px solid ${BORDER}`, padding:'22px 28px', margin:0 }}>
              <legend style={{ fontWeight:700, fontSize:14, color:SEC, marginBottom:14, padding:0 }}>7. Pièces à fournir</legend>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px', lineHeight:1.7 }}>
                Joignez votre <strong>photo d'identité</strong> et une copie de votre <strong>pièce d'identité</strong>
                (CNI, passeport ou permis de conduire). Formats acceptés : JPG, PNG, WebP ou PDF — 5 Mo maximum par fichier.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <FileSlot id="f-photo" label="Photo d'identité" hint="Format passeport recommandé" wide
                  file={files.photo} error={fileErrors.photo}
                  onChange={f => onFile('photo', f)} />
                <FileSlot id="f-recto" label="Pièce d'identité — recto" hint="CNI, passeport ou permis"
                  file={files.pieceRecto} error={fileErrors.pieceRecto}
                  onChange={f => onFile('pieceRecto', f)} />
                <FileSlot id="f-verso" label="Pièce d'identité — verso" hint="Page arrière du document"
                  file={files.pieceVerso} error={fileErrors.pieceVerso}
                  onChange={f => onFile('pieceVerso', f)} />
              </div>
            </fieldset>

            <div style={{ padding:'22px 28px' }}>
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:`linear-gradient(135deg,${PRI},${PRID})`, color:WHITE, border:'none', borderRadius:12, padding:'15px', fontSize:16, fontWeight:800, cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1, fontFamily:'inherit', boxShadow:`0 4px 20px rgba(246,90,4,0.4)` }}>
                {loading ? 'Enregistrement en cours...' : 'Soumettre mon adhésion UNARCI'}
              </button>
              <p style={{ fontSize:11, color:MUTED, textAlign:'center', marginTop:12 }}>
                En soumettant, vous acceptez d'être automatiquement enregistré(e) comme client Semence Epargne (LCP).
                Un SMS contenant vos identifiants et le numéro de paie vous sera envoyé.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Bouton WhatsApp persistant (visible pendant le défilement) */}
      <WhatsAppButton whatsapp={whatsapp} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px dashed #e2e8f0', fontSize:13 }}>
      <span style={{ color:MUTED }}>{label}</span>
      <span style={{ fontWeight:bold?800:600, color:DARK }}>{value}</span>
    </div>
  );
}

// ── Zone de dépôt d'une pièce jointe ─────────────────────────────
function formatBytes(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

function FileSlot({ id, label, hint, wide, file, error, onChange }: {
  id: string; label: string; hint: string; wide?: boolean;
  file?: File; error?: string;
  onChange: (f?: File) => void;
}) {
  const isImage = !!file && file.type.startsWith('image/');
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : {}}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:MUTED, marginBottom:5 }}>{label}</label>
      <label htmlFor={id} style={{
        display:'flex', alignItems:'center', gap:14, border:`1.5px dashed ${error ? '#e0a0a0' : BORDER}`,
        borderRadius:10, padding: file ? '10px 14px' : '0 14px', cursor:'pointer',
        background: error ? '#fdf3f2' : '#fbfdff', transition:'border-color .15s',
      }}>
        {file ? (
          <>
            {isImage && (
              <img src={URL.createObjectURL(file)} alt={file.name} style={{ width:44, height:44, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13, color:DARK, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{file.name}</div>
              <div style={{ fontSize:11, color:MUTED }}>{formatBytes(file.size)}</div>
            </div>
            <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(undefined); }}
              style={{ background:'#fdecea', color:'#b3261e', border:'none', borderRadius:7, padding:'6px 12px', fontSize:11.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              Retirer
            </button>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'16px 0', width:'100%' }}>
            <div style={{ fontSize:22 }}>📎</div>
            <div style={{ fontSize:13, color:SEC, fontWeight:600, marginTop:2 }}>Cliquez pour joindre un fichier</div>
            <div style={{ fontSize:11, color:MUTED }}>{hint}</div>
          </div>
        )}
      </label>
      <input id={id} type="file" accept={ALLOWED_TYPES.join(',')} style={{ display:'none' }}
        onChange={e => { onChange(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <div style={{ color:'#b3261e', fontSize:11.5, marginTop:5 }}>{error}</div>}
    </div>
  );
}
