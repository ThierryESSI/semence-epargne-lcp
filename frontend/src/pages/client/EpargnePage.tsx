// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/EpargnePage.tsx
// =====================================================================
// PAGE ÉPARGNE CLIENT — Plans SEMENCE avec bonus progressifs
// =====================================================================
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Modal, Btn, Alert, Spinner } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────
interface PalierInfo {
  key:       string;
  label:     string;
  duree:     string;
  taux:      number;
  tauxLabel: string;
  couleur:   string;
  icon:      string;
  avantages: string[];
}

const PALIERS: PalierInfo[] = [
  {
    key:       'TROIS_MOIS',
    label:     '3 mois',
    duree:     '90 jours',
    taux:      0.035,
    tauxLabel: '3,5%',
    couleur:   '#2d6a4f',
    icon:      '🌱',
    avantages: ['Aucun retrait pendant 3 mois', 'Minimum 2 versements', 'Bonus versé à l\'échéance']
  },
  {
    key:       'SIX_MOIS',
    label:     '6 mois',
    duree:     '180 jours',
    taux:      0.08,
    tauxLabel: '8%',
    couleur:   '#1d6fa4',
    icon:      '🌿',
    avantages: ['Aucun retrait pendant 6 mois', 'Minimum 3 versements', 'Bonus versé à l\'échéance']
  },
  {
    key:       'DOUZE_MOIS',
    label:     '1 an',
    duree:     '365 jours',
    taux:      0.17,
    tauxLabel: '17%',
    couleur:   '#a16207',
    icon:      '🌳',
    avantages: ['Aucun retrait pendant 12 mois', 'Minimum 6 versements', 'Bonus versé à l\'échéance']
  },
];

const STATUT_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  EN_COURS:    { label: 'En cours',    color: '#2d6a4f', bg: '#d8f3dc' },
  ELIGIBLE:    { label: 'Éligible',    color: '#a16207', bg: '#fff3cd' },
  BONIFIE:     { label: 'Bonifié ✅',  color: '#2d6a4f', bg: '#d8f3dc' },
  INTERROMPU:  { label: 'Interrompu',  color: '#c62828', bg: '#fee2e5' },
  EXPIRE:      { label: 'Expiré',      color: '#6b7280', bg: '#f1f5f9' },
};

// ─── Barre de progression ─────────────────────────────────────────────
function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ background: '#e8ede9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, background: value >= 100 ? C.green : color, borderRadius: 99, height: '100%', transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

// ─── Carte d'un plan actif ────────────────────────────────────────────
function PlanCard({ plan, onDebloquer }: { plan: any; onDebloquer: () => void }) {
  const statut  = STATUT_LABEL[plan.statut] || STATUT_LABEL.EN_COURS;
  const prog    = plan.progression;
  const palier  = PALIERS.find(p => p.key === plan.palier);

  return (
    <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
      {/* Header plan */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 32 }}>{palier?.icon}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Plan {palier?.label}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Bonus {palier?.tauxLabel} à l'échéance</div>
          </div>
        </div>
        <span style={{ background: statut.bg, color: statut.color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          {statut.label}
        </span>
      </div>

      {/* Montants */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Solde de départ', value: formatMontant(plan.soldeDepart), color: C.text },
          { label: 'Solde actuel', value: formatMontant(plan.soldeActuel), color: C.green },
          { label: 'Bonus estimé', value: `+${formatMontant(prog?.bonusEstime || Math.floor(plan.soldeActuel * plan.bonusTaux))}`, color: '#a16207' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8faf8', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Dates */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.textMuted, marginBottom: 14 }}>
        <span>Début : <strong>{formatDate(plan.dateDebut, 'dd/MM/yyyy')}</strong></span>
        <span>Échéance : <strong style={{ color: prog?.joursRestants === 0 ? C.green : C.text }}>
          {formatDate(plan.dateEcheance, 'dd/MM/yyyy')}
          {prog?.joursRestants > 0 && ` (dans ${prog.joursRestants}j)`}
          {prog?.joursRestants === 0 && ' ✅ Atteinte !'}
        </strong></span>
      </div>

      {/* Barres de progression */}
      {plan.statut === 'EN_COURS' && prog && (
        <div style={{ background: '#f8faf8', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <ProgressBar value={prog.progressionTemps} color={C.green} label="⏱ Durée écoulée" />
          <ProgressBar
            value={prog.progressionVersements}
            color={prog.conditionVersementsOK ? C.green : '#e65100'}
            label={`💳 Versements (${plan.nbVersementsEffectues}/${plan.nbVersementsRequis} requis)`}
          />
          {/* Conditions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: prog.conditionVersementsOK ? '#d8f3dc' : '#fee2e5', color: prog.conditionVersementsOK ? C.green : C.red, fontWeight: 600 }}>
              {prog.conditionVersementsOK ? '✓' : '✗'} Versements
            </span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: prog.conditionRetraitOK ? '#d8f3dc' : '#fee2e5', color: prog.conditionRetraitOK ? C.green : C.red, fontWeight: 600 }}>
              {prog.conditionRetraitOK ? '✓' : '✗'} Sans retrait
            </span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: prog.progressionTemps >= 100 ? '#d8f3dc' : '#f1f5f9', color: prog.progressionTemps >= 100 ? C.green : C.textMuted, fontWeight: 600 }}>
              {prog.progressionTemps >= 100 ? '✓' : '✗'} Durée atteinte
            </span>
          </div>
        </div>
      )}

      {/* Historique versements */}
      {plan.versements?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Versements effectués</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {plan.versements.map((v: any, i: number) => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                <span style={{ color: C.textMuted }}>Versement #{v.numeroVersement}</span>
                <span style={{ fontWeight: 700, color: C.green }}>+{formatMontant(v.montant)}</span>
                <span style={{ color: C.textMuted }}>{formatDate(v.dateVersement, 'dd/MM/yyyy')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonus versé */}
      {plan.statut === 'BONIFIE' && plan.bonusMontant && (
        <div style={{ background: '#d8f3dc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}></div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.green }}>+{formatMontant(plan.bonusMontant)} versés !</div>
          <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>Bonus {palier?.tauxLabel} crédité sur votre compte</div>
        </div>
      )}

      {/* Bouton déblocage */}
      {plan.statut === 'EN_COURS' && prog?.eligible && (
        <Btn onClick={onDebloquer} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} size="lg">
          🎁 Débloquer mon bonus de {formatMontant(prog.bonusEstime)}
        </Btn>
      )}

      {/* Interruption */}
      {plan.statut === 'INTERROMPU' && (
        <div style={{ background: '#fee2e5', borderRadius: 10, padding: 12, fontSize: 13, color: C.red, textAlign: 'center' }}>
          ❌ Ce plan a été interrompu suite à un retrait. Le bonus n'est pas accordé.
        </div>
      )}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────
export default function EpargnePage() {
  const [plans, setPlans]         = useState<any[]>([]);
  const [compte, setCompte]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [palierChoisi, setPalierChoisi] = useState<string>('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  async function charger() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get('/epargne/mes-plans'),
        api.get('/comptes/solde'),
      ]);
      setPlans(p.data.data || []);
      setCompte(c.data.data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleSouscrire(e: any) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/epargne/souscrire', { palier: palierChoisi });
      setSuccess(`Plan ${data.data.palier} activé ! Bonus estimé : ${formatMontant(data.data.bonusEstime)}`);
      setShowModal(false);
      charger();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false); }
  }

  async function handleDebloquer(planId: string) {
    try {
      const { data } = await api.post(`/epargne/bonus/${planId}`);
      setSuccess(` Bonus versé : +${formatMontant(data.bonusMontant)} FCFA !`);
      charger();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur');
    }
  }

  const planActif = plans.find(p => p.statut === 'EN_COURS');
  const palierInfo = palierChoisi ? PALIERS.find(p => p.key === palierChoisi) : null;
  const bonusEstime = palierInfo && compte ? Math.floor(Number(compte.solde) * palierInfo.taux) : 0;

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Mon Epargne SEMENCE"
        subtitle="Faites fructifier votre argent avec nos plans d'épargne bonifiés"
        action={
          !planActif && (
            <Btn onClick={() => { setShowModal(true); setError(''); setPalierChoisi(''); }}>
              + Souscrire à un plan
            </Btn>
          )
        }
      />

      {success && (
        <Alert type="success">
          <strong>{success}</strong>
        </Alert>
      )}
      {success && <div style={{ height: 12 }} />}

      {/* Solde actuel */}
      <div style={{ background: `linear-gradient(135deg, ${C.sidebarBg}, #2d4a30)`, borderRadius: 16, padding: 24, color: '#fff', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Solde disponible</div>
        <div style={{ fontSize: 36, fontWeight: 900 }}>{formatMontant(compte?.solde || 0)}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Compte {compte?.numeroCompte}</div>
      </div>

      {/* Plans existants */}
      {plans.length > 0 ? (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Mes plans d'épargne</h2>
          {plans.map(p => (
            <PlanCard key={p.id} plan={p} onDebloquer={() => handleDebloquer(p.id)} />
          ))}
        </>
      ) : (
        /* Invitation à souscrire */
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Choisissez votre plan d'épargne</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {PALIERS.map(p => (
              <div key={p.key} onClick={() => { setPalierChoisi(p.key); setShowModal(true); }}
                style={{ background: C.white, borderRadius: 16, border: `2px solid ${C.border}`, padding: 20, cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `2px solid ${p.couleur}`; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${p.couleur}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `2px solid ${C.border}`; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>{p.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: p.couleur, marginBottom: 4 }}>{p.tauxLabel}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 8 }}>Plan {p.label}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>{p.duree}</div>
                {p.avantages.map(a => (
                  <div key={a} style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, textAlign: 'left', display: 'flex', gap: 6 }}>
                    <span style={{ color: C.green }}>✓</span>{a}
                  </div>
                ))}
                <div style={{ marginTop: 14, background: p.couleur, color: '#fff', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700 }}>
                  Souscrire
                </div>
              </div>
            ))}
          </div>

          {/* Explication règles */}
          <div style={{ background: '#fffbf0', border: '1px solid #fde68a', borderRadius: 14, padding: 20, marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#a16207' }}>📋 Comment fonctionne le bonus SEMENCE ?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, fontSize: 13, color: C.textMuted }}>
              <div><strong style={{ color: C.text }}>1. Choisissez votre palier</strong><br/>3 mois (3,5%) · 6 mois (8%) · 12 mois (17%)</div>
              <div><strong style={{ color: C.text }}>2. Continuez à déposer</strong><br/>Effectuez au moins 50% des versements requis sur la période</div>
              <div><strong style={{ color: C.text }}>3. Ne touchez pas à votre épargne</strong><br/>Tout retrait avant l'échéance annule définitivement le bonus</div>
              <div><strong style={{ color: C.text }}>4. Recevez votre bonus</strong><br/>À l'échéance, le bonus est automatiquement crédité sur votre compte</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal souscription */}
      {showModal && (
        <Modal title="Souscrire à un plan d'épargne" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSouscrire}>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>
              Solde actuel : <strong style={{ color: C.green }}>{formatMontant(compte?.solde || 0)}</strong>
            </p>

            {/* Choix du palier */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {PALIERS.map(p => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `2px solid ${palierChoisi === p.key ? p.couleur : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: palierChoisi === p.key ? `${p.couleur}0d` : C.white }}>
                  <input type="radio" name="palier" value={p.key} checked={palierChoisi === p.key} onChange={e => setPalierChoisi(e.target.value)} style={{ accentColor: p.couleur }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.icon} Plan {p.label}</div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>{p.duree} · Min. {p.avantages[1].split('Minimum ')[1]}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: p.couleur }}>{p.tauxLabel}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>de bonus</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Estimation bonus */}
            {palierInfo && compte && (
              <div style={{ background: '#f0faf2', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>Estimation du bonus</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>Solde actuel</span><span>{formatMontant(compte.solde)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>Taux {palierInfo.tauxLabel}</span><span style={{ color: C.green }}>+{formatMontant(bonusEstime)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8 }}>
                  <span>Total estimé</span><span style={{ color: C.green }}>{formatMontant(Number(compte.solde) + bonusEstime)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>* Estimation basée sur le solde actuel. Le bonus final est calculé sur le solde à l'échéance.</div>
              </div>
            )}

            {/* Engagements */}
            {palierInfo && (
              <div style={{ background: '#fff8e7', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#a16207' }}>⚠️ En souscrivant, vous acceptez :</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: C.textMuted, lineHeight: 1.7 }}>
                  <li>Ne pas effectuer de retrait pendant <strong>{palierInfo.duree}</strong></li>
                  <li>Effectuer au moins <strong>{palierInfo.avantages[1].replace('Minimum ', '')}</strong></li>
                  <li>Tout retrait annule définitivement le bonus</li>
                </ul>
              </div>
            )}

            {error && <Alert type="error">{error}</Alert>}

            <Btn type="submit" loading={submitting} disabled={!palierChoisi} style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
              Activer le plan {palierInfo ? palierInfo.label : ''}
            </Btn>
          </form>
        </Modal>
      )}
    </div>
  );
}
