// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Conseillers.tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { usePaginated, useApi } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, SearchBar, TableWrapper, THead, TR, TD, Badge, Modal, FormGrid, Input, Select, Btn, Spinner, Empty, Pagination, Alert, Icon, ICONS, SectionLabel } from '../../components/ui/DS';
import { formatMontant } from '../../lib/utils';

export default function Conseillers() {
  const { items, pagination, loading, page, setPage, search, setSearch, refetch } = usePaginated<any>('/conseillers');
  const { data: distribData } = useApi<any>('/distributeurs?limit=100');
  const distribList = distribData?.data || [];

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', password: '', type: 'STAND', region: '', commune: '', distributeurId: '' });
  const sf = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleCreate(e: any) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/conseillers', form);
      setSuccess(data.data);
      refetch();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Erreur inconnue';
      setError(msg);
      console.error('[Création conseiller]', err.response?.data || err);
    } finally { setSubmitting(false); }
  }
  function reset() { setShowModal(false); setSuccess(null); setError(''); setForm({ nom:'',prenom:'',telephone:'',email:'',password:'',type:'STAND',region:'',commune:'',distributeurId:'' }); }

  return (
    <div>
      <PageHeader title="Conseillers Clientèle" subtitle={`${pagination.total} conseiller(s) actif(s)`}
        action={<Btn onClick={() => setShowModal(true)}><Icon d={ICONS.plus} size={15} color="#fff"/>Nouveau conseiller</Btn>}/>
      <div style={{ marginBottom: 16 }}><SearchBar value={search} onChange={(v: string) => { setSearch(v); setPage(1); }} placeholder="Rechercher..."/></div>

      {distribList.length === 0 && (
        <Alert type="warning">⚠️ Aucun distributeur créé. Allez d'abord dans <strong>Distributeurs → Nouveau distributeur</strong> avant de créer un conseiller.</Alert>
      )}

      <div style={{ marginTop: distribList.length === 0 ? 12 : 0 }}>
        <TableWrapper>
          <THead cols={['Conseiller','Code','Type','Distributeur','Clients','Commission (FCFA)']}/>
          <tbody>
            {loading ? <tr><td colSpan={6}><Spinner/></td></tr>
            : items.length === 0 ? <tr><td colSpan={6}><Empty msg="Aucun conseiller. Créez-en un."/></td></tr>
            : items.map((c: any) => (
              <TR key={c.id}>
                <TD>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{background:C.greenPale,borderRadius:8,padding:7}}><Icon d={ICONS.conseillers} size={15} color={C.green}/></div>
                    <div>
                      <div style={{fontWeight:600}}>{c.user?.prenom} {c.user?.nom}</div>
                      <div style={{fontSize:12,color:C.textMuted,display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.phone} size={12} color={C.textMuted}/>{c.user?.telephone}</div>
                    </div>
                  </div>
                </TD>
                <TD mono muted>{c.code}</TD>
                <TD><Badge v={c.type?.toLowerCase()}/></TD>
                <TD muted>{c.distributeur?.nomEntreprise || '—'}</TD>
                <TD bold>{c._count?.clients || 0}</TD>
                <TD bold>{formatMontant(0)}</TD>
              </TR>
            ))}
          </tbody>
        </TableWrapper>
        <Pagination page={page} pages={pagination.pages} onChange={setPage}/>
      </div>

      {showModal && (
        <Modal title="Nouveau conseiller" onClose={reset}>
          {success ? (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:52,marginBottom:12}}>✅</div>
              <h3 style={{color:C.green,margin:'0 0 12px'}}>Conseiller créé !</h3>
              <div style={{background:C.greenPale,borderRadius:10,padding:14,textAlign:'left',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{color:C.textMuted,fontSize:13}}>Code</span>
                  <span style={{fontWeight:700,fontFamily:'monospace'}}>{success.code}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{color:C.textMuted,fontSize:13}}>Téléphone / Email</span>
                  <span style={{fontWeight:600,fontSize:13}}>{success.telephone}</span>
                </div>
              </div>
              <p style={{fontSize:13,color:C.textMuted,margin:'0 0 16px'}}>Communiquez ces identifiants au conseiller pour qu'il se connecte.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <Btn variant="secondary" onClick={reset}>Fermer</Btn>
                <Btn onClick={() => { setSuccess(null); setForm({nom:'',prenom:'',telephone:'',email:'',password:'',type:'STAND',region:'',commune:'',distributeurId:''}); }}>Nouveau</Btn>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <SectionLabel>INFORMATIONS</SectionLabel>
              <FormGrid>
                <Input label="Nom *" required value={form.nom} onChange={sf('nom')} placeholder="NOM"/>
                <Input label="Prénom" value={form.prenom} onChange={sf('prenom')} placeholder="Prénom"/>
              </FormGrid>
              <FormGrid>
                <Input label="Téléphone *" required value={form.telephone} onChange={sf('telephone')} placeholder="+225 07 XX XX XX"/>
                <Input label="Email" type="email" value={form.email} onChange={sf('email')} placeholder="optionnel"/>
              </FormGrid>
              <FormGrid>
                <Input label="Mot de passe *" required type="password" value={form.password} onChange={sf('password')} placeholder="Min. 8 caractères"/>
                <Select label="Type" value={form.type} onChange={sf('type')}>
                  <option value="STAND">Stand (fixe)</option>
                  <option value="MOBILE">Mobile (terrain)</option>
                </Select>
              </FormGrid>

              <SectionLabel>RATTACHEMENT</SectionLabel>
              <Select label="Distributeur rattaché *" required value={form.distributeurId} onChange={sf('distributeurId')}>
                <option value="">— Sélectionner un distributeur —</option>
                {distribList.map((d: any) => <option key={d.id} value={d.id}>{d.nomEntreprise} ({d.code})</option>)}
              </Select>
              <div style={{height:12}}/>
              <FormGrid>
                <Input label="Région" value={form.region} onChange={sf('region')} placeholder="Ex: Abidjan"/>
                <Input label="Commune" value={form.commune} onChange={sf('commune')} placeholder="Ex: Yopougon"/>
              </FormGrid>

              {error && <Alert type="error">❌ {error}</Alert>}

              <Btn type="submit" loading={submitting} disabled={distribList.length === 0} style={{width:'100%',justifyContent:'center',padding:'13px',marginTop:8}} size="lg">
                Créer le conseiller
              </Btn>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
