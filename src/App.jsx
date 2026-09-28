import { useState, useRef, useEffect } from "react";

const API_URL = "/api/claude";
const MOT_DE_PASSE = "chavanne38210-";

const ANALYZE_PROMPT = `Tu es un assistant spécialisé en e-liquides. Analyse cette photo du stock d'une boutique de vape. Identifie : marques, noms, saveurs, taux de nicotine, formats, types. Retourne UNIQUEMENT ce JSON (sans backticks) : {"produits":[{"marque":"","nom":"","saveur":"","nicotine":"","format":"","type":"","notes":""}],"resume":""}`;

const buildSystemPrompt = (stock) => `Tu es le conseiller de La Hotte Vape, boutique spécialisée en e-liquides. STOCK DISPONIBLE UNIQUEMENT : ${JSON.stringify(stock)}. Règles : réponds en français, pose des questions sur le profil client, recommande UNIQUEMENT les produits du stock, sois concis (2-4 phrases).`;

const Icon = ({d,size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
const icons = {
  send:"M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  store:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  box:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  chat:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  img:"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  warn:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  lock:"M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4"
};
const SUGGESTIONS = ["Je veux arrêter la cigarette, par où commencer ?","Quelle saveur fruitée me conseilles-tu ?","Quel taux de nicotine choisir ?","J'ai une box, je cherche un bon liquide"];
const Dots = () => <div style={{display:"flex",gap:5,padding:"4px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#6ee7b7",animation:"dotPulse 1.2s ease infinite",animationDelay:`${i*0.2}s`}}/>)}</div>;

export default function App() {
  const [mode,setMode]=useState("client");
  const [mdpInput,setMdpInput]=useState("");
  const [mdpError,setMdpError]=useState("");
  const [showMdp,setShowMdp]=useState(false);
  const [gerantOk,setGerantOk]=useState(false);
  const [inputMode,setInputMode]=useState("manuel");
  const [stockPhoto,setStockPhoto]=useState(null);
  const [stockData,setStockData]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [analyzeError,setAnalyzeError]=useState("");
  const [produits,setProduits]=useState([{marque:"",nom:"",saveur:"",nicotine:"",format:"",type:"",notes:""}]);
  const [saved,setSaved]=useState(false);
  const [messages,setMessages]=useState([{role:"assistant",content:"Bonjour ! 👋 Bienvenue chez **La Hotte Vape** !\n\nJe connais tous les produits disponibles. Dites-moi ce que vous cherchez et je vous guide ! 🌬️"}]);
  const [history,setHistory]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const fileRef=useRef(null);
  const bottomRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages,loading]);

  const tryGerant=()=>{
    if(mdpInput===MOT_DE_PASSE){setGerantOk(true);setShowMdp(false);setMdpInput("");setMdpError("");setMode("gerant");}
    else{setMdpError("Mot de passe incorrect.");}
  };

  const handlePhoto=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>setStockPhoto(r.result.split(",")[1]);
    r.readAsDataURL(f); setStockData(null); setAnalyzeError("");
  };

  const analyzeStock=async()=>{
    if(!stockPhoto) return;
    setAnalyzing(true); setAnalyzeError("");
    try {
      const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:stockPhoto}},{type:"text",text:ANALYZE_PROMPT}]}]})});
      const data=await res.json();
      const parsed=JSON.parse(data.content?.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
      setStockData(parsed);
    } catch { setAnalyzeError("Impossible d'analyser. Vérifie que l'image est nette."); }
    finally { setAnalyzing(false); }
  };

  const updateP=(i,f,v)=>{setProduits(p=>p.map((it,idx)=>idx===i?{...it,[f]:v}:it));setSaved(false);};
  const addP=()=>setProduits(p=>[...p,{marque:"",nom:"",saveur:"",nicotine:"",format:"",type:"",notes:""}]);
  const removeP=i=>setProduits(p=>p.filter((_,idx)=>idx!==i));
  const saveManuel=()=>{
    const v=produits.filter(p=>p.marque||p.nom); if(!v.length) return;
    setStockData({produits:v,resume:`${v.length} produit(s) enregistré(s).`}); setSaved(true);
  };

  const sendMessage=async text=>{
    if(!text.trim()||loading||!stockData) return;
    const newH=[...history,{role:"user",content:text}];
    setMessages(p=>[...p,{role:"user",content:text}]); setHistory(newH); setInput(""); setLoading(true);
    try {
      const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildSystemPrompt(stockData),messages:newH})});
      const data=await res.json();
      const reply=data.content?.map(b=>b.text||"").join("")||"Désolé, une erreur est survenue.";
      setMessages(p=>[...p,{role:"assistant",content:reply}]); setHistory(p=>[...p,{role:"assistant",content:reply}]);
    } catch { setMessages(p=>[...p,{role:"assistant",content:"❌ Erreur de connexion."}]); }
    finally { setLoading(false); }
  };

  const fmt=t=>t.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n/g,"<br/>");
  const card={width:"100%",maxWidth:760,background:"rgba(255,255,255,0.04)",backdropFilter:"blur(24px)",borderRadius:24,border:"1px solid rgba(110,231,183,0.15)",boxShadow:"0 30px 80px rgba(0,0,0,0.6)",overflow:"hidden",display:"flex",flexDirection:"column"};
  const pill=active=>({padding:"9px 22px",borderRadius:30,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,transition:"all 0.25s",background:active?"linear-gradient(135deg,#6ee7b7,#34d399)":"rgba(255,255,255,0.06)",color:active?"#064e3b":"#9ca3af",boxShadow:active?"0 4px 20px rgba(110,231,183,0.35)":"none"});
  const inp={width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(110,231,183,0.15)",borderRadius:8,padding:"7px 10px",color:"#e5e7eb",fontSize:13,fontFamily:"inherit"};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#020c18 0%,#041f1a 50%,#020c18 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.7)}}
        .msg{animation:fadeUp 0.3s ease}.tab:hover{background:rgba(110,231,183,0.1)!important;color:#6ee7b7!important}
        .sug:hover{background:rgba(110,231,183,0.15)!important;border-color:#6ee7b7!important}
        .sbtn:hover:not(:disabled){filter:brightness(1.1);transform:scale(1.05)}
        .uzone:hover{border-color:#6ee7b7!important;background:rgba(110,231,183,0.06)!important}
        textarea:focus,input:focus{outline:none;border-color:#6ee7b7!important;box-shadow:0 0 0 3px rgba(110,231,183,0.15)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(110,231,183,0.25);border-radius:10px}
      `}</style>

      <div style={{marginBottom:20,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:800,color:"#6ee7b7",letterSpacing:-1}}>🌬️ La Hotte Vape</div>
        <div style={{color:"#4b5563",fontSize:12,marginTop:2}}>Conseiller e-liquide intelligent</div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.04)",padding:4,borderRadius:40,border:"1px solid rgba(110,231,183,0.1)"}}>
        <button className="tab" style={pill(mode==="client")} onClick={()=>setMode("client")}>💬 Client</button>
        <button className="tab" style={pill(mode==="gerant")} onClick={()=>{if(gerantOk){setMode("gerant");}else{setShowMdp(true);}}}>🔒 Gérant</button>
      </div>

      {showMdp&&(
        <div style={{...card,maxWidth:380,marginBottom:16}}>
          <div style={{padding:24,display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
            <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#6ee7b7,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",color:"#064e3b"}}><Icon d={icons.lock} size={22}/></div>
            <div style={{color:"#e5e7eb",fontWeight:700,fontSize:16}}>Accès Gérant</div>
            <input type="password" value={mdpInput} onChange={e=>{setMdpInput(e.target.value);setMdpError("");}} onKeyDown={e=>e.key==="Enter"&&tryGerant()} placeholder="Mot de passe" style={{...inp,textAlign:"center",letterSpacing:2}}/>
            {mdpError&&<div style={{color:"#fca5a5",fontSize:13}}>{mdpError}</div>}
            <button onClick={tryGerant} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#6ee7b7,#34d399)",color:"#064e3b",fontWeight:700,fontSize:14,cursor:"pointer"}}>Valider</button>
            <button onClick={()=>{setShowMdp(false);setMdpInput("");setMdpError("");}} style={{background:"none",border:"none",color:"#6b7280",fontSize:13,cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {mode==="client"&&!showMdp&&(
        <div style={{...card,height:"78vh"}}>
          <div style={{padding:"16px 20px",background:"linear-gradient(135deg,rgba(110,231,183,0.12),rgba(52,211,153,0.06))",borderBottom:"1px solid rgba(110,231,183,0.12)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#6ee7b7,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🌬️</div>
            <div style={{flex:1}}>
              <div style={{color:"#e5e7eb",fontWeight:700,fontSize:16}}>La Hotte Vape</div>
              <div style={{color:"#34d399",fontSize:12,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,background:"#34d399",borderRadius:"50%",display:"inline-block"}}/>Conseiller en ligne</div>
            </div>
            {stockData&&<div style={{fontSize:11,color:"#4b5563",background:"rgba(110,231,183,0.07)",padding:"4px 10px",borderRadius:20,border:"1px solid rgba(110,231,183,0.12)"}}>{stockData.produits?.length} produits</div>}
          </div>
          {!stockData&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:24,textAlign:"center"}}>
              <div style={{fontSize:40}}>🛒</div>
              <div style={{color:"#e5e7eb",fontWeight:600,fontSize:16}}>Stock non disponible</div>
              <div style={{color:"#6b7280",fontSize:14}}>Le gérant n'a pas encore saisi le stock du jour.<br/>Revenez dans quelques instants !</div>
            </div>
          )}
          {stockData&&(
            <>
              <div style={{flex:1,overflowY:"auto",padding:"20px 18px 12px",display:"flex",flexDirection:"column",gap:14}}>
                {messages.map((m,i)=>(
                  <div key={i} className="msg" style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
                    {m.role==="assistant"&&<div style={{width:30,height:30,borderRadius:9,flexShrink:0,background:"linear-gradient(135deg,#6ee7b7,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🌬️</div>}
                    <div style={{maxWidth:"76%",padding:"11px 15px",fontSize:14,lineHeight:1.6,borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:m.role==="user"?"linear-gradient(135deg,#6ee7b7,#34d399)":"rgba(255,255,255,0.07)",color:m.role==="user"?"#064e3b":"#e5e7eb",border:m.role==="user"?"none":"1px solid rgba(110,231,183,0.12)"}} dangerouslySetInnerHTML={{__html:fmt(m.content)}}/>
                  </div>
                ))}
                {loading&&<div className="msg" style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#6ee7b7,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🌬️</div><div style={{padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(110,231,183,0.12)"}}><Dots/></div></div>}
                <div ref={bottomRef}/>
              </div>
              {messages.length<=1&&<div style={{padding:"0 18px 10px",display:"flex",gap:7,flexWrap:"wrap"}}>{SUGGESTIONS.map((s,i)=><button key={i} className="sug" onClick={()=>sendMessage(s)} style={{padding:"6px 13px",borderRadius:20,background:"rgba(110,231,183,0.07)",border:"1px solid rgba(110,231,183,0.2)",color:"#6ee7b7",fontSize:12,cursor:"pointer",transition:"all 0.2s"}}>{s}</button>)}</div>}
              <div style={{padding:"14px 18px",borderTop:"1px solid rgba(110,231,183,0.1)",background:"rgba(0,0,0,0.2)",display:"flex",gap:10,alignItems:"flex-end"}}>
                <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);}}} placeholder="Posez votre question sur les e-liquides…" rows={1} style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(110,231,183,0.18)",borderRadius:13,padding:"11px 14px",color:"#e5e7eb",fontSize:14,resize:"none",fontFamily:"inherit",lineHeight:1.5}}/>
                <button className="sbtn" onClick={()=>sendMessage(input)} disabled={loading||!input.trim()} style={{width:42,height:42,borderRadius:12,border:"none",background:"linear-gradient(135deg,#6ee7b7,#34d399)",color:"#064e3b",cursor:loading||!input.trim()?"not-allowed":"pointer",opacity:loading||!input.trim()?0.4:1,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon d={icons.send} size={16}/></button>
              </div>
            </>
          )}
        </div>
      )}

      {mode==="gerant"&&gerantOk&&!showMdp&&(
        <div style={{...card,maxHeight:"78vh"}}>
          <div style={{padding:"18px 24px",background:"linear-gradient(135deg,rgba(110,231,183,0.12),rgba(52,211,153,0.06))",borderBottom:"1px solid rgba(110,231,183,0.12)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#6ee7b7,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",color:"#064e3b"}}><Icon d={icons.store} size={18}/></div>
            <div style={{flex:1}}><div style={{color:"#e5e7eb",fontWeight:700,fontSize:16}}>Stock du jour</div><div style={{color:"#6b7280",fontSize:12}}>Saisissez vos produits pour conseiller vos clients</div></div>
            <div style={{display:"flex",background:"rgba(0,0,0,0.3)",borderRadius:20,padding:3,gap:2}}>
              {["manuel","photo"].map(m=>(<button key={m} onClick={()=>setInputMode(m)} style={{padding:"5px 14px",borderRadius:16,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:inputMode===m?"linear-gradient(135deg,#6ee7b7,#34d399)":"transparent",color:inputMode===m?"#064e3b":"#6b7280",transition:"all 0.2s"}}>{m==="manuel"?"✏️ Manuel":"📷 Photo"}</button>))}
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:16}}>
            {inputMode==="manuel"&&(
              <>
                {produits.map((p,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(110,231,183,0.12)",borderRadius:14,padding:14,display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:"#6ee7b7",fontSize:12,fontWeight:700}}>🧪 Produit {i+1}</span>
                      {produits.length>1&&<button onClick={()=>removeP(i)} style={{background:"rgba(239,68,68,0.15)",border:"none",borderRadius:6,color:"#fca5a5",fontSize:11,padding:"3px 8px",cursor:"pointer"}}>Supprimer</button>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[["marque","Marque *","ex: Pulp"],["nom","Nom *","ex: Le Petit Déjeuner"],["saveur","Saveur","ex: Céréales au lait"],["nicotine","Nicotine","ex: 3mg"],["format","Format","ex: 50ml"],["type","Type","ex: Freebase"]].map(([f,l,ph])=>(
                        <div key={f}><div style={{color:"#6b7280",fontSize:11,marginBottom:3}}>{l}</div><input value={p[f]} onChange={e=>updateP(i,f,e.target.value)} placeholder={ph} style={inp}/></div>
                      ))}
                    </div>
                    <div style={{color:"#6b7280",fontSize:11,marginBottom:3}}>Notes</div>
                    <input value={p.notes} onChange={e=>updateP(i,"notes",e.target.value)} placeholder="ex: Best-seller..." style={inp}/>
                  </div>
                ))}
                <button onClick={addP} style={{padding:"10px 0",borderRadius:10,border:"1px dashed rgba(110,231,183,0.3)",background:"transparent",color:"#6ee7b7",fontSize:13,cursor:"pointer"}}>+ Ajouter un produit</button>
                <button onClick={saveManuel} disabled={!produits.some(p=>p.marque||p.nom)} style={{padding:"13px 0",borderRadius:12,border:"none",background:saved?"rgba(110,231,183,0.2)":"linear-gradient(135deg,#6ee7b7,#34d399)",color:saved?"#6ee7b7":"#064e3b",fontWeight:700,fontSize:15,cursor:"pointer",boxShadow:saved?"none":"0 4px 20px rgba(110,231,183,0.3)"}}>{saved?"✅ Stock enregistré !":"💾 Enregistrer le stock"}</button>
                {saved&&<button onClick={()=>setMode("client")} style={{padding:"13px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#6ee7b7,#34d399)",color:"#064e3b",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 20px rgba(110,231,183,0.3)"}}><Icon d={icons.chat} size={18}/>Voir le mode client →</button>}
              </>
            )}
            {inputMode==="photo"&&(
              <>
                <div className="uzone" onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${stockPhoto?"#34d399":"rgba(110,231,183,0.25)"}`,borderRadius:16,padding:32,textAlign:"center",cursor:"pointer",transition:"all 0.2s",background:stockPhoto?"rgba(110,231,183,0.04)":"rgba(255,255,255,0.02)"}}>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
                  {stockPhoto?(<><img src={`data:image/jpeg;base64,${stockPhoto}`} style={{maxHeight:200,maxWidth:"100%",borderRadius:10,objectFit:"contain"}}/><div style={{color:"#6ee7b7",fontSize:13,marginTop:10}}>✅ Photo chargée — cliquez pour changer</div></>):(<><div style={{color:"#6ee7b7",opacity:0.5,marginBottom:10}}><Icon d={icons.img} size={36}/></div><div style={{color:"#9ca3af",fontSize:14}}>Cliquez pour uploader une photo de votre stock</div></>)}
                </div>
                {stockPhoto&&!stockData&&<button onClick={analyzeStock} disabled={analyzing} style={{padding:"13px 0",borderRadius:12,border:"none",background:analyzing?"rgba(110,231,183,0.2)":"linear-gradient(135deg,#6ee7b7,#34d399)",color:analyzing?"#6ee7b7":"#064e3b",fontWeight:700,fontSize:15,cursor:analyzing?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{analyzing?<><Dots/><span>Analyse...</span></>:<><Icon d={icons.box} size={18}/><span>Analyser le stock</span></>}</button>}
                {analyzeError&&<div style={{padding:"12px 16px",borderRadius:10,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#fca5a5",fontSize:13}}>{analyzeError}</div>}
                {stockData&&<button onClick={()=>setMode("client")} style={{padding:"13px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#6ee7b7,#34d399)",color:"#064e3b",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 20px rgba(110,231,183,0.3)"}}><Icon d={icons.chat} size={18}/>Voir le mode client →</button>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
