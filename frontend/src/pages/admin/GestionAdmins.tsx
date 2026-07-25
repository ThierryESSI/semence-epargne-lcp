// frontend/src/pages/admin/GestionAdmins.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI | facebook.com/EasyGestion225
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner, TableWrapper, THead, TR, TD, Badge, Modal, Input, Select } from '../../components/ui/DS';
import { formatDate } from '../../lib/utils';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:'Super Admin', MASTER:'Master LCP',
  DISTRIBUTEUR_INTERNE:'Distributeur Interne', DISTRIBUTEUR_AGREE:'Distributeur Agree', CONSEILLER:'Conseiller',
};
const ROLES_ADMIN = ['MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'];
const ACTIONS = ['VOIR','AJOUTER','MODIFIER','SUPPRIMER'] as const;
type Action = typeof ACTIONS[number];
const ACTION_COLORS: Record<Action,{bg:string;color:string;label:string}> = {
  VOIR:      { bg:C.bluePale, color:C.blue,    label:'Voir' },
  AJOUTER:   { bg:C.greenPale,color:C.green,   label:'Ajouter' },
  MODIFIER:  { bg:C.goldPale, color:'#a16207', label:'Modifier' },
  SUPPRIMER: { bg:C.redPale,  color:C.red,     label:'Supprimer' },
};

export default function GestionAdmins() {
  const { user }     = useAuthStore();
  const isSA         = user?.role === 'SUPER_ADMIN';
  const [admins,     setAdmins]     = useState<any[]>([]);
  const [modules,    setModules]    = useState<Record<string,any>>({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState({ nom:'',prenom:'',email:'',telephone:'',role:'MASTER',permissions:[] as string[],motDePasse:'' });
  const [creating,   setCreating]   = useState(false);
  const [editUser,   setEditUser]   = useState<any>(null);
  const [editPerms,  setEditPerms]  = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    load();
    api.get('/super-admin/permissions').then(r => setModules(r.data.data || {})).catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setError('');
    try { const { data } = await api.get('/super-admin/admins'); setAdmins(data.data || []); }
    catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  }

  async function creer() {
    setCreating(true); setError('');
    try {
      await api.post('/super-admin/admins', form);
      setSuccess('Compte admin cree avec succes');
      setShowCreate(false);
      setForm({nom:'',prenom:'',email:'',telephone:'',role:'MASTER',permissions:[],motDePasse:''});
      load();
    } catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setCreating(false); }
  }

  async function sauvegarder() {
    setSaving(true); setError('');
    try {
      await api.patch(`/super-admin/admins/${editUser.id}/permissions`, { permissions: editPerms });
      setSuccess('Permissions mises a jour'); setEditUser(null); load();
    } catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  }

  async function toggle(userId: string, actif: boolean) {
    try { await api.patch(`/super-admin/admins/${userId}/toggle`); setSuccess(`Compte ${actif?'desactive':'active'}`); load(); }
    catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
  }

  async function resetPwd(userId: string, nom: string) {
    if (!confirm(`Reinitialiser le mot de passe de ${nom} ?`)) return;
    try { const { data } = await api.post(`/super-admin/admins/${userId}/reset-pwd`); setSuccess(`Nouveau mdp : ${data.motDePasseTemporaire}`); }
    catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
  }

  function tp(code:string, target:'form'|'edit') {
    if(target==='form') setForm(f=>({...f,permissions:f.permissions.includes(code)?f.permissions.filter(x=>x!==code):[...f.permissions,code]}));
    else setEditPerms(p=>p.includes(code)?p.filter(x=>x!==code):[...p,code]);
  }

  function tmAll(mPerms:string[], target:'form'|'edit') {
    const cur = target==='form'?form.permissions:editPerms;
    const hasAll = mPerms.every(p=>cur.includes(p));
    const next = hasAll?cur.filter(p=>!mPerms.includes(p)):[...new Set([...cur,...mPerms])];
    if(target==='form') setForm(f=>({...f,permissions:next})); else setEditPerms(next);
  }

  function tAction(action:Action, target:'form'|'edit') {
    const all = Object.values(modules).flatMap((m:any)=>m.permissions.filter((p:any)=>p.code.endsWith(`_${action}`)).map((p:any)=>p.code));
    const cur = target==='form'?form.permissions:editPerms;
    const hasAll = all.every((p:string)=>cur.includes(p));
    const next = hasAll?cur.filter(p=>!all.includes(p)):[...new Set([...cur,...all])];
    if(target==='form') setForm(f=>({...f,permissions:next})); else setEditPerms(next);
  }

  if(loading) return <Spinner />;

  const PermGrid = ({ cur, target }:{cur:string[];target:'form'|'edit'}) => (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:12,color:C.textMuted}}>Cocher par action :</span>
        {ACTIONS.map(a=>{
          const col=ACTION_COLORS[a];
          const all=Object.values(modules).flatMap((m:any)=>m.permissions.filter((p:any)=>p.code.endsWith(`_${a}`)).map((p:any)=>p.code));
          const on=all.length>0&&all.every((p:string)=>cur.includes(p));
          return <button key={a} onClick={()=>tAction(a,target)}
            style={{background:on?col.color:col.bg,color:on?'#fff':col.color,border:`1px solid ${col.color}`,borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {col.label}
          </button>;
        })}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {Object.entries(modules).map(([mName,mData]:any)=>{
          const mPerms=mData.permissions.map((p:any)=>p.code);
          const hasAll=mPerms.every((p:string)=>cur.includes(p));
          const hasSome=mPerms.some((p:string)=>cur.includes(p));
          return <div key={mName} style={{border:`1.5px solid ${hasSome?C.green:C.border}`,borderRadius:10,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:hasSome?C.greenPale:'#f8faf8',cursor:'pointer'}}
              onClick={()=>tmAll(mPerms,target)}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={hasAll} readOnly style={{accentColor:C.green}}/>
                <span style={{fontWeight:700,fontSize:13,color:hasSome?C.green:C.text}}>{mData.label}</span>
                {hasSome&&!hasAll&&<span style={{fontSize:10,color:C.textMuted}}>partiel</span>}
              </div>
              <span style={{fontSize:11,color:C.textMuted}}>{mPerms.filter((p:string)=>cur.includes(p)).length}/{mPerms.length}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',padding:'8px 10px',gap:5,background:'#fff'}}>
              {mData.permissions.map((perm:any)=>{
                const a=ACTIONS.find(x=>perm.code.endsWith(`_${x}`));
                const col=a?ACTION_COLORS[a]:{bg:C.borderLight,color:C.textMuted,label:''};
                const on=cur.includes(perm.code);
                return <label key={perm.code}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'6px 8px',borderRadius:6,border:`1.5px solid ${on?col.color:C.border}`,background:on?col.bg:'transparent',cursor:'pointer'}}
                  onClick={()=>tp(perm.code,target)}>
                  <input type="checkbox" checked={on} readOnly style={{accentColor:col.color,flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:on?600:400,color:on?col.color:C.textMuted,lineHeight:1.3}}>{perm.label}</span>
                </label>;
              })}
            </div>
          </div>;
        })}
      </div>
    </div>
  );

  return <div>
    <PageHeader title={isSA?'Gestion des Administrateurs':'Comptes Administrateurs'}
      subtitle="Permissions par module : Voir, Ajouter, Modifier, Supprimer"
      action={isSA&&<Btn onClick={()=>setShowCreate(true)}>+ Nouveau compte admin</Btn>}/>

    {error   && <Alert type="error"  >{error}</Alert>}
    {success && <Alert type="success">{success}</Alert>}

    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:12,color:C.textMuted}}>Legende :</span>
      {Object.entries(ACTION_COLORS).map(([a,col])=>(
        <span key={a} style={{background:col.bg,color:col.color,padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:600}}>{col.label}</span>
      ))}
    </div>

    <div style={{background:'#fff',borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
      <TableWrapper>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <THead cols={['Administrateur','Role','Telephone','Modules actifs','Derniere connexion','Statut','Actions']}/>
          <tbody>
            {admins.map(a=>{
              const byMod:Record<string,number>={};
              (a.permissions||[]).forEach((p:string)=>{const m=p.split('_')[0];byMod[m]=(byMod[m]||0)+1;});
              return <TR key={a.id}>
                <TD bold>
                  <div>{a.prenom} {a.nom}</div>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:400}}>{a.email}</div>
                </TD>
                <TD>
                  <span style={{background:a.role==='SUPER_ADMIN'?'#fef3c7':a.role==='MASTER'?C.greenPale:C.goldPale,
                    color:a.role==='SUPER_ADMIN'?'#92400e':a.role==='MASTER'?C.green:'#a16207',
                    padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:600}}>
                    {ROLE_LABELS[a.role]||a.role}
                  </span>
                </TD>
                <TD mono>{a.telephone}</TD>
                <TD>
                  {a.role==='SUPER_ADMIN'
                    ?<span style={{fontSize:11,color:C.textMuted,fontStyle:'italic'}}>Acces total</span>
                    :Object.keys(byMod).length===0
                      ?<span style={{fontSize:11,color:C.textMuted,fontStyle:'italic'}}>Aucune permission</span>
                      :<div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {Object.entries(byMod).map(([mod,n])=>(
                          <span key={mod} style={{background:C.greenPale,color:C.green,padding:'1px 7px',borderRadius:10,fontSize:10,fontWeight:600}}>
                            {mod} ({n})
                          </span>
                        ))}
                      </div>
                  }
                </TD>
                <TD>
                  {a.lastLoginAt
                    ?<span style={{fontSize:12}}>{formatDate(a.lastLoginAt,'dd/MM/yy HH:mm')}</span>
                    :<span style={{color:C.textMuted,fontSize:12}}>Jamais</span>}
                </TD>
                <TD><Badge v={a.actif?'actif':'suspendu'}/></TD>
                <TD>
                  {isSA&&a.role!=='SUPER_ADMIN'&&<div style={{display:'flex',gap:4}}>
                    <button onClick={()=>{setEditUser(a);setEditPerms(a.permissions||[]);}}
                      style={{background:C.bluePale,color:C.blue,border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      Permissions
                    </button>
                    <button onClick={()=>toggle(a.id,a.actif)}
                      style={{background:a.actif?C.redPale:C.greenPale,color:a.actif?C.red:C.green,border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      {a.actif?'Desactiver':'Activer'}
                    </button>
                    <button onClick={()=>resetPwd(a.id,`${a.prenom} ${a.nom}`)}
                      style={{background:C.goldPale,color:'#a16207',border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      Mdp
                    </button>
                  </div>}
                </TD>
              </TR>;
            })}
          </tbody>
        </table>
      </TableWrapper>
    </div>

    {showCreate&&<Modal title="Nouveau compte administrateur" onClose={()=>setShowCreate(false)} wide>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
        <Input label="Nom *" value={form.nom} onChange={(e:any)=>setForm(f=>({...f,nom:e.target.value}))} placeholder="KOUAME"/>
        <Input label="Prenom *" value={form.prenom} onChange={(e:any)=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Aya"/>
        <Input label="Email *" type="email" value={form.email} onChange={(e:any)=>setForm(f=>({...f,email:e.target.value}))} placeholder="admin@lcp-microfinance.ci"/>
        <Input label="Telephone CI * (07/05/01/25/27 + 8 chiffres)" value={form.telephone} onChange={(e:any)=>setForm(f=>({...f,telephone:e.target.value}))} placeholder="0712345678"/>
        <Select label="Role *" value={form.role} onChange={(e:any)=>setForm(f=>({...f,role:e.target.value}))}>
          {ROLES_ADMIN.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Input label="Mot de passe (vide = auto-genere)" value={form.motDePasse} onChange={(e:any)=>setForm(f=>({...f,motDePasse:e.target.value}))} placeholder="Auto-genere si vide"/>
      </div>
      <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Permissions par module</div>
      <PermGrid cur={form.permissions} target="form"/>
      {error&&<div style={{marginTop:12}}><Alert type="error">{error}</Alert></div>}
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <Btn variant="secondary" onClick={()=>setShowCreate(false)} style={{flex:1,justifyContent:'center'}}>Annuler</Btn>
        <Btn onClick={creer} loading={creating} style={{flex:2,justifyContent:'center'}}>Creer le compte</Btn>
      </div>
    </Modal>}

    {editUser&&<Modal title={`Permissions — ${editUser.prenom} ${editUser.nom} (${ROLE_LABELS[editUser.role]})`} onClose={()=>setEditUser(null)} wide>
      <div style={{marginBottom:12,padding:'8px 12px',background:C.goldPale,borderRadius:8,fontSize:13,color:'#a16207',display:'flex',justifyContent:'space-between'}}>
        <span>Role : <strong>{ROLE_LABELS[editUser.role]}</strong></span>
        <span style={{fontSize:12}}>{editPerms.length} permission(s)</span>
      </div>
      <PermGrid cur={editPerms} target="edit"/>
      <div style={{display:'flex',gap:10,marginTop:18}}>
        <Btn variant="secondary" onClick={()=>setEditUser(null)} style={{flex:1,justifyContent:'center'}}>Annuler</Btn>
        <Btn onClick={sauvegarder} loading={saving} style={{flex:2,justifyContent:'center'}}>Sauvegarder</Btn>
      </div>
    </Modal>}
  </div>;
}
