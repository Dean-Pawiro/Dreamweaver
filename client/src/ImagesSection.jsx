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
  const t2iPollinationsModels = [
    "flux",
    "zimage",
    "flux-2-dev",
    "imagen-4",
    "grok-imagine",
    "klein",
    "klein-large",
    "gptimage"
  ];
  const i2iPollinationsModels = ["flux-2-dev", "klein", "klein-large", "gptimage"];
  const videoPollinationsModels = ["grok-video"];
  const aspectRatios = ["2:3", "3:2", "1:1", "9:16", "16:9"];
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [error, setError] = useState("");
  const [mediaViewer, setMediaViewer] = useState({ open: false, index: 0 });
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [imageMode, setImageMode] = useState("t2i");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [seed, setSeed] = useState("");
  const [infoModal, setInfoModal] = useState({ open: false, prompt: "", seed: "", model: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customSeed, setCustomSeed] = useState("");

  // Show error as alert instead of div
  useEffect(() => {
    if (error) {
      alert(error);
      setError("");
    }
  }, [error]);

  useEffect(() => {
    if (characterId) {
      fetchCharacterGallery();
    } else if (chatId) {
      fetchGallery();
    }
    // eslint-disable-next-line
  }, [chatId, characterId, imageMode]);

  useEffect(() => {
    const allowedModels = imageMode === "i2i"
      ? i2iPollinationsModels
      : imageMode === "t2v" || imageMode === "i2v"
        ? videoPollinationsModels
        : t2iPollinationsModels;
    if (!allowedModels.includes(pollinationsModel)) {
      const fallbackModel = allowedModels[0];
      if (typeof setPollinationsModel === "function") {
        setPollinationsModel(fallbackModel);
      }
      localStorage.setItem("pollinationsModel", fallbackModel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMode, pollinationsModel]);

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
      const modeRes = await fetch(`/api/images/gallery?imageMode=${encodeURIComponent(imageMode)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await modeRes.json();
      let images = modeRes.ok ? (data.images || []) : [];
      // Only keep images whose chatId is for this character
      const filteredImages = images.filter(img => chatIds.includes(img.chatId));
      // Add profile image if available
      const exts = [".jpg", ".jpeg", ".png", ".webp"];
      let foundProfile = null;
      for (let ext of exts) {
        try {
          const resp = await fetch(`/dreams/personas/${characterId}${ext}`);
          if (resp.ok) {
            foundProfile = `/dreams/personas/${characterId}${ext}`;
            break;
          }
        } catch {}
      }
      let finalImages = filteredImages;
      if (foundProfile) {
        finalImages = [{ url: foundProfile, isProfile: true }, ...filteredImages];
      }
      setGallery(finalImages);
      if (!modeRes.ok) setError(data.error || "Failed to load gallery");
    } catch (e) {
      setError("Failed to load gallery");
    }
  }

  async function fetchGallery() {
    setError("");
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const res = await fetch(`/api/images/gallery?chatId=${encodeURIComponent(chatId)}&imageMode=${encodeURIComponent(imageMode)}`, {
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
    if ((imageMode === "i2i" || imageMode === "i2v") && !sourceImageUrl.trim()) {
      setError("Image URL is required for Image to Image and Image to Video");
      return;
    }
    setIsLoading(true);
    setError("");
    setGeneratedPrompt("");
    setGeneratedImage("");
    
    // Generate seeds: use custom seed if provided, otherwise generate random
    let seed1, seed2;
    if (customSeed.trim()) {
      // User provided a seed - use it for both or with variation
      const customNumeric = parseInt(customSeed, 10);
      if (isNaN(customNumeric) || customNumeric < 0 || customNumeric > 2147483647) {
        setError("Seed must be a number between 0 and 2147483647");
        setIsLoading(false);
        return;
      }
      seed1 = customNumeric.toString();
      seed2 = (customNumeric + 1).toString(); // Add 1 to second seed for variation
    } else {
      // Generate 2 random numeric seeds (0 to 2147483647 - max for Pollinations API)
      seed1 = Math.floor(Math.random() * 2147483648).toString();
      seed2 = Math.floor(Math.random() * 2147483648).toString();
    }
    setSeed(seed1); // Store first seed for reference
    
    // Show 2 loading placeholders in gallery
    setGallery((current) => [
      { url: null, chatId: "loading-1", loading: true },
      { url: null, chatId: "loading-2", loading: true },
      ...current
    ]);
    
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      
      const baseRequestBody = {
        prompt,
        pollinationsModel,
        imageMode,
        sourceImageUrl: imageMode === "i2i" || imageMode === "i2v" ? sourceImageUrl.trim() : ""
      };
      if (imageMode === "t2i" || imageMode === "t2v" || imageMode === "i2v") {
        baseRequestBody.aspectRatio = aspectRatio;
      }
      
      // Generate 2 images in parallel with different seeds
      const promises = [
        fetch("/api/images/gallery/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ ...baseRequestBody, seed: seed1 })
        }),
        fetch("/api/images/gallery/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ ...baseRequestBody, seed: seed2 })
        })
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Process results
      const newImages = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value.ok) {
          const data = await result.value.json();
          newImages.push({
            url: data.imageUrl,
            chatId: data.chatId,
            prompt,
            seed: i === 0 ? seed1 : seed2,
            model: data.model
          });
        } else {
          // Handle individual failure
          console.error(`Image ${i + 1} generation failed:`, result.reason || await result.value?.text());
        }
      }
      
      if (newImages.length === 0) {
        throw new Error("All image generations failed");
      }
      
      // Replace loading placeholders with generated images
      setGallery((current) => [
        ...newImages,
        ...current.filter(img => !img.chatId?.startsWith("loading-"))
      ]);
      
      if (newImages.length > 0) {
        setGeneratedImage(newImages[0].url);
      }
    } catch (e) {
      setError(e.message || "Generation failed");
      // Remove all loading placeholders
      setGallery((current) => current.filter(img => !img.chatId?.startsWith("loading-")));
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

  const modelOptions = imageMode === "i2i"
    ? i2iPollinationsModels
    : imageMode === "t2v" || imageMode === "i2v"
      ? videoPollinationsModels
      : t2iPollinationsModels;

  const isVideoUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".webm");
  };

  return (
    <>
      <div className="messages simple-messages" style={{flex:1,overflowY:'auto'}}>
        <div className="image-mode-tabs" role="tablist" aria-label="Image generation mode">
          <button
            type="button"
            role="tab"
            aria-selected={imageMode === "t2i"}
            className={`image-mode-tab${imageMode === "t2i" ? " active" : ""}`}
            onClick={() => setImageMode("t2i")}
          >
            Text to Image
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={imageMode === "i2i"}
            className={`image-mode-tab${imageMode === "i2i" ? " active" : ""}`}
            onClick={() => setImageMode("i2i")}
          >
            Image to Image
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={imageMode === "t2v"}
            className={`image-mode-tab${imageMode === "t2v" ? " active" : ""}`}
            onClick={() => setImageMode("t2v")}
          >
            Text to Video
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={imageMode === "i2v"}
            className={`image-mode-tab${imageMode === "i2v" ? " active" : ""}`}
            onClick={() => setImageMode("i2v")}
          >
            Image to Video
          </button>
        </div>
        <div className="gallery">
          {gallery.length === 0 && <div className="empty">No images yet.</div>}
          {gallery.map((img, i) => (
            img.loading ? (
              <div key={img.chatId || i} className="gallery-img loading-placeholder">
                <span>Generating...</span>
              </div>
            ) : (
              <div key={img.url || i} style={{display:'inline-block',position:'relative'}}>
                {isVideoUrl(img.url) ? (
                  <video
                    src={img.url}
                    className="gallery-img"
                    muted
                    playsInline
                    style={{cursor:'pointer',border: img.isProfile ? '2px solid #f5c26b' : undefined, objectFit: 'cover'}}
                    onClick={() => setMediaViewer({ open: true, index: i })}
                  />
                ) : (
                  <img
                    src={img.url}
                    alt={img.isProfile ? "Profile" : "Generated"}
                    className="gallery-img"
                    loading="lazy"
                    style={{cursor:'pointer',border: img.isProfile ? '2px solid #f5c26b' : undefined}}
                    onClick={() => setMediaViewer({ open: true, index: i })}
                  />
                )}
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
            {isVideoUrl(gallery[mediaViewer.index]?.url) ? (
              <video
                src={gallery[mediaViewer.index]?.url}
                controls
                autoPlay
                style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 4px 32px #000b'}}
              />
            ) : (
              <img
                src={gallery[mediaViewer.index]?.url}
                alt="Enlarged"
                style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 4px 32px #000b'}}
              />
            )}
            {gallery.length > 1 && mediaViewer.index < gallery.length - 1 && (
              <button
                className="media-viewer-arrow media-viewer-next"
                onClick={e => { e.stopPropagation(); setMediaViewer(v => ({ ...v, index: v.index + 1 })); }}
                aria-label="Next image"
              >&#8594;</button>
            )}
            <button className="media-viewer-close" onClick={() => setMediaViewer({ open: false, index: 0 })}>&times;</button>
            {!gallery[mediaViewer.index]?.isProfile && gallery[mediaViewer.index]?.prompt && (
              <button
                className="media-viewer-info"
                onClick={(e) => {
                  e.stopPropagation();
                  const currentImg = gallery[mediaViewer.index];
                  setInfoModal({ open: true, prompt: currentImg.prompt || "", seed: currentImg.seed || "N/A", model: currentImg.model || "N/A" });
                }}
                title="Show prompt and seed"
              >
                ⓘ
              </button>
            )}
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
      {infoModal.open && (
        <div className="media-viewer-overlay" onClick={() => setInfoModal({ open: false, prompt: "", seed: "", model: "" })}>
          <div className="media-viewer-modal" style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',maxWidth:'600px'}} onClick={e => e.stopPropagation()}>
            <button className="media-viewer-close" onClick={() => setInfoModal({ open: false, prompt: "", seed: "", model: "" })}>&times;</button>
            <div style={{width:'100%',textAlign:'center'}}>
              <div style={{marginBottom:'16px'}}>
                <h3 style={{margin:'0 0 8px 0',color:'#fff'}}>Generation Details</h3>
              </div>
              <div style={{textAlign:'left',background:'rgba(255,255,255,0.05)',padding:'12px',borderRadius:'8px',marginBottom:'12px'}}>
                <div style={{marginBottom:'12px'}}>
                  <strong style={{color:'#f5c26b'}}>Prompt:</strong>
                  <div style={{whiteSpace:'pre-wrap',wordBreak:'break-word',marginTop:'4px',color:'#ccc',fontSize:'14px'}}>{infoModal.prompt}</div>
                </div>
                <div>
                  <strong style={{color:'#f5c26b'}}>Seed:</strong>
                  <div style={{fontFamily:'monospace',marginTop:'4px',color:'#ccc',fontSize:'14px'}}>{infoModal.seed}</div>
                </div>
                <div style={{marginTop:'12px'}}>
                  <strong style={{color:'#f5c26b'}}>Model:</strong>
                  <div style={{marginTop:'4px',color:'#ccc',fontSize:'14px'}}>{infoModal.model}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Prompt: ${infoModal.prompt}\nSeed: ${infoModal.seed}\nModel: ${infoModal.model}`);
                  alert("Copied to clipboard!");
                }}
                style={{background:'#f5c26b',color:'#222',border:'none',padding:'8px 16px',borderRadius:'6px',cursor:'pointer',marginTop:'8px'}}
              >
                Copy Details
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <h3 style={{margin:0,color:'#f5c26b'}}>Generation Settings</h3>
              <button
                type="button"
                className="settings-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                &times;
              </button>
            </div>
            
            {(imageMode === "t2i" || imageMode === "t2v" || imageMode === "i2v") && (
              <label style={{display:'flex',flexDirection:'column',marginBottom:'16px'}}>
                <span style={{color:'#fff',marginBottom:'6px',fontSize:'14px'}}>Aspect Ratio</span>
                <select
                  value={aspectRatio}
                  onChange={(e) => {
                    const nextRatio = e.target.value;
                    if (typeof setAspectRatio === "function") {
                      setAspectRatio(nextRatio);
                    }
                    localStorage.setItem("aspectRatio", nextRatio);
                  }}
                  style={{padding:'8px',borderRadius:'6px',background:'rgba(255,255,255,0.1)',color:'#fff',border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer'}}
                >
                  {aspectRatios.map((ratio) => (
                    <option key={ratio} value={ratio} style={{background:'#222'}}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>
            )}
            
            <label style={{display:'flex',flexDirection:'column'}}>
              <span style={{color:'#fff',marginBottom:'6px',fontSize:'14px'}}>Seed (optional)</span>
              <input
                type="text"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                placeholder="Leave empty for random seed"
                style={{padding:'8px',borderRadius:'6px',background:'rgba(255,255,255,0.1)',color:'#fff',border:'1px solid rgba(255,255,255,0.2)',fontSize:'14px'}}
              />
              <span style={{color:'#999',fontSize:'12px',marginTop:'4px'}}>Range: 0 to 2147483647</span>
            </label>
            
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              style={{marginTop:'16px',width:'100%',padding:'10px',background:'#f5c26b',color:'#222',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:'bold'}}
            >
              Done
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
        {(imageMode === "i2i" || imageMode === "i2v") && (
          <label className="field" style={{marginTop: 8}}>
            <span>Image URL</span>
            <input
              type="url"
              value={sourceImageUrl}
              onChange={e => setSourceImageUrl(e.target.value)}
              placeholder="https://example.com/source-image.jpg"
              disabled={isLoading}
              className="i2i-source-url-input"
            />
          </label>
        )}
        <div className="composer-actions">
          <div className="composer-controls">
            <select
              className="composer-model-select"
              value={pollinationsModel}
              onChange={handleModelChange}
              disabled={isLoading}
              aria-label="Pollinations model"
            >
              {modelOptions.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName === "klein-large" ? "klein large" : modelName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="settings-button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              disabled={isLoading}
              title="Image generation settings"
            >
              ⚙
            </button>
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading || ((imageMode === "i2i" || imageMode === "i2v") && !sourceImageUrl.trim())}
          >
            {isLoading ? "Generating..." : "Generate Image"}
          </button>
        </div>
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
