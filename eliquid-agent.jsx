import { useState, useRef, useEffect } from "react";

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `Tu es un assistant spécialisé en e-liquides. Analyse cette photo du stock d'une boutique de vape.
Identifie avec précision :
- Les marques présentes
- Les noms des e-liquides / saveurs
- Les taux de nicotine visibles (mg ou %)
- Les formats (10ml, 50ml, 100ml...)
- Les types (freebase, sel de nic, booster...)
- Le ratio PG/VG si visible

Retourne un JSON UNIQUEMENT (sans backticks, sans texte avant ou après) avec cette structure exacte :
{
  "produits": [
    {
      "marque": "...",
      "nom": "...",
      "saveur": "...",
      "nicotine": "...",
      "format": "...",
      "type": "...",
      "notes": "..."
    }
  ],
  "resume": "Résumé court du stock en 2 phrases"
}
Si tu ne peux pas lire clairement certaines infos, mets "?" pour ce champ.`;

const buildChatSystemPrompt = (stockJson) => `Tu es le conseiller de La Hotte Vape, boutique spécialisée en e-liquides. Tu es passionné et expert.
Tu connais UNIQUEMENT les produits ci-dessous, qui sont en stock dans la boutique. Ne recommande JAMAIS un produit absent de cette liste.

STOCK DISPONIBLE :
${JSON.stringify(stockJson, null, 2)}

Tes règles :
- Réponds toujours en français, avec enthousiasme et bienveillance
- Pose des questions pour cerner le profil du client (ex-fumeur ? saveurs préférées ? niveau de nico ?)
- Recommande des produits du stock avec leur nom exact et leur taux de nicotine
- Si le client demande quelque chose qu'on n'a pas, dis-le clairement et propose une alternative du stock
- Sois concis : 2-4 phrases maximum par réponse
- Utilise des emojis avec parcimonie`;

// ── ICONS ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  send: "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  store: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  check: "M20 6L9 17l-5-5",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  image: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  warning: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
};

// ── SUGGESTIONS ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Je veux arrêter la cigarette, par où commencer ?",
  "Quelle saveur pour quelqu'un qui aime les fruits ?",
  "Quel taux de nicotine me conseilles-tu ?",
  "J'ai déjà une box, je cherche un bon liquide",
];

// ── DOTS LOADER ───────────────────────────────────────────────────────────────
const Dots = () => (
  <div style={{ display: "flex", gap: 5, padding: "4px 0" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 7, height: 7, borderRadius: "50%", background: "#6ee7b7",
        animation: "dotPulse 1.2s ease infinite",
        animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("gerant"); // "gerant" | "client"
  const [inputMode, setInputMode] = useState("manuel"); // "manuel" | "photo"
  const [stockPhoto, setStockPhoto] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Saisie manuelle
  const [produits, setProduits] = useState([
    { marque: "", nom: "", saveur: "", nicotine: "", format: "", type: "", notes: "" }
  ]);
  const [manuelSaved, setManuelSaved] = useState(false);

  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const DEMO_STOCK = {
    resume: "Stock de démonstration. Uploadez votre photo en mode Gérant pour le remplacer par votre vrai stock.",
    produits: [
      { marque: "Pulp", nom: "Le Petit Déjeuner", saveur: "Céréales au lait", nicotine: "3mg / 6mg", format: "50ml", type: "Freebase", notes: "Best-seller" },
      { marque: "Vampire Vape", nom: "Heisenberg", saveur: "Fruits rouges menthol", nicotine: "3mg / 6mg", format: "10ml", type: "Freebase", notes: "" },
      { marque: "IVG", nom: "Blue Raspberry", saveur: "Framboise bleue", nicotine: "20mg", format: "10ml", type: "Sel de nicotine", notes: "" },
      { marque: "Dinner Lady", nom: "Lemon Tart", saveur: "Tarte citron meringuée", nicotine: "3mg", format: "50ml", type: "Freebase", notes: "" },
      { marque: "Liqua", nom: "Tabac Blond", saveur: "Tabac léger", nicotine: "6mg / 12mg", format: "10ml", type: "Freebase", notes: "Pour les ex-fumeurs" },
    ]
  };

  const effectiveStock = stockData || DEMO_STOCK;
  const isDemo = !stockData;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // ── Initialise chat quand on passe en mode client ──
  useEffect(() => {
    if (mode === "client" && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Bonjour ! 👋 Bienvenue chez **La Hotte Vape** !\n\nJe connais tous les produits disponibles en boutique. Dites-moi ce que vous cherchez et je vous guide vers le meilleur choix ! 🌬️`,
      }]);
    }
  }, [mode]);

  // ── Upload & analyse photo stock ──────────────────────────────────────────
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStockPhoto(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
    setStockData(null);
    setAnalyzeError("");
  };

  const analyzeStock = async () => {
    if (!stockPhoto) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: stockPhoto } },
              { type: "text", text: ANALYZE_PROMPT },
            ],
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setStockData(parsed);
    } catch (err) {
      setAnalyzeError("Impossible d'analyser l'image. Vérifie qu'elle est nette et réessaie.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Saisie manuelle ───────────────────────────────────────────────────────
  const updateProduit = (i, field, val) => {
    setProduits(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
    setManuelSaved(false);
  };
  const addProduit = () => setProduits(p => [...p, { marque: "", nom: "", saveur: "", nicotine: "", format: "", type: "", notes: "" }]);
  const removeProduit = (i) => setProduits(p => p.filter((_, idx) => idx !== i));
  const saveManuel = () => {
    const valides = produits.filter(p => p.marque || p.nom);
    if (!valides.length) return;
    setStockData({ produits: valides, resume: `Stock saisi manuellement — ${valides.length} produit(s) enregistré(s).` });
    setManuelSaved(true);
  };

  // ── Chat client ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text.trim() || chatLoading) return;
    const userMsg = { role: "user", content: text };
    const newHistory = [...history, { role: "user", content: text }];
    setMessages(p => [...p, userMsg]);
    setHistory(newHistory);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildChatSystemPrompt(effectiveStock),
          messages: newHistory,
        }),
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "Désolé, une erreur est survenue.";
      setMessages(p => [...p, { role: "assistant", content: reply }]);
      setHistory(p => [...p, { role: "assistant", content: reply }]);
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "❌ Erreur de connexion." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const fmt = (t) => t
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");

  // ── STYLES ────────────────────────────────────────────────────────────────
  const card = {
    width: "100%", maxWidth: 760,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(24px)",
    borderRadius: 24,
    border: "1px solid rgba(110,231,183,0.15)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(110,231,183,0.06)",
    overflow: "hidden",
    display: "flex", flexDirection: "column",
  };

  const pill = (active) => ({
    padding: "9px 22px",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.3,
    transition: "all 0.25s ease",
    background: active ? "linear-gradient(135deg, #6ee7b7, #34d399)" : "rgba(255,255,255,0.06)",
    color: active ? "#064e3b" : "#9ca3af",
    boxShadow: active ? "0 4px 20px rgba(110,231,183,0.35)" : "none",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #020c18 0%, #041f1a 50%, #020c18 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 16, fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dotPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.3; transform:scale(0.7); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .msg { animation: fadeUp 0.3s ease; }
        .tab:hover { background: rgba(110,231,183,0.1) !important; color: #6ee7b7 !important; }
        .suggest:hover { background: rgba(110,231,183,0.15) !important; border-color: #6ee7b7 !important; transform: translateY(-1px); }
        .send-btn:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.05); }
        .upload-zone:hover { border-color: #6ee7b7 !important; background: rgba(110,231,183,0.06) !important; }
        .product-card:hover { background: rgba(110,231,183,0.08) !important; }
        textarea:focus { outline: none; border-color: #6ee7b7 !important; box-shadow: 0 0 0 3px rgba(110,231,183,0.15); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(110,231,183,0.25); border-radius: 10px; }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#6ee7b7", letterSpacing: -1 }}>
          🌬️ La Hotte Vape
        </div>
        <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>Conseiller e-liquide intelligent</div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 40,
        border: "1px solid rgba(110,231,183,0.1)",
      }}>
        <button className="tab" style={pill(mode === "gerant")} onClick={() => setMode("gerant")}>
          🏪 Gérant — Scanner le stock
        </button>
        <button
          className="tab"
          style={pill(mode === "client")}
          onClick={() => { setMessages([]); setHistory([]); setMode("client"); }}
        >
          💬 Client — Demander conseil {isDemo ? "⚡démo" : ""}
        </button>
      </div>

      {/* ── MODE GÉRANT ── */}
      {mode === "gerant" && (
        <div style={{ ...card, maxHeight: "78vh" }}>
          {/* Header */}
          <div style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, rgba(110,231,183,0.12), rgba(52,211,153,0.06))",
            borderBottom: "1px solid rgba(110,231,183,0.12)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #6ee7b7, #34d399)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#064e3b", flexShrink: 0,
            }}>
              <Icon d={icons.store} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 16 }}>Votre stock</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Saisissez vos produits pour que l'agent les connaisse</div>
            </div>
            {/* Toggle manuel / photo */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 20, padding: 3, gap: 2 }}>
              {["manuel", "photo"].map(m => (
                <button key={m} onClick={() => setInputMode(m)} style={{
                  padding: "5px 14px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: inputMode === m ? "linear-gradient(135deg,#6ee7b7,#34d399)" : "transparent",
                  color: inputMode === m ? "#064e3b" : "#6b7280", transition: "all 0.2s",
                }}>{m === "manuel" ? "✏️ Manuel" : "📷 Photo"}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── SAISIE MANUELLE ── */}
            {inputMode === "manuel" && (
              <>
                {produits.map((p, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(110,231,183,0.12)",
                    borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#6ee7b7", fontSize: 12, fontWeight: 700 }}>🧪 Produit {i + 1}</span>
                      {produits.length > 1 && (
                        <button onClick={() => removeProduit(i)} style={{
                          background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 6,
                          color: "#fca5a5", fontSize: 11, padding: "3px 8px", cursor: "pointer",
                        }}>Supprimer</button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        ["marque", "Marque *", "ex: Pulp"],
                        ["nom", "Nom *", "ex: Le Petit Déjeuner"],
                        ["saveur", "Saveur", "ex: Céréales au lait"],
                        ["nicotine", "Nicotine", "ex: 3mg / 6mg"],
                        ["format", "Format", "ex: 50ml"],
                        ["type", "Type", "ex: Freebase / Sel de nic"],
                      ].map(([field, label, placeholder]) => (
                        <div key={field}>
                          <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 3 }}>{label}</div>
                          <input
                            value={p[field]} onChange={e => updateProduit(i, field, e.target.value)}
                            placeholder={placeholder}
                            style={{
                              width: "100%", boxSizing: "border-box",
                              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(110,231,183,0.15)",
                              borderRadius: 8, padding: "7px 10px", color: "#e5e7eb", fontSize: 13,
                              fontFamily: "inherit", outline: "none",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 3 }}>Notes</div>
                      <input
                        value={p.notes} onChange={e => updateProduit(i, "notes", e.target.value)}
                        placeholder="ex: Best-seller, rupture de stock…"
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(110,231,183,0.15)",
                          borderRadius: 8, padding: "7px 10px", color: "#e5e7eb", fontSize: 13,
                          fontFamily: "inherit", outline: "none",
                        }}
                      />
                    </div>
                  </div>
                ))}

                <button onClick={addProduit} style={{
                  padding: "10px 0", borderRadius: 10, border: "1px dashed rgba(110,231,183,0.3)",
                  background: "transparent", color: "#6ee7b7", fontSize: 13, cursor: "pointer",
                }}>+ Ajouter un produit</button>

                <button onClick={saveManuel} disabled={!produits.some(p => p.marque || p.nom)} style={{
                  padding: "13px 0", borderRadius: 12, border: "none",
                  background: manuelSaved ? "rgba(110,231,183,0.2)" : "linear-gradient(135deg, #6ee7b7, #34d399)",
                  color: manuelSaved ? "#6ee7b7" : "#064e3b",
                  fontWeight: 700, fontSize: 15, cursor: "pointer",
                  boxShadow: manuelSaved ? "none" : "0 4px 20px rgba(110,231,183,0.3)",
                }}>
                  {manuelSaved ? "✅ Stock enregistré !" : "💾 Enregistrer le stock"}
                </button>

                {manuelSaved && (
                  <button onClick={() => { setMessages([]); setHistory([]); setMode("client"); }} style={{
                    padding: "13px 0", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #6ee7b7, #34d399)",
                    color: "#064e3b", fontWeight: 700, fontSize: 15, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 4px 20px rgba(110,231,183,0.3)",
                  }}>
                    <Icon d={icons.chat} size={18} />Passer en mode client →
                  </button>
                )}
              </>
            )}

            {/* ── PHOTO ── */}
            {inputMode === "photo" && (
              <>
                <div
                  className="upload-zone"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${stockPhoto ? "#34d399" : "rgba(110,231,183,0.25)"}`,
                    borderRadius: 16, padding: 32, textAlign: "center",
                    cursor: "pointer", transition: "all 0.2s ease",
                    background: stockPhoto ? "rgba(110,231,183,0.04)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
                  {stockPhoto ? (
                    <>
                      <img src={`data:image/jpeg;base64,${stockPhoto}`}
                        style={{ maxHeight: 220, maxWidth: "100%", borderRadius: 10, objectFit: "contain" }} />
                      <div style={{ color: "#6ee7b7", fontSize: 13, marginTop: 12 }}>
                        ✅ Photo chargée — cliquez pour en choisir une autre
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ color: "#6ee7b7", opacity: 0.5, marginBottom: 10 }}>
                        <Icon d={icons.image} size={36} />
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 14 }}>Cliquez pour uploader une photo de votre stock</div>
                      <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>JPG, PNG — prenez une photo claire des étiquettes</div>
                    </>
                  )}
                </div>

                {stockPhoto && !stockData && (
                  <button onClick={analyzeStock} disabled={analyzing} style={{
                    padding: "13px 0", borderRadius: 12, border: "none",
                    background: analyzing ? "rgba(110,231,183,0.2)" : "linear-gradient(135deg, #6ee7b7, #34d399)",
                    color: analyzing ? "#6ee7b7" : "#064e3b",
                    fontWeight: 700, fontSize: 15, cursor: analyzing ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: analyzing ? "none" : "0 4px 20px rgba(110,231,183,0.3)",
                  }}>
                    {analyzing ? <><Dots /><span>Analyse en cours…</span></> : <><Icon d={icons.box} size={18} /><span>Analyser le stock</span></>}
                  </button>
                )}

                {analyzeError && (
                  <div style={{
                    padding: "12px 16px", borderRadius: 10,
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                    color: "#fca5a5", fontSize: 13, display: "flex", gap: 8,
                  }}>
                    <Icon d={icons.warning} size={16} />{analyzeError}
                  </div>
                )}

                {stockData && inputMode === "photo" && (
                  <div style={{ animation: "fadeUp 0.4s ease" }}>
                    <div style={{
                      padding: "12px 16px", borderRadius: 10, marginBottom: 14,
                      background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)",
                      color: "#6ee7b7", fontSize: 13,
                    }}>✅ {stockData.resume}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 10, fontWeight: 600, letterSpacing: 1 }}>
                      {stockData.produits?.length} PRODUIT(S) DÉTECTÉ(S)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {stockData.produits?.map((p, i) => (
                        <div key={i} className="product-card" style={{
                          padding: "12px 14px", borderRadius: 10,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(110,231,183,0.1)",
                          display: "flex", gap: 12, transition: "background 0.2s",
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                            background: "linear-gradient(135deg, rgba(110,231,183,0.2), rgba(52,211,153,0.1))",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                          }}>🧪</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 14 }}>{p.marque} — {p.nom}</div>
                            <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                              {[p.saveur, p.nicotine, p.format, p.type].filter(x => x && x !== "?").join(" · ")}
                            </div>
                            {p.notes && p.notes !== "?" && (
                              <div style={{ color: "#4b5563", fontSize: 11, marginTop: 3, fontStyle: "italic" }}>{p.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setMessages([]); setHistory([]); setMode("client"); }} style={{
                      marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg, #6ee7b7, #34d399)",
                      color: "#064e3b", fontWeight: 700, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      boxShadow: "0 4px 20px rgba(110,231,183,0.3)",
                    }}>
                      <Icon d={icons.chat} size={18} />Passer en mode client →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODE CLIENT ── */}
      {mode === "client" && (
        <div style={{ ...card, height: "78vh" }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(110,231,183,0.12), rgba(52,211,153,0.06))",
            borderBottom: "1px solid rgba(110,231,183,0.12)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #6ee7b7, #34d399)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#064e3b", fontSize: 20, flexShrink: 0,
            }}>🌬️</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 16 }}>La Hotte Vape</div>
              <div style={{ color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, background: "#34d399", borderRadius: "50%", display: "inline-block" }} />
                Connaît votre stock · Prêt à conseiller
              </div>
            </div>
            <div style={{
              fontSize: 11, color: "#4b5563", background: "rgba(110,231,183,0.07)",
              padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(110,231,183,0.12)",
            }}>
              {effectiveStock?.produits?.length} produits {isDemo ? "· démo" : ""}
            </div>
          </div>

          {/* Bannière démo */}
          {isDemo && (
            <div style={{
              padding: "8px 18px", fontSize: 12, textAlign: "center",
              background: "rgba(251,191,36,0.08)", borderBottom: "1px solid rgba(251,191,36,0.2)",
              color: "#fbbf24",
            }}>
              ⚡ Mode démo — Allez dans <strong>Gérant</strong> et uploadez votre photo pour utiliser votre vrai stock
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} className="msg" style={{
                display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                gap: 8, alignItems: "flex-end",
              }}>
                {m.role === "assistant" && (
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    background: "linear-gradient(135deg, #6ee7b7, #34d399)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>🌬️</div>
                )}
                <div style={{
                  maxWidth: "76%", padding: "11px 15px", fontSize: 14, lineHeight: 1.6,
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.role === "user"
                    ? "linear-gradient(135deg, #6ee7b7, #34d399)"
                    : "rgba(255,255,255,0.07)",
                  color: m.role === "user" ? "#064e3b" : "#e5e7eb",
                  border: m.role === "user" ? "none" : "1px solid rgba(110,231,183,0.12)",
                  boxShadow: m.role === "user" ? "0 4px 15px rgba(110,231,183,0.25)" : "none",
                  fontWeight: m.role === "user" ? 500 : 400,
                }}
                  dangerouslySetInnerHTML={{ __html: fmt(m.content) }}
                />
              </div>
            ))}

            {chatLoading && (
              <div className="msg" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: "linear-gradient(135deg, #6ee7b7, #34d399)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>🌬️</div>
                <div style={{
                  padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(110,231,183,0.12)",
                }}>
                  <Dots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: "0 18px 10px", display: "flex", gap: 7, flexWrap: "wrap" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="suggest" onClick={() => sendMessage(s)} style={{
                  padding: "6px 13px", borderRadius: 20,
                  background: "rgba(110,231,183,0.07)", border: "1px solid rgba(110,231,183,0.2)",
                  color: "#6ee7b7", fontSize: 12, cursor: "pointer", transition: "all 0.2s",
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "14px 18px",
            borderTop: "1px solid rgba(110,231,183,0.1)",
            background: "rgba(0,0,0,0.2)", display: "flex", gap: 10, alignItems: "flex-end",
          }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Posez votre question sur les e-liquides…"
              rows={1}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(110,231,183,0.18)",
                borderRadius: 13, padding: "11px 14px", color: "#e5e7eb", fontSize: 14,
                resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "all 0.2s",
              }}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={chatLoading || !input.trim()}
              style={{
                width: 42, height: 42, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #6ee7b7, #34d399)",
                color: "#064e3b", cursor: chatLoading || !input.trim() ? "not-allowed" : "pointer",
                opacity: chatLoading || !input.trim() ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s",
                boxShadow: "0 4px 15px rgba(110,231,183,0.3)",
              }}
            >
              <Icon d={icons.send} size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
