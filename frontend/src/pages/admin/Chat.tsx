// frontend/src/pages/admin/Chat.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import { PageHeader, Spinner, Alert } from '../../components/ui/DS';

export default function Chat() {
  const { user }                  = useAuthStore();
  const [conversations, setCvs]   = useState<any[]>([]);
  const [selectedClient, setSel]  = useState<string|null>(null);
  const [messages, setMsgs]       = useState<any[]>([]);
  const [newMsg, setNewMsg]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const isClient                  = user?.role === 'CLIENT';
  const clientId                  = isClient ? user?.id : selectedClient;

  useEffect(() => {
    if (!isClient) loadConversations();
    else if (user?.id) loadMessages(user.id);
  }, []);

  useEffect(() => {
    if (clientId) loadMessages(clientId);
  }, [clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling toutes les 5 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (clientId) loadMessages(clientId);
      if (!isClient) loadConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [clientId, isClient]);

  async function loadConversations() {
    try {
      const { data } = await api.get('/chat/non-lus');
      setCvs(data.data || []);
    } catch {}
  }

  async function loadMessages(cid: string) {
    setLoading(true);
    try {
      const { data } = await api.get(`/chat/${cid}/messages`);
      setMsgs(data.data || []);
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  }

  async function envoyer() {
    if (!newMsg.trim() || !clientId) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chat/${clientId}/messages`, { contenu: newMsg.trim() });
      setMsgs(m => [...m, data.data]);
      setNewMsg('');
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setSending(false); }
  }

  return (
    <div>
      <PageHeader title="Messagerie" subtitle="Communication directe entre clients et conseillers"/>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display:'flex', gap:16, height:580 }}>
        {!isClient && (
          <div style={{ width:260, background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'12px 16px', fontWeight:700, fontSize:14, borderBottom:`1px solid ${C.border}` }}>Conversations</div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {conversations.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', color:C.textMuted, fontSize:13 }}>Aucun message non lu</div>
              ) : conversations.map(cv => (
                <div key={cv.clientId} onClick={() => setSel(cv.clientId)}
                  style={{ padding:'12px 16px', cursor:'pointer', borderBottom:`1px solid ${C.borderLight}`, background:selectedClient===cv.clientId?C.bluePale:'transparent' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{cv.client?.prenom} {cv.client?.nom}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{cv.dernierMessage?.contenu?.slice(0,35)}...</div>
                  {cv.messagesNonLus > 0 && (
                    <span style={{ background:C.primary, color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                      {cv.messagesNonLus}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ flex:1, background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {!clientId ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.textMuted }}>
              Selectionnez une conversation
            </div>
          ) : (
            <>
              <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                {loading ? <Spinner /> : messages.map(msg => {
                  const isMine = msg.expediteurId === user?.id;
                  return (
                    <div key={msg.id} style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'70%', background:isMine?C.primary:C.bg, color:isMine?'#fff':C.text,
                        borderRadius:isMine?'16px 16px 4px 16px':'16px 16px 16px 4px', padding:'10px 14px', fontSize:13 }}>
                        {!isMine && (
                          <div style={{ fontSize:11, fontWeight:700, marginBottom:4, color:C.textMuted }}>
                            {msg.expediteur?.prenom} {msg.expediteur?.nom}
                          </div>
                        )}
                        <div>{msg.contenu}</div>
                        <div style={{ fontSize:10, opacity:0.7, marginTop:4, textAlign:'right' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('fr-CI',{hour:'2-digit',minute:'2-digit'})}
                          {isMine && (msg.lu ? ' ✓✓' : ' ✓')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>
              <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:10 }}>
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  placeholder="Ecrivez votre message..."
                  onKeyDown={e => e.key==='Enter' && !e.shiftKey && envoyer()}
                  style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:20, padding:'9px 16px', fontSize:14, fontFamily:'inherit', color:C.text, outline:'none' }}/>
                <button onClick={envoyer} disabled={sending||!newMsg.trim()}
                  style={{ background:C.primary, color:'#fff', border:'none', borderRadius:20, padding:'9px 20px', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit', opacity:!newMsg.trim()?0.5:1 }}>
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
