// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/VirementPage.tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Input, Btn, Alert, Spinner, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';
import { usePaginated } from '../../hooks/useData';

type Step = 'form' | 'confirm' | 'otp' | 'success';

export default function VirementPage() {
  const [step, setStep]           = useState<Step>('form');
  const [rib, setRib]             = useState('');
  const [montant, setMontant]     = useState('');
  const [motif, setMotif]         = useState('');
  const [destInfo, setDestInfo]   = useState<any>(null);
  const [virementId, setVirementId] = useState('');
  const [virRef, setVirRef]       = useState('');
  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState<any>(null);
  const [ribSearch, setRibSearch] = useState(false);
  const { items: historique, loading: loadHist } = usePaginated<any>('/virements/mes-virements');

  async function rechercherRib() {
    if (!rib || rib.length < 5) return;
    setRibSearch(true); setError('');
    try {
      const { data } = await api.get(`/virements/rib/${rib.toUpperCase()}`);
      setDestInfo(data.data);
    } catch (err: any) {
      setDestInfo(null);
      setError(err.response?.data?.error || 'RIB introuvable');
    } finally { setRibSearch(false); }
  }

  async function initier() {
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/virements/initier', { ribDest: rib, montant: parseFloat(montant), motif });
      setVirementId(data.data.virementId);
      setVirRef(data.data.reference);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setLoading(false); }
  }

  async function confirmer() {
    if (otp.length !== 6) return setError('Le code OTP fait 6 chiffres');
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/virements/confirmer', { virementId, codeOtp: otp });
      setSuccess(data.data);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code incorrect');
    } finally { setLoading(false); }
  }

  function reset() {
    setStep('form'); setRib(''); setMontant(''); setMotif(''); setDestInfo(null);
    setVirementId(''); setOtp(''); setError(''); setSuccess(null);
  }

  const montantNum = parseFloat(montant) || 0;

  return (
    <div>
      <PageHeader title="Virement LCP" subtitle="Transférer des fonds vers un autre compte LCP" />

      {/* ─── ÉTAPE : FORMULAIRE ─── */}
      {step === 'form' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          <div>
            <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: C.text }}>Nouveau virement</h3>

              {/* RIB destinataire */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  RIB destinataire <span style={{ color: C.red }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={rib} onChange={e => { setRib(e.target.value.toUpperCase()); setDestInfo(null); setError(''); }}
                    placeholder="LCP-CI-XXXXXXXXXX"
                    style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.05em' }}
                    onKeyDown={e => e.key === 'Enter' && rechercherRib()}
                  />
                  <Btn onClick={rechercherRib} loading={ribSearch} variant="secondary" size="sm">Vérifier</Btn>
                </div>

                {/* Destinataire trouvé */}
                {destInfo && (
                  <div style={{ marginTop: 10, background: C.greenPale, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: C.green, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {destInfo.prenom?.[0]}{destInfo.nom?.[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>✅ {destInfo.prenom} {destInfo.nom}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>Compte : {destInfo.numeroCompte}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Montant */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Montant (FCFA) <span style={{ color: C.red }}>*</span>
                </label>
                <input
                  type="number" value={montant} onChange={e => setMontant(e.target.value)} min={100} placeholder="Ex: 5000"
                  style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: C.green, textAlign: 'right' }}
                />
                {montantNum > 0 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'right' }}>{formatMontant(montantNum)}</div>}
              </div>

              {/* Motif */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Motif (optionnel)</label>
                <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Remboursement, Cadeau..."
                  style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }}/>
              </div>

              {error && <Alert type="error">{error}</Alert>}
              <div style={{ height: 8 }} />

              <Btn onClick={initier} loading={loading} disabled={!destInfo || montantNum < 100}
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
                Envoyer {montantNum > 0 ? formatMontant(montantNum) : ''}
              </Btn>
            </div>

            {/* Historique */}
            <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: C.text }}>Historique des virements</h3>
              {loadHist ? <Spinner /> : historique.length === 0 ? (
                <div style={{ textAlign: 'center', color: C.textMuted, padding: '20px 0', fontSize: 13 }}>Aucun virement effectué</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historique.map((v: any) => {
                    const isDebit = v.sens === 'DEBIT';
                    const autre   = isDebit ? v.compteDest?.user : v.compteSource?.user;
                    return (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {isDebit ? '↗ Envoyé à' : '↙ Reçu de'} {autre?.prenom} {autre?.nom}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{v.motif || 'Virement LCP'} · {formatDate(v.createdAt, 'dd/MM/yyyy')}</div>
                          <div style={{ fontSize: 11, color: C.textLight, fontFamily: 'monospace' }}>{v.reference}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: isDebit ? C.red : C.green }}>
                            {isDebit ? '-' : '+'}{formatMontant(v.montant)}
                          </div>
                          <span style={{ background: v.statut === 'VALIDE' ? C.greenPale : C.goldPale, color: v.statut === 'VALIDE' ? C.green : '#a16207', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                            {v.statut}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panneau info */}
          <div>
            <div style={{ background: `linear-gradient(135deg, ${C.sidebarBg}, #2d4a30)`, borderRadius: 14, padding: 20, color: '#fff', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Comment ça fonctionne</div>
              {[
                ['1', 'Entrez le RIB du destinataire', 'Format LCP-CI-XXXXXXXXXX'],
                ['2', 'Saisissez le montant', 'Minimum 100 FCFA'],
                ['3', 'Confirmez avec le code OTP', 'Reçu par SMS sur votre téléphone'],
                ['4', 'Virement instantané', 'Les deux comptes sont mis à jour immédiatement'],
              ].map(([n, t, d]) => (
                <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 22, height: 22, background: C.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{n}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{d}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Conditions</div>
              {['Uniquement entre comptes LCP actifs', 'Virement instantané et irrévocable', 'Aucun frais sur les virements internes', 'Confirmation obligatoire par code SMS'].map(c => (
                <div key={c} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, display: 'flex', gap: 6 }}>
                  <span style={{ color: C.green }}>✓</span>{c}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ÉTAPE : CODE OTP ─── */}
      {step === 'otp' && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
            <h3 style={{ margin: '0 0 8px', color: C.text, fontSize: 20, fontWeight: 700 }}>Code de confirmation</h3>
            <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>
              Un code à 6 chiffres a été envoyé par SMS sur votre téléphone. Saisissez-le pour confirmer le virement.
            </p>

            <div style={{ background: C.greenPale, borderRadius: 12, padding: 14, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 4 }}>Récapitulatif du virement</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: C.textMuted }}>Destinataire</span>
                <span style={{ fontWeight: 700 }}>{destInfo?.prenom} {destInfo?.nom}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: C.textMuted }}>Montant</span>
                <span style={{ fontWeight: 800, color: C.green, fontSize: 18 }}>{formatMontant(montantNum)}</span>
              </div>
              {motif && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.textMuted }}>Motif</span><span>{motif}</span>
              </div>}
            </div>

            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" maxLength={6}
              style={{ width: '100%', border: `2px solid ${C.border}`, borderRadius: 12, padding: '14px', fontSize: 32, fontWeight: 800, textAlign: 'center', letterSpacing: '0.5em', outline: 'none', boxSizing: 'border-box', color: C.text, fontFamily: 'monospace' }}
              onFocus={e => e.target.style.borderColor = C.green}
              onBlur={e => e.target.style.borderColor = C.border}
            />

            {error && <div style={{ marginTop: 12 }}><Alert type="error">{error}</Alert></div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn variant="secondary" onClick={() => { setStep('form'); setOtp(''); setError(''); }} style={{ flex: 1, justifyContent: 'center' }}>Annuler</Btn>
              <Btn onClick={confirmer} loading={loading} disabled={otp.length !== 6} style={{ flex: 2, justifyContent: 'center', padding: '13px' }} size="lg">
                Confirmer le virement
              </Btn>
            </div>
            <p style={{ fontSize: 11, color: C.textLight, marginTop: 12 }}>Code valable 10 minutes</p>
          </div>
        </div>
      )}

      {/* ─── ÉTAPE : SUCCÈS ─── */}
      {step === 'success' && success && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ background: C.white, borderRadius: 16, border: `2px solid ${C.green}`, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: C.green, fontSize: 22, fontWeight: 800 }}>Virement réussi !</h3>
            <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>Votre virement a été effectué instantanément.</p>
            <div style={{ background: C.greenPale, borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 20 }}>
              {[
                ['Référence', success.reference, true],
                ['Destinataire', `${success.destinataire?.prenom} ${success.destinataire?.nom}`, false],
                ['Compte destinataire', success.destinataire?.compte, true],
                ['Montant transféré', formatMontant(success.montant), false],
                ['Nouveau solde', formatMontant(success.soldeNouveau), false],
              ].map(([k, v, mono]: any) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                  <span style={{ color: C.textMuted, fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', color: k === 'Montant transféré' ? C.green : C.text }}>{v}</span>
                </div>
              ))}
            </div>
            <Btn onClick={reset} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>Nouveau virement</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
