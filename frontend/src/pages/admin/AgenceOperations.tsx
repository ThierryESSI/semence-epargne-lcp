// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/AgenceOperations.tsx
// Opérations en agence : Dépôt, Retrait, Virement (conseiller/distributeur)
import { useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Input, Btn, Alert, Spinner, Icon, ICONS, TableWrapper, THead, TR, TD, Badge, Pagination, SearchBar, Empty } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';
import { usePaginated } from '../../hooks/useData';

type Tab = 'depot' | 'retrait' | 'virement' | 'historique';
type Step = 'form' | 'otp' | 'success';

export default function AgenceOperations() {
  const [tab, setTab] = useState<Tab>('depot');
  const [step, setStep] = useState<Step>('form');

  // Client selection
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Form
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [ribDest, setRibDest] = useState('');
  const [ribDestInfo, setRibDestInfo] = useState<any>(null);
  const [ribSearchLoading, setRibSearchLoading] = useState(false);
  const [otpDest, setOtpDest] = useState<'CLIENT' | 'CONSEILLER'>('CLIENT');

  // OTP / operation state
  const [operationId, setOperationId] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  // History
  const { items: historique, pagination, loading: loadHist, page, setPage } = usePaginated<any>('/agence/historique');

  // ─── Client search ────────────────────────────────────────────────────────
  async function searchClient(q: string) {
    setClientQuery(q);
    if (q.length < 2) { setClientResults([]); return; }
    setClientSearching(true);
    try {
      const { data } = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=10`);
      setClientResults(data.data || []);
    } catch { setClientResults([]); }
    finally { setClientSearching(false); }
  }

  function selectClient(c: any) {
    setSelectedClient(c);
    setClientQuery('');
    setClientResults([]);
    setError('');
  }

  // Clear dropdown on Escape
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setClientResults([]);
  }

  // ─── RIB search (virement) ────────────────────────────────────────────────
  async function rechercherRib() {
    if (!ribDest || ribDest.length < 5) return;
    setRibSearchLoading(true); setError('');
    try {
      const { data } = await api.get(`/virements/rib/${ribDest.toUpperCase()}`);
      setRibDestInfo(data.data);
    } catch (err: any) {
      setRibDestInfo(null);
      setError(err.response?.data?.error || 'RIB introuvable');
    } finally { setRibSearchLoading(false); }
  }

  // ─── DEPÔT EN AGENCE ──────────────────────────────────────────────────────
  async function submitDepot() {
    if (!selectedClient || !montant) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/agence/depot', {
        clientUserId: selectedClient.user?.id,
        montant: parseFloat(montant),
        motif: motif || undefined,
      });
      setSuccess(data.data);
      setSelectedClient((c: any) => c ? { ...c, solde: data.data.nouveauSolde } : c);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du dépôt');
    } finally { setLoading(false); }
  }

  // ─── RETRAIT : INITIER ────────────────────────────────────────────────────
  async function initierRetrait() {
    if (!selectedClient || !montant) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/agence/retrait/initier', {
        clientUserId: selectedClient.user?.id,
        montant: parseFloat(montant),
        motif: motif || undefined,
        destinataire: otpDest,
      });
      setOperationId(data.data.retraitId);
      setSuccess(data.data);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'initiation');
    } finally { setLoading(false); }
  }

  // ─── RETRAIT : CONFIRMER ──────────────────────────────────────────────────
  async function confirmerRetrait() {
    if (!operationId || otp.length !== 6) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/agence/retrait/confirmer', {
        retraitId: operationId,
        codeOtp: otp,
      });
      setSuccess(data.data);
      setSelectedClient((c: any) => c ? { ...c, solde: data.data.nouveauSolde } : c);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code incorrect');
    } finally { setLoading(false); }
  }

  // ─── VIREMENT : INITIER ───────────────────────────────────────────────────
  async function initierVirement() {
    if (!selectedClient || !ribDestInfo || !montant) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/agence/virement/initier', {
        clientUserIdSource: selectedClient.user?.id,
        ribDest: ribDest,
        montant: parseFloat(montant),
        motif: motif || undefined,
        destinataire: otpDest,
      });
      setOperationId(data.data.virementId);
      setSuccess(data.data);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'initiation');
    } finally { setLoading(false); }
  }

  // ─── VIREMENT : CONFIRMER ─────────────────────────────────────────────────
  async function confirmerVirement() {
    if (!operationId || otp.length !== 6) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/agence/virement/confirmer', {
        virementId: operationId,
        codeOtp: otp,
      });
      setSuccess(data.data);
      setSelectedClient((c: any) => c ? { ...c, solde: data.data.soldeNouveau } : c);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code incorrect');
    } finally { setLoading(false); }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function resetForm() {
    setStep('form'); setMontant(''); setMotif(''); setRibDest(''); setRibDestInfo(null);
    setOperationId(''); setOtp(''); setError(''); setSuccess(null); setOtpDest('CLIENT');
  }

  function resetAll() {
    resetForm();
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
  }

  const montantNum = parseFloat(montant) || 0;

  return (
    <div>
      <PageHeader title="Opérations en agence" subtitle="Dépôt, retrait et virement sur compte client" />

      {/* ─── SÉLECTION CLIENT ─── */}
      {!selectedClient ? (
        <div style={{ maxWidth: 520, marginBottom: 24 }}>
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text }}>
              Sélectionner un client
            </h3>
            <div style={{ position: 'relative' }}>
              <input
                value={clientQuery} onChange={e => searchClient(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Rechercher par nom, prénom ou téléphone..."
                style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = C.green}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              {clientSearching && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${C.greenPale}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                </div>
              )}
              {clientResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 4, maxHeight: 300, overflowY: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                  {clientResults.map((c: any) => {
                    const user = c.user || {};
                    return (
                      <div key={c.id} onMouseDown={(e) => { e.preventDefault(); selectClient(c); }}
                        style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.borderLight}`, transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.greenPale}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{user.prenom} {user.nom}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{user.telephone} · {c.numeroCompte || c.code}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── CLIENT SÉLECTIONNÉ ─── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
          <div>
            {/* Client info */}
            <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, background: `linear-gradient(135deg, ${C.green}, ${C.greenLight})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                  {selectedClient.user?.prenom?.[0]}{selectedClient.user?.nom?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{selectedClient.user?.prenom} {selectedClient.user?.nom}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {selectedClient.user?.telephone} · Compte {selectedClient.numeroCompte || selectedClient.code}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Solde</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{formatMontant(selectedClient.solde || 0)}</div>
                </div>
                <Btn variant="ghost" size="sm" onClick={resetAll}>Changer</Btn>
              </div>
            </div>

            {/* Tabs */}
            {step !== 'success' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {([['depot', 'Dépôt', C.green], ['retrait', 'Retrait', C.red], ['virement', 'Virement', C.secondary], ['historique', 'Historique', C.textMuted]] as const).map(([key, label, color]) => (
                  <button key={key} onClick={() => { setTab(key); resetForm(); }}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: tab === key ? 700 : 500, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s',
                      background: tab === key ? color : 'transparent',
                      color: tab === key ? '#fff' : C.textMuted,
                    }}
                  >{label}</button>
                ))}
              </div>
            )}

            {/* ─── DÉPÔT ─── */}
            {step !== 'success' && tab === 'depot' && (
              <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: C.text }}>
                  Déposer sur le compte client
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    Montant (FCFA) <span style={{ color: C.red }}>*</span>
                  </label>
                  <input type="number" value={montant} onChange={e => setMontant(e.target.value)} min={100} max={100000000} placeholder="Ex: 10000"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: C.green, textAlign: 'right' }} />
                  {montantNum > 0 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'right' }}>{formatMontant(montantNum)}</div>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Motif (optionnel)</label>
                  <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Dépôt espèces"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                </div>
                {error && <Alert type="error">{error}</Alert>}
                {error && <div style={{ height: 8 }} />}
                <Btn onClick={submitDepot} loading={loading} disabled={montantNum < 100}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
                  Confirmer le dépôt {montantNum > 0 ? formatMontant(montantNum) : ''}
                </Btn>
              </div>
            )}

            {/* ─── RETRAIT : FORM ─── */}
            {step === 'form' && tab === 'retrait' && (
              <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: C.text }}>
                  Retirer du compte client
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    Montant (FCFA) <span style={{ color: C.red }}>*</span>
                  </label>
                  <input type="number" value={montant} onChange={e => setMontant(e.target.value)} min={100} max={100000000} placeholder="Ex: 5000"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: C.red, textAlign: 'right' }} />
                  {montantNum > 0 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'right' }}>{formatMontant(montantNum)}</div>}
                  {montantNum > 0 && selectedClient.solde && (
                    <div style={{ fontSize: 12, color: montantNum > Number(selectedClient.solde) ? C.red : C.textMuted, marginTop: 2, textAlign: 'right' }}>
                      Solde disponible : {formatMontant(selectedClient.solde)}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Motif (optionnel)</label>
                  <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Retrait espèces"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Envoyer le code OTP à <span style={{ color: C.red }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['CLIENT', '📱 Au client'], ['CONSEILLER', '👩‍💼 Au conseiller (vous)']].map(([val, label]) => (
                      <button key={val} onClick={() => setOtpDest(val as any)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${otpDest === val ? C.secondary : C.border}`, background: otpDest === val ? C.secondaryPl : 'transparent', color: otpDest === val ? C.secondary : C.textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <Alert type="error">{error}</Alert>}
                {error && <div style={{ height: 8 }} />}
                <Btn onClick={initierRetrait} loading={loading} disabled={montantNum < 100 || montantNum > Number(selectedClient.solde || 0)}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
                  Initier le retrait {montantNum > 0 ? formatMontant(montantNum) : ''}
                </Btn>
              </div>
            )}

            {/* ─── VIREMENT : FORM ─── */}
            {step === 'form' && tab === 'virement' && (
              <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: C.text }}>
                  Virement depuis le compte client
                </h3>
                {/* RIB destinataire */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    RIB destinataire <span style={{ color: C.red }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={ribDest} onChange={e => { setRibDest(e.target.value.toUpperCase()); setRibDestInfo(null); setError(''); }}
                      placeholder="LCP-CI-XXXXXXXXXX"
                      style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.05em', boxSizing: 'border-box' }}
                      onKeyDown={e => e.key === 'Enter' && rechercherRib()}
                    />
                    <Btn onClick={rechercherRib} loading={ribSearchLoading} variant="secondary" size="sm">Vérifier</Btn>
                  </div>
                  {ribDestInfo && (
                    <div style={{ marginTop: 10, background: C.greenPale, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: C.green, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {ribDestInfo.prenom?.[0]}{ribDestInfo.nom?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: C.green, fontSize: 14 }}>✅ {ribDestInfo.prenom} {ribDestInfo.nom}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>Compte : {ribDestInfo.numeroCompte}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    Montant (FCFA) <span style={{ color: C.red }}>*</span>
                  </label>
                  <input type="number" value={montant} onChange={e => setMontant(e.target.value)} min={100} max={100000000} placeholder="Ex: 5000"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: C.secondary, textAlign: 'right' }} />
                  {montantNum > 0 && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'right' }}>{formatMontant(montantNum)}</div>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Motif (optionnel)</label>
                  <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Virement agence"
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Envoyer le code OTP à <span style={{ color: C.red }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['CLIENT', '📱 Au client source'], ['CONSEILLER', '👩‍💼 Au conseiller (vous)']].map(([val, label]) => (
                      <button key={val} onClick={() => setOtpDest(val as any)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${otpDest === val ? C.secondary : C.border}`, background: otpDest === val ? C.secondaryPl : 'transparent', color: otpDest === val ? C.secondary : C.textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <Alert type="error">{error}</Alert>}
                {error && <div style={{ height: 8 }} />}
                <Btn onClick={initierVirement} loading={loading} disabled={!ribDestInfo || montantNum < 100 || montantNum > Number(selectedClient.solde || 0)}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
                  Envoyer {montantNum > 0 ? formatMontant(montantNum) : ''}
                </Btn>
              </div>
            )}

            {/* ─── OTP CONFIRMATION (retrait & virement) ─── */}
            {step === 'otp' && (
              <div style={{ maxWidth: 480, margin: '0 auto' }}>
                <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
                  <h3 style={{ margin: '0 0 8px', color: C.text, fontSize: 20, fontWeight: 700 }}>Code de confirmation</h3>
                  <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>
                    Un code à 6 chiffres a été envoyé par SMS. Saisissez-le pour confirmer l'opération.
                  </p>

                  <div style={{ background: C.greenPale, borderRadius: 12, padding: 14, marginBottom: 24, textAlign: 'left' }}>
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 4 }}>Récapitulatif</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                      <span style={{ color: C.textMuted }}>Opération</span>
                      <span style={{ fontWeight: 700 }}>{tab === 'retrait' ? 'Retrait' : 'Virement'} en agence</span>
                    </div>
                    {tab === 'virement' && success?.destinataire && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                        <span style={{ color: C.textMuted }}>Destinataire</span>
                        <span style={{ fontWeight: 700 }}>{success.destinataire.prenom} {success.destinataire.nom}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: C.textMuted }}>Montant</span>
                      <span style={{ fontWeight: 800, color: C.green, fontSize: 18 }}>{formatMontant(success?.montant || montantNum)}</span>
                    </div>
                    {success?.otpEnvoyeA && (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, fontStyle: 'italic' }}>
                        Code envoyé au {success.otpEnvoyeA === 'CLIENT' ? 'client' : 'conseiller'}
                      </div>
                    )}
                  </div>

                  <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••" maxLength={6}
                    style={{ width: '100%', border: `2px solid ${C.border}`, borderRadius: 12, padding: '14px', fontSize: 32, fontWeight: 800, textAlign: 'center', letterSpacing: '0.5em', outline: 'none', boxSizing: 'border-box', color: C.text, fontFamily: 'monospace' }}
                    onFocus={e => e.target.style.borderColor = C.green}
                    onBlur={e => e.target.style.borderColor = C.border}
                    autoFocus
                  />

                  {error && <div style={{ marginTop: 12 }}><Alert type="error">{error}</Alert></div>}

                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <Btn variant="secondary" onClick={() => { setStep('form'); setOtp(''); setError(''); }} style={{ flex: 1, justifyContent: 'center' }}>Annuler</Btn>
                    <Btn onClick={tab === 'retrait' ? confirmerRetrait : confirmerVirement} loading={loading} disabled={otp.length !== 6} style={{ flex: 2, justifyContent: 'center', padding: '13px' }} size="lg">
                      Confirmer {tab === 'retrait' ? 'le retrait' : 'le virement'}
                    </Btn>
                  </div>
                  <p style={{ fontSize: 11, color: C.textLight, marginTop: 12 }}>Code valable 10 minutes</p>
                </div>
              </div>
            )}

            {/* ─── SUCCÈS ─── */}
            {step === 'success' && success && (
              <div style={{ maxWidth: 520, margin: '0 auto' }}>
                <div style={{ background: C.white, borderRadius: 16, border: `2px solid ${C.green}`, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                  <h3 style={{ margin: '0 0 8px', color: C.green, fontSize: 22, fontWeight: 800 }}>Opération réussie !</h3>
                  <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>
                    {tab === 'depot' && `Dépôt de ${formatMontant(success.montant || montantNum)} effectué sur le compte de ${selectedClient.user?.prenom} ${selectedClient.user?.nom}`}
                    {tab === 'retrait' && `Retrait de ${formatMontant(success.montant || montantNum)} effectué`}
                    {tab === 'virement' && `Virement de ${formatMontant(success.montant || montantNum)} effectué`}
                  </p>
                  <div style={{ background: C.greenPale, borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                    {(tab === 'depot'
                      ? [
                          ['Référence', success.transactionRef || success.reference, true],
                          ['Montant déposé', formatMontant(success.montant || montantNum), false],
                          ['Nouveau solde', formatMontant(success.nouveauSolde || 0), false],
                        ]
                      : tab === 'retrait'
                      ? [
                          ['Référence', success.reference, true],
                          ['Montant retiré', formatMontant(success.montant || montantNum), false],
                          ['Nouveau solde', formatMontant(success.nouveauSolde || 0), false],
                          ['Client', `${success.client?.prenom || selectedClient.user?.prenom} ${success.client?.nom || selectedClient.user?.nom}`, false],
                        ]
                      : [
                          ['Référence', success.reference, true],
                          ['Montant transféré', formatMontant(success.montant || montantNum), false],
                          ['Nouveau solde', formatMontant(success.soldeNouveau || 0), false],
                          ['Destinataire', `${success.destinataire?.prenom} ${success.destinataire?.nom}`, false],
                          ['Compte destinataire', success.destinataire?.compte, true],
                        ]
                    ).map(([k, v, mono]: any) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                        <span style={{ color: C.textMuted, fontSize: 13 }}>{k}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', color: C.text }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn onClick={resetForm} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Nouvelle opération</Btn>
                    <Btn variant="ghost" onClick={resetAll} style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Changer de client</Btn>
                  </div>
                </div>
              </div>
            )}

            {/* ─── HISTORIQUE ─── */}
            {step === 'form' && tab === 'historique' && (
              <div>
                <TableWrapper>
                  <THead cols={['Type', 'Client', 'Montant', 'Opérateur', 'Agence', 'IP', 'Date']} />
                  <tbody>
                    {loadHist ? <tr><td colSpan={7}><Spinner /></td></tr>
                    : historique.length === 0 ? <tr><td colSpan={7}><Empty msg="Aucune opération en agence pour le moment." /></td></tr>
                    : historique.map((tx: any) => {
                      const m = tx.metadata || {};
                      return (
                        <TR key={tx.id}>
                          <TD><Badge v={tx.type?.replace(/_/g, ' ')} /></TD>
                          <TD bold>{tx.compte?.user?.prenom} {tx.compte?.user?.nom}</TD>
                          <TD bold style={{ color: Number(tx.montantNet) >= 0 ? C.green : C.red }}>
                            {Number(tx.montantNet) >= 0 ? '+' : ''}{formatMontant(tx.montant)}
                          </TD>
                          <TD>
                            {m.actorPrenom || m.actorNom
                              ? <span style={{ fontSize: 13 }}>{m.actorPrenom} {m.actorNom}</span>
                              : <span style={{ fontSize: 12, color: C.textMuted }}>{m.actorRole || '—'}</span>
                            }
                            {m.actorCode && <span style={{ fontSize: 11, color: C.textMuted, display: 'block' }}>{m.actorCode}</span>}
                          </TD>
                          <TD>
                            {m.agenceNom
                              ? <span style={{ fontSize: 13 }}>{m.agenceNom}</span>
                              : <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                            }
                            {m.agenceVille && <span style={{ fontSize: 11, color: C.textMuted, display: 'block' }}>{m.agenceVille}</span>}
                          </TD>
                          <TD mono muted style={{ fontSize: 12 }}>{m.ipAddress || '—'}</TD>
                          <TD muted style={{ fontSize: 12 }}>{formatDate(tx.createdAt, 'dd/MM/yyyy HH:mm')}</TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </TableWrapper>
                <Pagination page={page} pages={pagination.pages} onChange={setPage} />
              </div>
            )}
          </div>

          {/* ─── PANNEAU LATERAL ─── */}
          {step !== 'success' && (
            <div>
              <div style={{ background: `linear-gradient(135deg, ${C.sidebarBg}, #2d4a30)`, borderRadius: 14, padding: 20, color: '#fff', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Guide opérations agence</div>
                {[
                  ['1', 'Sélectionner le client', 'Recherche par nom ou téléphone'],
                  ['2', 'Choisir l\'opération', 'Dépôt, retrait ou virement'],
                  ['3', 'Saisir le montant', 'Minimum 100 FCFA'],
                  ['4', 'Confirmer par OTP', 'Code SMS pour retrait/virement'],
                ].map(([n, t, d]) => (
                  <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, background: C.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{n}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{d}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Règles</div>
                {[
                  'Dépôt : aucun frais, pas OTP',
                  'Retrait : OTP requis, frais 0 F',
                  'Virement : OTP requis, frais 0 F',
                  'Solde vérifié avant débit',
                  'Toutes les opérations sont tracées',
                ].map(r => (
                  <div key={r} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, display: 'flex', gap: 6 }}>
                    <span style={{ color: C.green }}>✓</span>{r}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
