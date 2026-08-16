// frontend/src/pages/admin/RechargesSMS.tsx
// Historique des recharges SMS + envoi de SMS test + gestion des templates SMS
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner, StatCard, TableWrapper, THead, TR, TD, SearchBar, Empty, Modal, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

export default function RechargesSMS() {
  const [historique, setHistorique] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Test SMS
  const [testOpen, setTestOpen] = useState(false);
  const [testTel, setTestTel] = useState('0747196784');
  const [testMsg, setTestMsg] = useState('');
  const [testSending, setTestSending] = useState(false);

  // Templates
  const [tplOpen, setTplOpen] = useState(false);
  const [tpls, setTpls] = useState<Record<string, string>>({});
  const [tplSaving, setTplSaving] = useState<string | null>(null);

  const TPL_KEYS = [
    { key: 'SMS_TPL_ADHESION', label: 'Adhésion UNARCI', vars: '{nom},{prenom},{numeroCompte},{tel},{pwd},{montant},{numeroPaie},{url}' },
    { key: 'SMS_TPL_COMPTE_OUVERT', label: 'Compte ouvert', vars: '{nom},{numero},{tel},{pwd},{url}' },
    { key: 'SMS_TPL_COMPTE_ACTIF', label: 'Compte activé', vars: '{nom}' },
    { key: 'SMS_TPL_DEPOT_OK', label: 'Dépôt réussi', vars: '{montant},{frais},{solde}' },
    { key: 'SMS_TPL_BONUS', label: 'Bonus versé', vars: '{nom},{taux},{bonus},{solde}' },
    { key: 'SMS_TPL_PLAN', label: 'Plan épargne activé', vars: '{nom},{palier},{taux},{echeance},{nbVers}' },
  ];

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/sms/historique', { params: search ? { search } : {} });
      setHistorique(data.data || []);
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  async function sendTest() {
    if (!testTel || !testMsg) return;
    setTestSending(true); setError(''); setSuccess('');
    try {
      const { data } = await api.post('/sms/envoyer', { telephone: testTel, message: testMsg });
      if (data.success) {
        setSuccess(`SMS envoyé à ${testTel}`);
        setTestMsg('');
      } else {
        setError(`Échec envoi SMS : ${data.error || data.raw || 'Erreur inconnue'}`);
      }
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur d\'envoi'); }
    finally { setTestSending(false); }
  }

  async function loadTpls() {
    setTplOpen(true); setError('');
    try {
      const { data } = await api.get('/site-config');
      const configs = data.data || [];
      const m: Record<string, string> = {};
      configs.filter((c: any) => c.cle.startsWith('SMS_TPL_')).forEach((c: any) => { m[c.cle] = c.valeur; });
      setTpls(m);
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur chargement templates'); }
  }

  async function saveTpl(cle: string) {
    setTplSaving(cle); setError('');
    try {
      await api.patch(`/site-config/${cle}`, { valeur: tpls[cle] || '' });
      setSuccess(`Template "${cle}" mis à jour`);
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur sauvegarde'); }
    finally { setTplSaving(null); }
  }

  const totalMontant = historique.reduce((s: number, h: any) => s + Number(h.details?.montant || 0), 0);
  const succes = historique.filter((h: any) => h.action?.includes('SUCCES')).length;
  const echecs = historique.filter((h: any) => h.action?.includes('ECHEC') || h.action?.includes('FRAUDE')).length;

  return (
    <div>
      <PageHeader title="Recharges SMS" subtitle="Historique des recharges via SMS/WhatsApp, envoi de SMS test et gestion des templates">
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={() => setTestOpen(true)} variant="primary" size="sm">
            <Icon d={ICONS.send} size={15} /> Envoyer un SMS
          </Btn>
          <Btn onClick={loadTpls} variant="ghost" size="sm">
            <Icon d={ICONS.params} size={15} /> Templates SMS
          </Btn>
        </div>
      </PageHeader>

      {error   && <Alert type="error"  >{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        <StatCard label="Total recharges" value={historique.length} icon="transactions" iconColor={C.blue} />
        <StatCard label="Réussies" value={succes} icon="check" iconColor={C.green} />
        <StatCard label="Échouées / Fraude" value={echecs} icon="zap" iconColor={C.red} />
        <StatCard label="Montant total" value={formatMontant(totalMontant)} icon="wallet" iconColor={C.primary} />
      </div>

      <SearchBar value={search} onChange={(v: string) => { setSearch(v); }} placeholder="Rechercher par référence, nom, téléphone..." />

      {loading ? <Spinner /> : historique.length === 0 ? (
        <Empty msg="Aucune recharge SMS enregistrée" />
      ) : (
        <TableWrapper>
          <THead cols={['Date','Action','Utilisateur','Détails','IP']} />
          <tbody>
            {historique.map((h: any) => (
              <TR key={h.id}>
                <TD muted>{formatDate(h.createdAt, 'dd/MM/yy HH:mm')}</TD>
                <TD>
                  <span style={{
                    background: h.action?.includes('SUCCES') ? C.greenPale : h.action?.includes('FRAUDE') ? C.redPale : C.bluePale,
                    color: h.action?.includes('SUCCES') ? C.green : h.action?.includes('FRAUDE') ? C.red : C.blue,
                    padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:600
                  }}>
                    {h.action?.replace(/_/g, ' ')}
                  </span>
                </TD>
                <TD>{h.actor ? `${h.actor.prenom} ${h.actor.nom}` : '—'}</TD>
                <TD>
                  {h.entiteId && <div style={{ fontSize:12, fontWeight:600 }}>Entité: {h.entiteId?.slice(0,12)}...</div>}
                  {h.details?.montant && <div style={{ fontSize:12, fontWeight:700 }}>{formatMontant(h.details.montant)}</div>}
                  {h.details?.reference && <div style={{ fontSize:11, color:C.textMuted }}>Réf: {h.details.reference}</div>}
                  {h.details?.compte && <div style={{ fontSize:11, color:C.textMuted }}>Compte: {h.details.compte}</div>}
                </TD>
                <TD muted>{h.ipAddress || '—'}</TD>
              </TR>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {/* ─── Modal Envoi SMS test ────────────────────── */}
      {testOpen && (
        <Modal title="Envoyer un SMS test" onClose={() => setTestOpen(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.textMuted, marginBottom:4 }}>Numéro de téléphone</label>
              <input value={testTel} onChange={e => setTestTel(e.target.value)}
                placeholder="0747196784"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.textMuted, marginBottom:4 }}>Message SMS</label>
              <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={4}
                placeholder="Bonjour, ceci est un SMS de test..."
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <Btn variant="ghost" onClick={() => setTestOpen(false)}>Annuler</Btn>
              <Btn loading={testSending} onClick={sendTest}>
                <Icon d={ICONS.send} size={15} /> Envoyer
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Modal Templates SMS ─────────────────────── */}
      {tplOpen && (
        <Modal title="Templates SMS configurables" onClose={() => setTplOpen(false)} wide>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <p style={{ fontSize:13, color:C.textMuted, margin:0 }}>
              Personnalisez les SMS envoyés automatiquement. Laissez vide pour utiliser le template par défaut.
              Les variables entre {'{'} et {'}'} seront remplacées par les valeurs réelles.
            </p>
            {TPL_KEYS.map(t => (
              <div key={t.key}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>
                  {t.label}
                  <span style={{ fontSize:10, color:C.textLight, fontFamily:'monospace', marginLeft:8 }}>({t.key})</span>
                </label>
                <div style={{ fontSize:10, color:C.textLight, marginBottom:6 }}>Variables disponibles : {t.vars}</div>
                <div style={{ display:'flex', gap:8, alignItems:'end' }}>
                  <textarea value={tpls[t.key] || ''} onChange={e => setTpls(v => ({ ...v, [t.key]: e.target.value }))} rows={3}
                    placeholder="(Template par défaut utilisé si vide)"
                    style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:12, outline:'none', resize:'vertical', fontFamily:'monospace', boxSizing:'border-box' }} />
                  <Btn size="sm" loading={tplSaving === t.key} onClick={() => saveTpl(t.key)}>Sauver</Btn>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
