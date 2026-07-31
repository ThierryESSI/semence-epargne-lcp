// frontend/src/pages/public/HomePage.tsx
// © 2024-2026 Le Credit Panafricain (LCP) — Semence Epargne
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import logo from '../../assets/logo.png';

// ── Couleurs de marque ────────────────────────────────────────────
const PRI  = '#F65A04';
const PRID = '#C94800';
const SEC  = '#1C5B9B';
const DARK = '#0F2E52';
const BG   = '#F7F9FC';
const WHITE = '#FFFFFF';
const MUTED = '#6B7C9A';
const BORDER = '#DDE6F0';

// ── Config CMS par défaut (éditables via Paramètres admin) ───────
const DEFAULT_CMS: Record<string, string> = {
  SITE_NOM:         'Semence Epargne',
  SITE_SLOGAN:      'Le crédit qui transforme vos projets en réalité',
  SITE_ACCROCHE:    'Entrepreneurs, commerçants, artisans — accédez enfin à un financement simple, rapide et sans formalités bancaires complexes.',
  SITE_TEL:         '+225 27 35 96 05 99',
  SITE_EMAIL:       'infos@semenceep.ci',
  SITE_WHATSAPP:    '+2250708249583',
  SITE_ADRESSE:     'COCODY les OSCARS Bd Latrille, Abidjan',
  SITE_AGREMENT:    'Agréé ARTCI CI — RC CI-ABJ-2016-B 6706',
  HERO_TITRE:       'Financez votre avenir dès aujourd\'hui',
  HERO_SOUS_TITRE:  'Des microcrédits de 50 000 à 5 000 000 FCFA pour les entrepreneurs ivoiriens exclus du système bancaire traditionnel.',
  HERO_CTA:         'Faire une demande',
  CHIFFRE_PROJETS:  '1 200+',
  CHIFFRE_SATISF:   '95%',
  CHIFFRE_DELAI:    '72h',
  CHIFFRE_TAUX:     '2,5%',
  TEMOIGNAGE_1_NOM: 'Adjoua K., commerçante',
  TEMOIGNAGE_1_TXT: 'Grâce à Semence Epargne, j\'ai pu agrandir mon commerce de tissu. En 3 jours j\'avais les fonds, sans caution impossible.',
  TEMOIGNAGE_2_NOM: 'Koné M., prestataire BTP',
  TEMOIGNAGE_2_TXT: 'J\'avais un chantier à financer et la banque m\'a refusé. LCP m\'a fait confiance. Aujourd\'hui j\'emploie 5 personnes.',
  MENTION_LEGALE:   'Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.',
};

// ── Simulateur de crédit ──────────────────────────────────────────
function Simulateur() {
  const [montant, setMontant] = useState(500000);
  const [duree,   setDuree]   = useState(12);
  const taux    = 0.025; // 2.5% mensuel
  const mensualite = Math.round(montant * taux / (1 - Math.pow(1 + taux, -duree)));
  const total      = Math.round(mensualite * duree);
  const cout       = total - montant;
  const taeg       = ((Math.pow(1 + taux, 12) - 1) * 100).toFixed(1);
  const fCFA = (n: number) => new Intl.NumberFormat('fr-CI').format(n) + ' FCFA';

  return (
    <div style={{ background: WHITE, borderRadius: 20, padding: '32px 28px', boxShadow: '0 8px 40px rgba(15,46,82,0.12)', border: `1px solid ${BORDER}` }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: PRI, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Simulateur de crédit</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>Estimez votre financement</h3>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>Résultat immédiat, sans engagement</p>
      </div>

      {/* Slider montant */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: DARK }}>Montant souhaité</label>
          <span style={{ fontSize: 15, fontWeight: 800, color: PRI }}>{fCFA(montant)}</span>
        </div>
        <input type="range" min={50000} max={5000000} step={50000} value={montant} onChange={e => setMontant(+e.target.value)}
          style={{ width: '100%', accentColor: PRI, height: 4, cursor: 'pointer' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 4 }}>
          <span>50 000 FCFA</span><span>5 000 000 FCFA</span>
        </div>
      </div>

      {/* Slider durée */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: DARK }}>Durée de remboursement</label>
          <span style={{ fontSize: 15, fontWeight: 800, color: SEC }}>{duree} mois</span>
        </div>
        <input type="range" min={3} max={36} step={3} value={duree} onChange={e => setDuree(+e.target.value)}
          style={{ width: '100%', accentColor: SEC, height: 4, cursor: 'pointer' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 4 }}>
          <span>3 mois</span><span>36 mois</span>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ background: `linear-gradient(135deg, ${DARK}, ${SEC})`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
          {[
            ['Mensualité', fCFA(mensualite), WHITE],
            ['Coût total', fCFA(cout), '#FFB380'],
            [`TAEG fixe`, `${taeg}%`, '#80C8FF'],
          ].map(([label, val, color]) => (
            <div key={label}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div style={{ color: color as string, fontWeight: 800, fontSize: 16 }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          Total remboursé : {fCFA(total)} · Taux mensuel : {(taux*100).toFixed(1)}% · Sans frais cachés
        </div>
      </div>

      <a href="#formulaire" style={{ display: 'block', background: `linear-gradient(135deg, ${PRI}, ${PRID})`, color: WHITE, textAlign: 'center', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 20px rgba(246,90,4,0.35)` }}>
        Valider mon projet →
      </a>
      <p style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginTop: 10 }}>
        Simulation non contractuelle — Taux indicatif sujet à étude de dossier
      </p>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export default function HomePage() {
  const navigate      = useNavigate();
  const [cms, setCms] = useState(DEFAULT_CMS);
  const [form, setForm] = useState({ nom:'', email:'', telephone:'', montant:'' });
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/site-config/public')
      .then(r => setCms({ ...DEFAULT_CMS, ...r.data.data }))
      .catch(() => {});
  }, []);

  function handleForm(e: React.FormEvent) {
    e.preventDefault();
    // Envoie via WhatsApp si pas d'API formulaire
    const msg = encodeURIComponent(`Demande de crédit Semence Epargne\nNom: ${form.nom}\nEmail: ${form.email}\nTéléphone: ${form.telephone}\nMontant souhaité: ${form.montant} FCFA`);
    window.open(`https://wa.me/${cms.SITE_WHATSAPP?.replace(/\D/g,'')}?text=${msg}`, '_blank');
    setSent(true);
  }

  const wa = cms.SITE_WHATSAPP?.replace(/\D/g,'');

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: DARK, lineHeight: 1.6, background: BG }}>

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav style={{ background: WHITE, borderBottom: `1px solid ${BORDER}`, padding: '0 6%', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 12px rgba(15,46,82,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Logo" style={{ height: 40 }}/>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: DARK, lineHeight: 1.1 }}>{cms.SITE_NOM}</div>
            <div style={{ fontSize: 10, color: MUTED }}>Le Crédit Panafricain</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="#services" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 500, padding: '0 10px' }}>Services</a>
          <a href="#comment" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 500, padding: '0 10px' }}>Comment ça marche</a>
          <a href="#temoignages" style={{ color: MUTED, textDecoration: 'none', fontSize: 13, fontWeight: 500, padding: '0 10px' }}>Témoignages</a>
          <button onClick={() => navigate('/login')}
            style={{ background: 'transparent', color: SEC, border: `1.5px solid ${SEC}`, borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Connexion
          </button>
          <a href="#formulaire" style={{ background: `linear-gradient(135deg,${PRI},${PRID})`, color: WHITE, borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: `0 3px 12px rgba(246,90,4,0.3)` }}>
            Faire une demande
          </a>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1a3d6e 55%, ${SEC} 100%)`, padding: '80px 6% 70px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-block', background: `rgba(246,90,4,0.2)`, color: '#FFB380', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, marginBottom: 20, letterSpacing: '.05em' }}>
            Microfinance · Côte d'Ivoire
          </div>
          <h1 style={{ color: WHITE, fontSize: 42, fontWeight: 900, lineHeight: 1.15, margin: '0 0 18px' }}>
            {cms.HERO_TITRE}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            {cms.HERO_SOUS_TITRE}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="#formulaire" style={{ background: `linear-gradient(135deg,${PRI},${PRID})`, color: WHITE, borderRadius: 12, padding: '14px 28px', fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: `0 6px 24px rgba(246,90,4,0.45)`, display: 'inline-block' }}>
              {cms.HERO_CTA} →
            </a>
            <a href="#simulateur" style={{ background: 'rgba(255,255,255,0.1)', color: WHITE, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 12, padding: '14px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              Simuler mon crédit
            </a>
          </div>
          {/* Chiffres clés rapides */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 44 }}>
            {[
              [cms.CHIFFRE_PROJETS, 'Projets financés'],
              [cms.CHIFFRE_SATISF,  'Clients satisfaits'],
              [cms.CHIFFRE_DELAI,   'Délai de réponse'],
              [cms.CHIFFRE_TAUX,    'Taux mensuel'],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ color: PRI, fontWeight: 900, fontSize: 22 }}>{v}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Visuel hero */}
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: 32, border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
            <div style={{ color: WHITE, fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Semence Epargne</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Votre épargne, votre avenir</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['💳', 'Cartes Semence', 'Épargnez par versements'],
              ['💸', 'Virements', 'Entre comptes LCP'],
              ['📡', 'SMS', 'Même sans internet'],
              ['🔒', 'Sécurisé', 'OTP à chaque opération'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ color: WHITE, fontWeight: 600, fontSize: 12 }}>{title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIMULATEUR ────────────────────────────────────── */}
      <section id="simulateur" style={{ padding: '72px 6%', background: `linear-gradient(180deg, #EEF3FA 0%, ${BG} 100%)` }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PRI, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Outil d'estimation</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>Combien pouvez-vous emprunter ?</h2>
          <p style={{ color: MUTED, fontSize: 15, maxWidth: 500, margin: '0 auto' }}>Utilisez notre simulateur pour estimer votre mensualité en quelques secondes.</p>
        </div>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <Simulateur />
        </div>
      </section>

      {/* ── SERVICES / CRITÈRES ───────────────────────────── */}
      <section id="services" style={{ padding: '72px 6%', background: WHITE }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PRI, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Notre offre</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>Services et critères d'éligibilité</h2>
          <p style={{ color: MUTED, fontSize: 15, maxWidth: 540, margin: '0 auto' }}>Conçu pour les entrepreneurs ivoiriens qui méritent une chance.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 48 }}>
          {[
            { icon: '🏪', titre: 'Commerce & Négoce', desc: 'Stocks, marchandises, fonds de roulement pour votre activité commerciale.' },
            { icon: '🔧', titre: 'Artisanat & Services', desc: 'Matériel, équipements, atelier — développez votre savoir-faire.' },
            { icon: '🌾', titre: 'Agriculture & Élevage', desc: 'Intrants, semences, équipements agricoles pour la saison.' },
          ].map(s => (
            <div key={s.titre} style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 20px', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px rgba(246,90,4,0.12)`; (e.currentTarget as HTMLElement).style.borderColor = PRI; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{s.titre}</div>
              <div style={{ color: MUTED, fontSize: 13 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Critères d'éligibilité */}
        <div style={{ background: `linear-gradient(135deg, ${DARK}, ${SEC})`, borderRadius: 20, padding: '32px 36px' }}>
          <h3 style={{ color: WHITE, fontWeight: 800, fontSize: 20, marginBottom: 24, textAlign: 'center' }}>Critères d'éligibilité</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {[
              ['✓', 'Résider en Côte d\'Ivoire'],
              ['✓', 'Avoir une activité génératrice de revenus'],
              ['✓', 'Être âgé de 18 à 65 ans'],
              ['✓', 'Posséder une pièce d\'identité valide'],
              ['✓', 'Avoir un numéro de téléphone CI actif'],
              ['✓', 'Pas de garantie immobilière requise'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: PRI, fontWeight: 900, fontSize: 18 }}>{icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESSUS EN 3 ÉTAPES ─────────────────────────── */}
      <section id="comment" style={{ padding: '72px 6%', background: BG }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PRI, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Comment ça marche</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>Financement en 3 étapes simples</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, position: 'relative' }}>
          {[
            { num: '1', titre: 'Simulation', desc: 'Utilisez notre simulateur pour estimer votre mensualité et votre capacité d\'emprunt en moins de 2 minutes.', icon: '🖥️', color: PRI },
            { num: '2', titre: 'Étude du dossier', desc: 'Notre équipe analyse votre dossier sous 72h. Nous vous contactons directement par téléphone ou WhatsApp.', icon: '📋', color: SEC },
            { num: '3', titre: 'Financement', desc: 'Une fois validé, les fonds sont versés sur votre compte Semence Epargne. Activez votre carte et commencez.', icon: '💰', color: '#2d6a4f' },
          ].map((step, i) => (
            <div key={step.num} style={{ background: WHITE, borderRadius: 18, padding: '28px 24px', position: 'relative', boxShadow: '0 4px 20px rgba(15,46,82,0.07)', border: `1px solid ${BORDER}` }}>
              <div style={{ width: 52, height: 52, background: step.color, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: WHITE, marginBottom: 16 }}>
                {step.num}
              </div>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{step.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{step.titre}</div>
              <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
              {i < 2 && <div style={{ position: 'absolute', right: -16, top: '40%', fontSize: 24, color: BORDER, zIndex: 1 }}>→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── TÉMOIGNAGES ───────────────────────────────────── */}
      <section id="temoignages" style={{ padding: '72px 6%', background: WHITE }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PRI, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Ils nous font confiance</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>Ce que disent nos clients</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {[
            { nom: cms.TEMOIGNAGE_1_NOM, txt: cms.TEMOIGNAGE_1_TXT, initial: 'A' },
            { nom: cms.TEMOIGNAGE_2_NOM, txt: cms.TEMOIGNAGE_2_TXT, initial: 'K' },
          ].map(t => (
            <div key={t.nom} style={{ background: BG, borderRadius: 18, padding: '28px 24px', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 36, color: PRI, marginBottom: 12, lineHeight: 1 }}>"</div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: DARK, margin: '0 0 20px', fontStyle: 'italic' }}>{t.txt}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, background: `linear-gradient(135deg,${PRI},${PRID})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontWeight: 800, fontSize: 18 }}>{t.initial}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.nom}</div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>{'★★★★★'.split('').map((s,i) => <span key={i} style={{ color: PRI, fontSize: 12 }}>{s}</span>)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULAIRE ────────────────────────────────────── */}
      <section id="formulaire" ref={formRef} style={{ padding: '72px 6%', background: `linear-gradient(135deg, ${DARK}, ${SEC})` }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#FFB380', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Demande de financement</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: WHITE, margin: '0 0 10px' }}>Lancez votre projet aujourd'hui</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 32 }}>Réponse sous 72h. Aucun engagement à ce stade.</p>
          {sent ? (
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, color: WHITE }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Demande envoyée !</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Notre équipe vous contacte sous 72h.</div>
            </div>
          ) : (
            <form onSubmit={handleForm} style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '32px 28px', border: '1px solid rgba(255,255,255,0.12)' }}>
              {[
                { key: 'nom',       label: 'Nom et prénom *',     placeholder: 'Koné Aminata',           type: 'text' },
                { key: 'email',     label: 'Email',                placeholder: 'votre@email.com',        type: 'email' },
                { key: 'telephone', label: 'Téléphone CI *',       placeholder: '07 XX XX XX XX',         type: 'tel' },
                { key: 'montant',   label: 'Montant souhaité (FCFA) *', placeholder: 'Ex : 500 000',     type: 'number' },
              ].map(f => (
                <div key={f.key} style={{ textAlign: 'left', marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} required={f.label.includes('*')}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: WHITE, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}/>
                </div>
              ))}
              <button type="submit" style={{ width: '100%', background: `linear-gradient(135deg,${PRI},${PRID})`, color: WHITE, border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8, boxShadow: `0 4px 20px rgba(246,90,4,0.4)` }}>
                Envoyer ma demande →
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer style={{ background: '#060e1a', color: 'rgba(255,255,255,0.5)', padding: '32px 6%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src={logo} alt="Logo" style={{ height: 36 }}/>
              <div>
                <div style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>{cms.SITE_NOM}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Le Crédit Panafricain</div>
              </div>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{cms.SITE_AGREMENT}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>{cms.MENTION_LEGALE}</p>
          </div>
          <div>
            <div style={{ color: WHITE, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Services</div>
            {['Cartes Semence', 'Plans épargne', 'Virements LCP', 'Recharge SMS'].map(l => (
              <div key={l} style={{ fontSize: 12, marginBottom: 8 }}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{ color: WHITE, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Contact</div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>{cms.SITE_TEL}</div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>{cms.SITE_EMAIL}</div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>{cms.SITE_ADRESSE}</div>
          </div>
          <div>
            <div style={{ color: WHITE, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Accès rapide</div>
            <div onClick={() => window.open(`https://wa.me/${wa}`, '_blank')}
              style={{ fontSize: 12, marginBottom: 8, cursor: 'pointer', color: '#25d366' }}>
              WhatsApp
            </div>
            <div onClick={() => navigate('/login')}
              style={{ fontSize: 12, marginBottom: 8, cursor: 'pointer', color: '#80C8FF' }}>
              Espace client
            </div>
            <a href="#formulaire" style={{ fontSize: 12, color: '#FFB380', textDecoration: 'none' }}>Faire une demande</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
          <span>© {new Date().getFullYear()} Le Crédit Panafricain (LCP) — Tous droits réservés</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ cursor: 'pointer' }}>Mentions légales</span>
            <span style={{ cursor: 'pointer' }}>Politique de confidentialité</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
