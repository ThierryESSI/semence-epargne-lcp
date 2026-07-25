// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/ClientTransactions.tsx
import { usePaginated } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, TableWrapper, THead, TR, TD, Badge, StatCard, Spinner, Empty, Pagination, SearchBar } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

export default function ClientTransactions() {
  const { items, pagination, loading, page, setPage, search, setSearch } = usePaginated<any>('/transactions');
  const totalNet = items.reduce((s: number, t: any) => s + Number(t.montantNet || 0), 0);
  const totalFrais = items.reduce((s: number, t: any) => s + Number(t.frais || 0), 0);

  return (
    <div>
      <PageHeader title="Mes Transactions" subtitle={`${pagination.total} opération(s) au total`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total épargné" value={formatMontant(totalNet)} icon="wallet" />
        <StatCard label="Total frais payés" value={formatMontant(totalFrais)} icon="percent" iconColor={C.red} />
        <StatCard label="Transactions" value={pagination.total} icon="transactions" iconColor={C.greenLight} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <SearchBar value={search} onChange={(v: string) => { setSearch(v); setPage(1); }} placeholder="Rechercher une transaction..." />
      </div>
      <TableWrapper>
        <THead cols={['Date', 'Type', 'Carte', 'Montant', 'Frais', 'Crédité', 'Statut']} />
        <tbody>
          {loading ? <tr><td colSpan={7}><Spinner /></td></tr>
            : items.length === 0 ? <tr><td colSpan={7}><Empty msg="Aucune transaction. Scannez votre première carte !" /></td></tr>
            : items.map((tx: any) => (
              <TR key={tx.id}>
                <TD muted>{formatDate(tx.createdAt)}</TD>
                <TD><span style={{ background: C.greenPale, color: C.green, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{tx.type?.replace(/_/g, ' ')}</span></TD>
                <TD mono muted>{tx.carte?.reference || '—'}</TD>
                <TD>{formatMontant(tx.montant)}</TD>
                <TD><span style={{ color: C.red, fontWeight: 600 }}>{formatMontant(tx.frais)}</span></TD>
                <TD bold>{formatMontant(tx.montantNet)}</TD>
                <TD><Badge v={tx.statut?.toLowerCase()} /></TD>
              </TR>
            ))}
        </tbody>
      </TableWrapper>
      <Pagination page={page} pages={pagination.pages} onChange={setPage} />
    </div>
  );
}
