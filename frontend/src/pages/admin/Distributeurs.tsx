// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Distributeurs.tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { usePaginated } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, SearchBar, TableWrapper, THead, TR, TD, Badge, Modal, FormGrid, Input, Select, Btn, Spinner, Empty, Pagination, Alert, Icon, ICONS, SectionLabel } from '../../components/ui/DS';
import { formatMontant } from '../../lib/utils';

export default function Distributeurs() {
  const { items, pagination, loading, page, setPage, search, setSearch, refetch } = usePaginated<any>('/distributeurs');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', password: '', nomEntreprise: '', ville: '', pays: "Côte d'Ivoire", type: 'INTERNE' });
  const sf = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleCreate(e: any) {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const { data } = await api.post('/distributeurs', form);
      setSuccess(data.data); refetch();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Erreur inconnue';
      setError(msg);
      console.error('[Création distributeur]', err.response?.data || err);
    } finally { setSubmitting(false); }
  }
  function reset() { setShowModal(false); setSuccess(null); setError(''); setForm({ nom:'',prenom:'',email:'',telephone:'',password:'',nomEntreprise:'',ville:'',pays:"Côte d'Ivoire",type:'INTERNE' }); }

  return (
    <div>
      <PageHeader title="Distributeurs" subtitle={`${pagination.total} distributeur(s) enregistré(s)`}
        action={<Btn onClick={() => setShowModal(true)}><Icon d={ICONS.plus} size={15} color="#fff"/>Nouveau distributeur</Btn>}/>
      <div style={{ marginBottom: 16 }}><SearchBar value={search} onChange={(v: string) => { setSearch(v); setPage(1); }} placeholder="Rechercher..."/></div>

      <TableWrapper>
        <THead cols={['Distributeur','Code','Type','Ville','Conseillers','Statut']}/>
        <tbody>
          {loading ? <tr><td colSpan={6}><Spinner/></td></tr>
          : items.length === 0 ? <tr><td colSpan={6}><Empty msg="Aucun distributeur. Créez-en un."/></td></tr>
          : items.map((d: any) => (
            <TR key={d.id}>
              <TD>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{background:C.greenPale,borderRadius:8,padding:7}}><Icon d={ICONS.building} size={15} color={C.green}/></div>
                  <span style={{fontWeight:600}}>{d.nomEntreprise}</span>
                </div>
              </TD>
              <TD mono muted>{d.code}</TD>
              <TD><Badge v={d.type?.toLowerCase()}/></TD>
              <TD muted><span style={{display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.map} size={13} color={C.textMuted}/>{d.ville}</span></TD>
              <TD muted><span style={{display:'flex',alignItems:'center',gap:4}}><Icon d={ICONS.clients} size={13} color={C.textMuted}/>{d._count?.conseillers || 0}</span></TD>
              <TD><Badge v={d.user?.actif ? 'actif' : 'suspendu'}/></TD>
            </TR>
          ))}
        </tbody>
      </TableWrapper>
      <Pagination page={page} pages={pagination.pages} onChange={setPage}/>

      {showModal && (
        <Modal title="Nouveau distributeur" onClose={reset}>
          {success ? (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:52,marginBottom:12}}>🎉</div>
              <h3 style={{color:C.green,margin:'0 0 12px'}}>Distributeur créé !</h3>
              <div style={{background:C.greenPale,borderRadius:10,padding:14,textAlign:'left',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{color:C.textMuted,fontSize:13}}>Code</span>
                  <span style={{fontWeight:700,fontFamily:'monospace'}}>{success.code}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{color:C.textMuted,fontSize:13}}>Email de connexion</span>
                  <span style={{fontWeight:600,fontSize:13}}>{success.email}</span>
                </div>
              </div>
              <p style={{fontSize:13,color:C.textMuted,margin:'0 0 16px'}}>Communiquez l'email et le mot de passe au distributeur.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <Btn variant="secondary" onClick={reset}>Fermer</Btn>
                <Btn onClick={() => { setSuccess(null); setForm({nom:'',prenom:'',email:'',telephone:'',password:'',nomEntreprise:'',ville:'',pays:"Côte d'Ivoire",type:'INTERNE'}); }}>Nouveau</Btn>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <SectionLabel>RESPONSABLE</SectionLabel>
              <FormGrid>
                <Input label="Nom *" required value={form.nom} onChange={sf('nom')} placeholder="NOM"/>
                <Input label="Prénom" value={form.prenom} onChange={sf('prenom')} placeholder="Prénom"/>
              </FormGrid>
              <FormGrid>
                <Input label="Email *" required type="email" value={form.email} onChange={sf('email')} placeholder="email@exemple.com"/>
                <Input label="Téléphone *" required value={form.telephone} onChange={sf('telephone')} placeholder="+225 07 XX XX XX"/>
              </FormGrid>
              <FormGrid>
                <Input label="Mot de passe *" required type="password" value={form.password} onChange={sf('password')} placeholder="Min. 8 caractères"/>
                <Select label="Type" value={form.type} onChange={sf('type')}>
                  <option value="INTERNE">Interne (Agence LCP)</option>
                  <option value="AGREE">Agréé (ONG/Entreprise)</option>
                </Select>
              </FormGrid>
              <SectionLabel>ENTREPRISE</SectionLabel>
              <Input label="Nom de l'entreprise *" required value={form.nomEntreprise} onChange={sf('nomEntreprise')} placeholder="Ex: Agence LCP Bouaké"/>
              <div style={{height:12}}/>
              <FormGrid>
                <Input label="Ville *" required value={form.ville} onChange={sf('ville')} placeholder="Ex: Abidjan"/>
                <Input label="Pays" value={form.pays} onChange={sf('pays')}/>
              </FormGrid>

              {error && <Alert type="error">❌ {error}</Alert>}

              <Btn type="submit" loading={submitting} style={{width:'100%',justifyContent:'center',padding:'13px',marginTop:8}} size="lg">
                Créer le distributeur
              </Btn>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
