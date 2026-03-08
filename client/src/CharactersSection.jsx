import { useEffect, useState } from "react";
import "./Images.css";
import "./CharactersSection.css";

const placeholderImg = "https://placehold.co/180x180?text=Portrait";
const uploadIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);

// Gallery icon SVG
const galleryIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5c26b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
);

export default function CharactersSection({ onUsePersona, onOpenGallery }) {
  const [mediaViewer, setMediaViewer] = useState({ open: false, url: "" });
  // Store portrait URLs in state (keyed by persona id)
  const [portraits, setPortraits] = useState({});
  const [personas, setPersonas] = useState([]);
  const [personaChats, setPersonaChats] = useState({});
  const [newPersona, setNewPersona] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    fetchPersonas();
  }, []);

  // Load portraits for personas if available
  useEffect(() => {
    if (!personas.length) return;
    personas.forEach(p => {
      const base = `/images/personas/${p.id}`;
      const exts = [".jpg", ".jpeg", ".png", ".webp"];
      let found = false;
      const tryNext = (i) => {
        if (i >= exts.length) return;
        const img = new window.Image();
        img.onload = () => {
          setPortraits(prev => ({ ...prev, [p.id]: `${base}${exts[i]}` }));
          found = true;
        };
        img.onerror = () => {
          if (!found) tryNext(i + 1);
        };
        img.src = `${base}${exts[i]}`;
      };
      tryNext(0);
    });
  }, [personas]);

  // Fetch chats for each persona
  useEffect(() => {
    if (personas.length === 0) return;
    const fetchChatsForPersonas = async () => {
      const allChats = {};
      const token = JSON.parse(localStorage.getItem("session"))?.token;
      for (const p of personas) {
        try {
          const res = await fetch(`/api/chats`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          const data = await res.json();
          if (res.ok && data.chats) {
            allChats[p.id] = data.chats.filter(c => c.character_id === p.id);
          }
        } catch {}
      }
      setPersonaChats(allChats);
    };
    fetchChatsForPersonas();
  }, [personas]);

  async function fetchPersonas() {
    setError("");
    setIsLoading(true);
    try {
      // Fetch all recent personas from backend
      let token = null;
      try {
        token = JSON.parse(localStorage.getItem("session"))?.token;
      } catch {}
      const res = await fetch("/api/characters", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok) setPersonas(data.personas || []);
      else setError(data.error || "Failed to load personas");
    } catch (e) {
      setError("Failed to load personas");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddPersona(e) {
    e.preventDefault();
    if (!newPersona.trim() || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      // Add new persona to backend
      const token = JSON.parse(localStorage.getItem("session"))?.token;
      const res = await fetch("/api/character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ persona: newPersona })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add persona");
      setNewPersona("");
      fetchPersonas();
    } catch (e) {
      setError(e.message || "Failed to add persona");
    } finally {
      setIsLoading(false);
    }
}

return (
  <>
    <div className="messages simple-messages" style={{flex:1,overflowY:'auto'}}>
      <div className="gallery">
        {personas.length === 0 && <div className="empty">No personas yet.</div>}
        {personas.map((p, i) => (
          <div key={p.id} className="card" style={{width:340,margin:'0 1rem 1rem 0',padding:20,display:'inline-block',verticalAlign:'top',position:'relative'}}>
            {/* Delete X button */}
            <button
              className="delete-character-btn"
              style={{position:'absolute',top:10,right:14,background:'none',border:'none',color:'#f5c26b',fontSize:'1.3em',cursor:'pointer',zIndex:2}}
              title="Delete character"
              onClick={async (e) => {
                e.stopPropagation();
                if (!window.confirm('Delete this character persona?')) return;
                try {
                  const token = JSON.parse(localStorage.getItem("session"))?.token;
                  const res = await fetch(`/api/character?characterId=${encodeURIComponent(p.id)}`, {
                    method: 'DELETE',
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to delete character');
                  fetchPersonas();
                } catch (err) {
                  setError(err.message || 'Failed to delete character');
                }
              }}
            >×</button>
            <div style={{position:'relative',marginBottom:12}}>
              <img
                src={portraits[p.id] || placeholderImg}
                alt="Portrait"
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '2px solid #333',
                  cursor: 'pointer'
                }}
                onClick={() => setMediaViewer({ open: true, url: portraits[p.id] || placeholderImg })}
              />
              {/* Gallery icon: left bottom */}
              <button
                title="View gallery"
                style={{
                  position: 'absolute',
                  left: 8,
                  bottom: 8,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 32,
                  width: 32,
                  zIndex: 2
                }}
                onClick={() => onOpenGallery && onOpenGallery(p.id)}
              >
                {galleryIcon}
              </button>
              <label style={{position:'absolute',bottom:8,right:8,background:'#222b',borderRadius:'50%',padding:6,cursor:'pointer',zIndex:2}} title="Upload portrait">
                {uploadIcon}
                <input
                  type="file"
                  accept="image/*"
                  style={{display:'none'}}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    // Upload to backend and save for persistence
                    const formData = new FormData();
                    formData.append("characterId", p.id);
                    formData.append("portrait", file);
                    // Debug: log FormData keys and values
                    for (let pair of formData.entries()) {
                      // console.log('[Upload FormData]', pair[0], pair[1]); // Debug only
                    }
                    try {
                      const token = JSON.parse(localStorage.getItem("session"))?.token;
                      const res = await fetch("/api/persona-image", {
                        method: "POST",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: formData
                      });
                      const data = await res.json();
                      if (res.ok && data.url) {
                        setPortraits(prev => ({ ...prev, [p.id]: data.url }));
                      } else {
                        alert(data.error || "Upload failed");
                      }
                    } catch (err) {
                      alert("Upload failed");
                    }
                  }}
                />
              </label>
            </div>
            <div style={{whiteSpace:'pre-wrap',fontWeight:600,color:'#f5c26b',marginBottom:8,fontSize:'1.08em'}}>{p.persona.slice(0, 180)}</div>
            <div style={{fontSize:'0.9em',color:'#b6b6a8',marginBottom:12}}>{p.updated_at ? new Date(p.updated_at).toLocaleString() : ''}</div>
            {/* List chats for this persona */}
            {personaChats[p.id]?.length > 0 && (
              <div style={{marginBottom:'8px'}}>
                <div style={{fontWeight:'bold',color:'#b6b6a8',marginBottom:'4px'}}>Chats:</div>
                {personaChats[p.id].map(chat => (
                  <button
                    key={chat.id}
                    className="secondary"
                    style={{margin:'2px 0',fontSize:'0.92em',padding:'4px 8px',display:'block',width:'100%',textAlign:'left'}}
                    onClick={() => onUsePersona && onUsePersona(p.persona, p.id, "jump", chat.id)}
                  >{chat.id.slice(0, 8)} - {new Date(chat.created_at).toLocaleString()}</button>
                ))}
              </div>
            )}
            <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
              <button className="secondary" style={{flex:1}} type="button" onClick={() => { setEditIndex(i); setEditValue(p.persona); setEditStatus(""); }}>Edit</button>
              <button className="secondary" style={{flex:1}} type="button" onClick={() => onUsePersona && onUsePersona(p.persona, p.id, "use")}>Use</button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {/* Enlarge Image Modal */}
    {mediaViewer.open && (
      <div className="media-viewer-overlay" style={{zIndex:2000}} onClick={() => setMediaViewer({ open: false, url: "" })}>
        <div className="media-viewer-modal" onClick={e => e.stopPropagation()}>
          <img src={mediaViewer.url} alt="Enlarged" style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 4px 32px #000b'}} />
          <button className="media-viewer-close" onClick={() => setMediaViewer({ open: false, url: "" })}>&times;</button>
        </div>
      </div>
    )}
    {/* Edit Persona Popup */}
    {editIndex !== null && (
      <div className="media-viewer-overlay" style={{zIndex:2000}} onClick={() => setEditIndex(null)}>
        <div className="media-viewer-modal character-edit-modal" onClick={e => e.stopPropagation()}>
          <h3 style={{color:'#f5c26b',marginTop:0}}>Edit Persona</h3>
          <label className="field">
            <span>Edit persona</span>
            <textarea
              rows={10}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder="Edit persona..."
              autoFocus
            />
          </label>
          <div style={{display:'flex',gap:'12px',marginTop:8}}>
            <button className="secondary" onClick={() => setEditIndex(null)} type="button">Cancel</button>
            <button className="secondary" onClick={async () => {
              setEditStatus("Saving...");
              try {
                const token = JSON.parse(localStorage.getItem("session"))?.token;
                const res = await fetch("/api/character", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                  },
                  body: JSON.stringify({ characterId: personas[editIndex].id, persona: editValue })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to update persona");
                setEditStatus("Saved");
                setEditIndex(null);
                fetchPersonas();
              } catch (e) {
                setEditStatus(e.message || "Failed to update persona");
              }
            }} type="button">Save</button>
          </div>
          {editStatus && <div className="status" style={{marginTop:8}}>{editStatus}</div>}
        </div>
      </div>
    )}
    <form className="composer" onSubmit={handleAddPersona} style={{marginTop:24}}>
      <label className="field">
        <span>Add persona</span>
        <textarea
          rows={2}
          value={newPersona}
          onChange={e => setNewPersona(e.target.value)}
          placeholder="Enter new persona..."
          disabled={isLoading}
          style={{resize:'none'}}
        />
      </label>
      <button type="submit" disabled={!newPersona.trim() || isLoading}>
        {isLoading ? "Adding..." : "Add Persona"}
      </button>
      {error && <div className="error" style={{marginTop:8}}>{error}</div>}
    </form>
  </>
);
}