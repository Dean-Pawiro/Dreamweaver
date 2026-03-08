import { useState, useEffect } from "react";
import "./Images.css";

function ImagesSection({
  chatId,
  characterId,
  pollinationsModel = "flux",
  setPollinationsModel,
  aspectRatio = "1:1",
  setAspectRatio
}) {
  const pollinationsModels = [
    "flux",
    "zimage",
    "flux-2-dev",
    "imagen-4",
    "grok-imagine",
    "klein",
    "klein-large",
    "gptimage"
  ];
  const aspectRatios = ["2:3", "3:2", "1:1", "9:16", "16:9"];
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [error, setError] = useState("");
  const [mediaViewer, setMediaViewer] = useState({ open: false, index: 0 });
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");


  useEffect(() => {
    if (characterId) {
      fetchCharacterGallery();
    } else if (chatId) {
      fetchGallery();
    }
    // eslint-disable-next-line
  }, [chatId, characterId]);

  // Fetch gallery for a specific character (profile + generated images)
  async function fetchCharacterGallery() {
    setError("");
    try {
      // Fetch all chats to find those for this character
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const chatsRes = await fetch("/api/chats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const chatsData = await chatsRes.json();
      const chats = chatsData.chats || [];
      const chatIds = chats.filter(c => c.character_id === characterId).map(c => c.id);
      // Fetch all images (now includes chatId in response)
      const res = await fetch(`/api/images/gallery`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      let images = res.ok ? (data.images || []) : [];
      // Only keep images whose chatId is for this character
      const filteredImages = images.filter(img => chatIds.includes(img.chatId));
      // Add profile image if available
      const exts = [".jpg", ".jpeg", ".png", ".webp"];
      let foundProfile = null;
      for (let ext of exts) {
        try {
          const resp = await fetch(`/images/personas/${characterId}${ext}`);
          if (resp.ok) {
            foundProfile = `/images/personas/${characterId}${ext}`;
            break;
          }
        } catch {}
      }
      let finalImages = filteredImages;
      if (foundProfile) {
        finalImages = [{ url: foundProfile, isProfile: true }, ...filteredImages];
      }
      setGallery(finalImages);
      if (!res.ok) setError(data.error || "Failed to load gallery");
    } catch (e) {
      setError("Failed to load gallery");
    }
  }

  async function fetchGallery() {
    setError("");
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const res = await fetch(`/api/images/gallery?chatId=${encodeURIComponent(chatId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok) setGallery(data.images || []);
      else setError(data.error || "Failed to load gallery");
    } catch (e) {
      setError("Failed to load gallery");
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setError("");
    setGeneratedPrompt("");
    setGeneratedImage("");
    // Show loading placeholder in gallery
    setGallery((current) => [
      { url: null, chatId: "loading", loading: true },
      ...current
    ]);
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const res = await fetch("/api/images/gallery/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt, pollinationsModel, aspectRatio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prompt generation failed");
      setGeneratedImage(data.imageUrl);
      // Replace loading placeholder with generated image
      setGallery((current) => [
        { url: data.imageUrl, chatId: data.chatId },
        ...current.filter(img => img.chatId !== "loading")
      ]);
    } catch (e) {
      setError(e.message || "Generation failed");
      // Remove loading placeholder
      setGallery((current) => current.filter(img => img.chatId !== "loading"));
    } finally {
      setIsLoading(false);
    }
  }

  const handleModelChange = (e) => {
    const nextModel = e.target.value;
    if (typeof setPollinationsModel === "function") {
      setPollinationsModel(nextModel);
    }
    localStorage.setItem("pollinationsModel", nextModel);
  };

  const handleAspectRatioChange = (e) => {
    const nextRatio = e.target.value;
    if (typeof setAspectRatio === "function") {
      setAspectRatio(nextRatio);
    }
    localStorage.setItem("aspectRatio", nextRatio);
  };

  return (
    <>
      <div className="messages simple-messages" style={{flex:1,overflowY:'auto'}}>
        <div className="gallery">
          {gallery.length === 0 && <div className="empty">No images yet.</div>}
          {gallery.map((img, i) => (
            img.loading ? (
              <div key={i} className="gallery-img loading-placeholder">
                <span>Generating...</span>
              </div>
            ) : (
              <div key={i} style={{display:'inline-block',position:'relative'}}>
                <img
                  src={img.url}
                  alt={img.isProfile ? "Profile" : "Generated"}
                  className="gallery-img"
                  loading="lazy"
                  style={{cursor:'pointer',border: img.isProfile ? '2px solid #f5c26b' : undefined}}
                  onClick={() => setMediaViewer({ open: true, index: i })}
                />
                {img.isProfile && (
                  <span style={{position:'absolute',top:4,left:4,background:'#f5c26b',color:'#222',fontSize:12,padding:'2px 6px',borderRadius:6}}>Profile</span>
                )}
              </div>
            )
          ))}
        </div>
      </div>
      {mediaViewer.open && (
        <div className="media-viewer-overlay" onClick={() => setMediaViewer({ open: false, index: 0 })}>
          <div className="media-viewer-modal" style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e => e.stopPropagation()}>
            {gallery.length > 1 && mediaViewer.index > 0 && (
              <button
                className="media-viewer-arrow media-viewer-prev"
                onClick={e => { e.stopPropagation(); setMediaViewer(v => ({ ...v, index: v.index - 1 })); }}
                aria-label="Previous image"
              >&#8592;</button>
            )}
            <img
              src={gallery[mediaViewer.index]?.url}
              alt="Enlarged"
              style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 4px 32px #000b'}}
            />
            {gallery.length > 1 && mediaViewer.index < gallery.length - 1 && (
              <button
                className="media-viewer-arrow media-viewer-next"
                onClick={e => { e.stopPropagation(); setMediaViewer(v => ({ ...v, index: v.index + 1 })); }}
                aria-label="Next image"
              >&#8594;</button>
            )}
            <button className="media-viewer-close" onClick={() => setMediaViewer({ open: false, index: 0 })}>&times;</button>
            <button
              className="media-viewer-delete"
              onClick={async () => {
                if (!window.confirm("Are you sure you want to delete this image?")) return;
                const session = JSON.parse(localStorage.getItem("session"));
                const token = session?.token;
                const imageUrl = gallery[mediaViewer.index]?.url;
                if (!imageUrl) return;
                try {
                  const res = await fetch("/api/images/gallery/image/remove-chat", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ imageUrl })
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setMediaViewer({ open: false, index: 0 });
                    setTimeout(() => fetchGallery(), 100);
                  } else {
                    alert(data.error || "Delete failed");
                  }
                } catch (e) {
                  alert("Delete failed");
                }
              }}
              title="Delete image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="6" width="18" height="2" rx="1" fill="#fff"/>
                <path d="M8 8v10c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V8" stroke="#fff" strokeWidth="2"/>
                <rect x="10" y="11" width="1.5" height="6" rx=".75" fill="#fff"/>
                <rect x="12.5" y="11" width="1.5" height="6" rx=".75" fill="#fff"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      <form className="composer" onSubmit={handleGenerate}>
        <label className="field">
          <span>Image prompt</span>
          <textarea
            rows={2}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter image prompt..."
            disabled={isLoading}
            style={{resize:'none'}}
          />
        </label>
        <div className="composer-actions">
          <select
            className="composer-model-select"
            value={pollinationsModel}
            onChange={handleModelChange}
            disabled={isLoading}
            aria-label="Pollinations model"
          >
            {pollinationsModels.map((modelName) => (
              <option key={modelName} value={modelName}>
                {modelName}
              </option>
            ))}
          </select>
          <select
            className="composer-model-select"
            value={aspectRatio}
            onChange={handleAspectRatioChange}
            disabled={isLoading}
            aria-label="Image aspect ratio"
          >
            {aspectRatios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!prompt.trim() || isLoading}>
            {isLoading ? "Generating..." : "Generate Image"}
          </button>
        </div>
        {error && <div className="error" style={{marginTop:8}}>{error}</div>}
      </form>
      {generatedPrompt && (
        <div className="generated-prompt" style={{marginTop:16}}>
          <div><strong>Generated Prompt:</strong></div>
          <div style={{whiteSpace:'pre-wrap',marginBottom:8}}>{generatedPrompt}</div>
          {/* Debug: show generatedImage URL */}
          {generatedImage && (
            <>
              <div style={{fontSize:12, color:'#aaa'}}>Image URL: {generatedImage}</div>
              <img src={generatedImage} alt="Generated" style={{marginTop:8,maxWidth:'100%'}} />
            </>
          )}
        </div>
      )}
    </>
  );
}

export default ImagesSection;
