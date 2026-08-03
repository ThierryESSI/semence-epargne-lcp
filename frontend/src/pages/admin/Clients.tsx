// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Clients.tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { usePaginated, useApi } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, SearchBar, TableWrapper, THead, TR, TD, Badge, Modal, SectionLabel, FormGrid, Input, Select, Btn, Spinner, Empty, Pagination, Alert, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

export default function Clients() {
  const { items, pagination, loading, page, setPage, search, setSearch, refetch } = usePaginated<any>('/clients');
  const { user: me } = useAuthStore();
  const isExpert = me?.role === 'SUPER_ADMIN' || me?.role === 'MASTER';
  // Charger les conseillers disponibles pour le select
  const { data: conseillerData } = useApi<any>('/conseillers?limit=100');
  const conseillerList = conseillerData?.data || [];

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  const [form, setForm] = useState({
    nom: '', prenom: '', telephone: '', email: '',
    dateNaissance: '', cni: '',
    region: '', departement: '', commune: '',
    typeCompte: 'ORDINAIRE',
    conseillerId: '',
  });
  const sf = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleCreate(e: any) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      // Envoyer ville = departement si ville non remplie
      const payload = { ...form, ville: form.departement || form.region };
      const { data } = await api.post('/comptes/ouvrir', payload);
      setSuccess(data.data);
      refetch();
    } catch (err: any) {
      // Afficher le VRAI message d'erreur du serveur
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || err.message
        || 'Erreur inconnue. Vérifiez la console.';
      setError(msg);
      console.error('[Création client]', err.response?.data || err);
    } finally {
      setSubmitting(false);
    }
  }

  function resetModal() {
    setShowModal(false); setSuccess(null); setError('');
    setForm({ nom: '', prenom: '', telephone: '', email: '', dateNaissance: '', cni: '', region: '', departement: '', commune: '', typeCompte: 'ORDINAIRE', conseillerId: '' });
  }

  async function handleDelete(c: any) {
    if (!confirm(`Supprimer DEFINITIVEMENT le client ${c.user?.prenom || ''} ${c.user?.nom || ''} (${c.code}) ?\n\nSon compte, ses transactions et toutes ses donnees seront supprimes.`)) return;
    try {
      await api.delete(`/super-admin/clients/${c.id}`);
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur');
    }
  }

  async function viderClients() {
    if (!confirm('Supprimer TOUS les clients de la base ?\n\nCette action est irreversible. Les comptes, transactions et donnees de tous les clients seront supprimes.')) return;
    try {
      const { data } = await api.delete('/super-admin/clients');
      alert(data.message || 'Base clients videe');
      refetch();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur');
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${pagination.total} client(s) enregistré(s)`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {isExpert && (
              <Btn variant="danger" onClick={viderClients}><Icon d={ICONS.trash} size={15} color="#fff" /> Vider les clients</Btn>
            )}
            <Btn onClick={() => setShowModal(true)}><Icon d={ICONS.clients} size={15} color="#fff" /> Nouveau client</Btn>
          </div>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <SearchBar value={search} onChange={(v: string) => { setSearch(v); setPage(1); }} placeholder="Rechercher par nom, téléphone, n° compte..." />
      </div>

      <TableWrapper>
        <THead cols={['Client', 'N° Compte', 'Téléphone', 'Solde (FCFA)', 'Statut', 'Date', '']} />
        <tbody>
          {loading ? (
            <tr><td colSpan={7}><Spinner /></td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={7}><Empty msg="Aucun client enregistré. Cliquez sur « Nouveau client » pour commencer." /></td></tr>
          ) : (
            items.map((c: any) => (
              <TR key={c.id}>
                <TD>
                  <div style={{ fontWeight: 700, color: C.text }}>{c.user?.prenom} {c.user?.nom}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon d={ICONS.map} size={12} color={C.textMuted} />{c.commune}, {c.ville}
                  </div>
                </TD>
                <TD mono muted>{c.compte?.numeroCompte || '—'}</TD>
                <TD>
                  <span style={{ color: C.green, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon d={ICONS.phone} size={13} color={C.green} />{c.user?.telephone}
                  </span>
                </TD>
                <TD bold>{formatMontant(c.compte?.solde || 0)}</TD>
                <TD><Badge v={c.compte?.statut || 'en_attente'} /></TD>
                <TD muted>{formatDate(c.user?.createdAt, 'dd/MM/yyyy')}</TD>
                <TD>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
                      <Icon d={ICONS.eye} size={16} />
                    </button>
                    {isExpert && (
                      <button onClick={() => handleDelete(c)} title="Supprimer"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }}>
                        <Icon d={ICONS.trash} size={16} />
                      </button>
                    )}
                  </div>
                </TD>
              </TR>
            ))
          )}
        </tbody>
      </TableWrapper>
      <Pagination page={page} pages={pagination.pages} onChange={setPage} />

      {/* Modal création */}
      {showModal && (
        <Modal title="Ouverture de compte client" onClose={resetModal}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}></div>
              <h3 style={{ color: C.green, margin: '0 0 16px' }}>Compte créé avec succès !</h3>
              <div style={{ background: C.greenPale, borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: C.textMuted, fontSize: 13 }}>Code client</span>
                  <span style={{ fontWeight: 700 }}>{success.codeClient}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: C.textMuted, fontSize: 13 }}>N° de compte</span>
                  <span style={{ fontWeight: 700 }}>{success.numeroCompte}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: C.textMuted, fontSize: 13 }}>Téléphone</span>
                  <span style={{ fontWeight: 700 }}>{success.telephone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.textMuted, fontSize: 13 }}>Mot de passe temporaire</span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', background: '#fff', padding: '2px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 16, color: C.green }}>
                    {success.tempPassword}
                  </span>
                </div>
              </div>
              <div style={{ background: '#e8f4fd', border: '1px solid #93c5fd', borderRadius: 10, padding: 12, textAlign: 'left', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 6, fontSize: 13 }}>📱 SMS envoyé au client</div>
                <p style={{ margin: 0, fontSize: 12, color: '#1e40af' }}>
                  Le client a reçu un SMS avec ses identifiants et le lien pour accéder à son espace sur la plateforme.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn variant="secondary" onClick={resetModal}>Fermer</Btn>
                <Btn onClick={() => { setSuccess(null); setForm({ nom:'',prenom:'',telephone:'',email:'',dateNaissance:'',cni:'',region:'',departement:'',commune:'',typeCompte:'ORDINAIRE',conseillerId:'' }); }}>
                  Nouveau client
                </Btn>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <SectionLabel>ÉTAT CIVIL</SectionLabel>
              <FormGrid>
                <Input label="Nom" required value={form.nom} onChange={sf('nom')} placeholder="NOM" />
                <Input label="Prénoms" required value={form.prenom} onChange={sf('prenom')} placeholder="Prénoms" />
              </FormGrid>
              <FormGrid>
                <Input label="Téléphone" required type="tel" value={form.telephone} onChange={sf('telephone')} placeholder="+225 07 XX XX XX XX" />
                <Input label="Email" type="email" value={form.email} onChange={sf('email')} placeholder="optionnel" />
              </FormGrid>
              <FormGrid>
                <Input label="Date de naissance" type="date" value={form.dateNaissance} onChange={sf('dateNaissance')} />
                <Input label="N° CNI" value={form.cni} onChange={sf('cni')} placeholder="CI-XXXXXXXXX" />
              </FormGrid>

              <SectionLabel>LOCALISATION</SectionLabel>
              <FormGrid cols={3}>
                <Input label="Région" required value={form.region} onChange={sf('region')} placeholder="Ex: Abidjan" />
                <Input label="Département" value={form.departement} onChange={sf('departement')} placeholder="Ex: Marcory" />
                <Input label="Commune" required value={form.commune} onChange={sf('commune')} placeholder="Ex: Cocody" />
              </FormGrid>

              <SectionLabel>COMPTE</SectionLabel>
              <FormGrid>
                <Input label="N° Compte" value="Généré automatiquement" disabled />
                <Select label="Type de compte" value={form.typeCompte} onChange={sf('typeCompte')}>
                  <option value="ORDINAIRE">Ordinaire</option>
                  <option value="INVEST_ENTREPRISE">Invest Entreprise</option>
                  <option value="INVEST_ORDINAIRE">Invest Ordinaire</option>
                  <option value="CARTE_MAGNETIQUE">Carte Magnétique</option>
                </Select>
              </FormGrid>

              {/* Conseiller — visible seulement si plusieurs conseillers */}
              {conseillerList.length > 1 && (
                <Select label="Conseiller responsable" value={form.conseillerId} onChange={sf('conseillerId')}>
                  <option value="">Premier conseiller disponible (auto)</option>
                  {conseillerList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.user?.prenom} {c.user?.nom} — {c.distributeur?.nomEntreprise}</option>
                  ))}
                </Select>
              )}

              {/* Avertissement si pas de conseiller */}
              {conseillerList.length === 0 && (
                <Alert type="warning">
                  ⚠️ Aucun conseiller créé. Allez d'abord dans <strong>Conseillers → Nouveau conseiller</strong> avant de créer un client.
                </Alert>
              )}

              {error && (
                <Alert type="error">
                  ❌ {error}
                </Alert>
              )}

              <div style={{ marginTop: 8 }}>
                <Btn type="submit" loading={submitting} disabled={conseillerList.length === 0} style={{ width: '100%', justifyContent: 'center', padding: '13px' }} size="lg">
                  Créer le compte
                </Btn>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
