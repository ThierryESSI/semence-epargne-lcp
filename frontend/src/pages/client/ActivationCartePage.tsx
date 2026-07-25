// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/ActivationCartePage.tsx
import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Alert, Btn, Spinner } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

type Step = 'scan' | 'verif' | 'code' | 'success';

export default function ActivationCartePage() {
  const [step, setStep]         = useState<Step>('scan');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [carteInfo, setCarteInfo] = useState<any>(null);
  const [qrToken, setQrToken]   = useState('');
  const [codeVal, setCodeVal]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [manualRef, setManualRef] = useState('');

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<any>(null);

  // ─── Scanner QR via caméra ────────────────────────────────────────
  async function startCamera() {
    setError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startFrameCapture();
      }
    } catch {
      setError('Impossible d\'accéder à la caméra. Utilisez la saisie manuelle.');
      setScanning(false);
      setScanMode('manual');
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
    }
    clearInterval(intervalRef.current);
    setScanning(false);
  }

  function startFrameCapture() {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width  = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        // @ts-ignore
        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          stopCamera();
          await verifierQR(code.data);
        }
      } catch { /* jsQR non disponible, basculer manual */ }
    }, 300);
  }

  useEffect(() => () => { stopCamera(); }, []);

  // ─── Vérification QR Auth (authenticité) ─────────────────────────
  async function verifierQR(token: string) {
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/cartes/verifier', { qrToken: token });
      if (!data.authentique) {
        setError(data.message || 'Carte non authentique');
        return;
      }
      setCarteInfo(data.data);
      setQrToken(token); // token épargne sera rescané à l'étape suivante
      setStep('verif');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de vérification');
    } finally { setLoading(false); }
  }

  // ─── Activation (scanner le QR Épargne + code 4 chiffres) ────────
  async function activerCarte() {
    if (!qrToken) return setError('Token QR épargne manquant. Rescannez le QR Code verso.');
    if (codeVal.length !== 4) return setError('Le code de validation fait 4 chiffres.');
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/cartes/activer', { qrEpargneToken: qrToken, codeValidation: codeVal });
      setResult(data.data);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur d\'activation');
    } finally { setLoading(false); }
  }

  function reset() { setStep('scan'); setCarteInfo(null); setQrToken(''); setCodeVal(''); setError(''); setResult(null); setManualRef(''); }

  // ─── ÉTAPE 1 : Scanner ────────────────────────────────────────────
  if (step === 'scan') return (
    <div>
      <PageHeader title="Activer une carte" subtitle="Scannez le QR Code de votre carte Semence Épargne"/>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, background:C.white, borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:20, width:'fit-content' }}>
        {(['camera','manual'] as const).map(m => (
          <button key={m} onClick={()=>{ setScanMode(m); stopCamera(); setError(''); }}
            style={{ padding:'10px 22px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit',
              background: scanMode===m ? C.green : 'transparent', color: scanMode===m ? '#fff' : C.textMuted }}>
            {m === 'camera' ? '📷 Scanner QR Code' : '✏️ Saisie manuelle'}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
        <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, padding:24 }}>
          {scanMode === 'camera' ? (
            <div>
              <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
                Placez le <strong>QR Code RECTO</strong> (authentification) dans le cadre pour vérifier l'authenticité de votre carte.
              </p>
              <div style={{ position:'relative', background:'#000', borderRadius:12, overflow:'hidden', maxWidth:500, aspectRatio:'4/3' }}>
                <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:scanning?'block':'none' }} muted playsInline/>
                <canvas ref={canvasRef} style={{ display:'none' }}/>
                {!scanning && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
                    <div style={{ fontSize:64 }}>📷</div>
                    <p style={{ color:'rgba(255,255,255,0.7)', fontSize:14, textAlign:'center', margin:0 }}>La caméra est arrêtée</p>
                  </div>
                )}
                {scanning && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <div style={{ width:200, height:200, border:'3px solid #f4a11d', borderRadius:12, boxShadow:'0 0 0 9999px rgba(0,0,0,0.3)' }}/>
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                {!scanning
                  ? <Btn onClick={startCamera} style={{ flex:1, justifyContent:'center', padding:'11px' }}>Demarrer le scanner</Btn>
                  : <Btn onClick={stopCamera} variant="secondary" style={{ flex:1, justifyContent:'center' }}>⏹ Arrêter</Btn>
                }
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
                Saisissez manuellement la référence de votre carte Semence Épargne.
              </p>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>Référence de la carte</label>
              <input value={manualRef} onChange={e=>setManualRef(e.target.value.toUpperCase())} placeholder="CSEM-NHR-010-8C0G"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:15, outline:'none', fontFamily:'monospace', boxSizing:'border-box', letterSpacing:'0.04em' }}/>
              <div style={{ height:12 }}/>
              {error && <><Alert type="error">{error}</Alert><div style={{height:8}}/></>}
              <Btn onClick={()=>{ /* TODO: appel API par référence */ alert('Scannez le QR Code si possible pour une meilleure sécurité') }}
                loading={loading} style={{ width:'100%', justifyContent:'center', padding:'11px' }}>
                Vérifier la carte
              </Btn>
            </div>
          )}
          {error && scanMode==='camera' && <div style={{marginTop:14}}><Alert type="error">{error}</Alert></div>}
        </div>

        {/* Guide */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:`linear-gradient(135deg,${C.sidebarBg},#2d4a30)`, borderRadius:14, padding:18, color:'#fff' }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Guide d'activation</div>
            {[
              { n:'1', icon:'📷', t:'Scannez le QR Code RECTO', d:'Le grand QR Code face avant — vérifie l\'authenticité' },
              { n:'2', icon:'✅', t:'Carte authentifiée', d:'Confirmation que la carte vient bien de LCP' },
              { n:'3', icon:'🔒', t:'QR Code VERSO + code 4 chiffres', d:'Le QR Code dos + le code imprimé sur le verso' },
              { n:'4', icon:'💰', t:'Épargne créditée', d:'Montant net déduit des frais (1%) sur votre compte' },
            ].map(s=>(
              <div key={s.n} style={{ display:'flex', gap:10, marginBottom:12 }}>
                <div style={{ width:22,height:22,background:C.gold,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,flexShrink:0 }}>{s.n}</div>
                <div><div style={{ fontWeight:600,fontSize:13 }}>{s.icon} {s.t}</div><div style={{ fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:2 }}>{s.d}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background:C.white, borderRadius:12, border:`1px solid ${C.border}`, padding:16 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Conseils de securite</div>
            {['N\'activez que des cartes achetées auprès d\'un conseiller LCP officiel','Vérifiez toujours le QR Code RECTO en premier','Ne communiquez jamais votre code 4 chiffres à personne','Contactez LCP si une carte semble suspecte'].map(c=>(
              <div key={c} style={{ fontSize:12, color:C.textMuted, marginBottom:5, lineHeight:1.4 }}>• {c}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── ÉTAPE 2 : Carte vérifiée, confirmation ───────────────────────
  if (step === 'verif') return (
    <div style={{ maxWidth:520, margin:'0 auto' }}>
      <PageHeader title="Carte authentique" subtitle="Votre carte Semence Épargne est authentique"/>
      <div style={{ background:C.white, borderRadius:16, border:`2px solid ${C.green}`, padding:28, marginBottom:16 }}>
        <div style={{ background:C.greenPale, borderRadius:12, padding:18, marginBottom:20 }}>
          <div style={{ fontSize:13, color:C.green, fontWeight:600, marginBottom:10 }}>Informations de la carte</div>
          {[
            ['Référence', carteInfo?.reference || '—', true],
            ['Montant brut', formatMontant(carteInfo?.montant || 0), false],
            ['Frais (1%)', `-${formatMontant(Math.ceil((carteInfo?.montant||0)*0.01))}`, false],
            ['Net crédité', formatMontant(Math.floor((carteInfo?.montant||0)*0.99)), false],
          ].map(([k,v,mono]:any)=>(
            <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid rgba(0,0,0,0.05)` }}>
              <span style={{ fontSize:13,color:C.textMuted }}>{k}</span>
              <span style={{ fontWeight:700,fontSize:14,fontFamily:mono?'monospace':'inherit',color:k==='Net crédité'?C.green:k.includes('Frais')?C.red:C.text }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:14, color:C.text, marginBottom:20, lineHeight:1.6 }}>
          Pour procéder à l'activation, scannez maintenant le <strong>QR Code VERSO</strong> (épargne) de votre carte.
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="secondary" onClick={reset} style={{ flex:1, justifyContent:'center' }}>Annuler</Btn>
          <Btn onClick={()=>setStep('code')} style={{ flex:2, justifyContent:'center', padding:'12px' }}>
            Continuer → Code de validation
          </Btn>
        </div>
      </div>
    </div>
  );

  // ─── ÉTAPE 3 : Code 4 chiffres ────────────────────────────────────
  if (step === 'code') return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      <PageHeader title="Code de validation" subtitle="Saisissez le code à 4 chiffres imprimé au verso de votre carte"/>
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:32 }}>

        {/* Illustration verso carte */}
        <div style={{ background:'#f8faf8', borderRadius:12, padding:20, marginBottom:24, border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:12, color:C.textMuted, marginBottom:8, textAlign:'center' }}>Verso de votre carte Semence Épargne</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ background:'#ddd', borderRadius:8, aspectRatio:'1', maxWidth:80, display:'flex',alignItems:'center',justifyContent:'center', fontSize:32 }}>📱</div>
              <div style={{ fontSize:10, color:C.textMuted, textAlign:'center', marginTop:4 }}>QR Épargne</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>CODE DE VALIDATION</div>
              <div style={{ fontSize:28, fontWeight:900, letterSpacing:'0.3em', color:C.text, fontFamily:'monospace', background:C.greenPale, padding:'8px 16px', borderRadius:8 }}>XXXX</div>
              <div style={{ fontSize:10, color:C.textMuted, marginTop:4 }}>Grattez si protégé</div>
            </div>
          </div>
        </div>

        <label style={{ display:'block', fontSize:13, fontWeight:600, color:C.text, marginBottom:10, textAlign:'center' }}>
          Entrez le code à 4 chiffres
        </label>
        <input value={codeVal} onChange={e=>setCodeVal(e.target.value.replace(/\D/g,'').slice(0,4))}
          placeholder="• • • •" maxLength={4}
          style={{ width:'100%', border:`2px solid ${codeVal.length===4?C.green:C.border}`, borderRadius:12, padding:'14px', fontSize:36, fontWeight:900, textAlign:'center', letterSpacing:'0.6em', outline:'none', boxSizing:'border-box', color:C.text, fontFamily:'monospace', transition:'border-color .2s' }}
        />

        {error && <div style={{marginTop:12}}><Alert type="error">{error}</Alert></div>}

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:20 }}>
          <Btn onClick={activerCarte} loading={loading} disabled={codeVal.length!==4}
            style={{ width:'100%', justifyContent:'center', padding:'13px', fontSize:16 }} size="lg">
            💰 Activer et créditer {formatMontant(Math.floor((carteInfo?.montant||0)*0.99))}
          </Btn>
          <Btn variant="secondary" onClick={()=>setStep('verif')} style={{ justifyContent:'center' }}>← Retour</Btn>
        </div>
      </div>
    </div>
  );

  // ─── ÉTAPE 4 : Succès ─────────────────────────────────────────────
  if (step === 'success' && result) return (
    <div style={{ maxWidth:480, margin:'0 auto' }}>
      <div style={{ background:C.white, borderRadius:16, border:`2px solid ${C.green}`, padding:32, textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}></div>
        <h2 style={{ color:C.green, fontSize:24, fontWeight:800, margin:'0 0 8px' }}>Épargne créditée !</h2>
        <p style={{ color:C.textMuted, fontSize:14, marginBottom:24 }}>Votre compte a été rechargé avec succès.</p>

        <div style={{ background:C.greenPale, borderRadius:14, padding:20, marginBottom:24, textAlign:'left' }}>
          {[
            ['Réf. transaction', result.transactionRef, true],
            ['Montant carte', formatMontant(result.montant), false],
            ['Frais LCP (1%)', `-${formatMontant(result.frais)}`, false],
            ['Net crédité', formatMontant(result.montantNet), false],
            ['Nouveau solde', formatMontant(result.nouveauSolde), false],
          ].map(([k,v,mono]:any)=>(
            <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid rgba(45,106,79,0.1)` }}>
              <span style={{ fontSize:13, color:C.textMuted }}>{k}</span>
              <span style={{ fontWeight: k==='Nouveau solde'?900:700, fontSize: k==='Nouveau solde'?18:14, color: k==='Net crédité'||k==='Nouveau solde'?C.green:k.includes('Frais')?C.red:C.text, fontFamily:mono?'monospace':'inherit' }}>{v}</span>
            </div>
          ))}
          {result.repartition && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px dashed rgba(45,106,79,0.2)` }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Répartition des frais</div>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1, background:'rgba(45,106,79,0.1)', borderRadius:8, padding:'6px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:C.green }}>Part LCP</div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.green }}>{formatMontant(result.repartition.partLcp)}</div>
                </div>
                <div style={{ flex:1, background:'rgba(244,161,29,0.1)', borderRadius:8, padding:'6px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#a16207' }}>Part Distributeur</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#a16207' }}>{formatMontant(result.repartition.partDist)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="secondary" onClick={()=>window.location.href='/client'} style={{ flex:1, justifyContent:'center' }}>Mon compte</Btn>
          <Btn onClick={reset} style={{ flex:1, justifyContent:'center' }}>Activer une autre carte</Btn>
        </div>
      </div>
    </div>
  );

  return <Spinner />;
}
