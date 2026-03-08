import { useEffect, useRef, useState } from "react";
import Login from "./Login";
// import AccountSection from "./AccountSection";
import "./App.css";
import "./NavButton.css";
import ImagesSection from "./ImagesSection";
import CharactersSection from "./CharactersSection";
import SettingsSection from "./SettingsSection";

const starterMessages = [
  {
    role: "assistant",
    content: "Let's make some dreams come true. What would you like to see today?"
  }
];

// const OPEN_QUOTES = ["\"", "\u201c"];
const CLOSE_QUOTES = {
  "\"": "\"",
  "\u201c": "\u201d"
};

function parseMessageSegments(text) {
  // Example parser for message segments (actions, dialogue, text)
  // This is a placeholder implementation; adapt as needed.
  const segments = [];
  let i = 0;
  while (i < text.length) {
    // Detect action (e.g. *action*)
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        segments.push({ type: "action", content: text.slice(i + 1, end).trim() });
        i = end + 1;
        continue;
      }
    }
    // Detect dialogue (e.g. "dialogue" or “dialogue”)
    if (text[i] === "\"" || text[i] === "\u201c") {
      const quote = text[i];
      const close = CLOSE_QUOTES[quote];
      const end = text.indexOf(close, i + 1);
      if (end !== -1) {
        segments.push({ type: "dialogue", content: text.slice(i + 1, end).trim() });
        i = end + 1;
        continue;
      }
    }
    // Find next special character
    let next = text.length;
    const nextAsterisk = text.indexOf("*", i);
    if (nextAsterisk !== -1 && nextAsterisk < next) {
      next = nextAsterisk;
    }
    const nextQuote = text.indexOf("\"", i);
    if (nextQuote !== -1 && nextQuote < next) {
      next = nextQuote;
    }
    const nextCurly = text.indexOf("\u201c", i);
    if (nextCurly !== -1 && nextCurly < next) {
      next = nextCurly;
    }
    const content = text.slice(i, next).trim();
    if (content) {
      segments.push({ type: "text", content });
    }
    i = next === i ? i + 1 : next;
  }
  return segments;
}

function renderMessageContent(content) {
  const segments = parseMessageSegments(content);
  if (!segments.length) {
    return <p className="segment-text">{content}</p>;
  }

  return segments.map((segment, index) => {
    const key = `${segment.type}-${index}`;

    if (segment.type === "action") {
      return (
        <blockquote className="segment-action" key={key}>
          {segment.content}
        </blockquote>
      );
    }

    if (segment.type === "dialogue") {
      return (
        <div className="segment-dialogue" key={key}>
          {segment.content}
        </div>
      );
    }

    return (
      <p className="segment-text" key={key}>
        {segment.content}
      </p>
    );
  });
}


function App() {
  // Session state
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem("session");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showAccount, setShowAccount] = useState(false);
  // Login handler
  const [pendingLogin, setPendingLogin] = useState(null);
  const handleLogin = (data) => {
    setPendingLogin(data);
    setSession(data);
    localStorage.setItem("session", JSON.stringify(data));
    // Reset chatId and sidebarTab to avoid landing in hidden gallery chat
    setChatId("");
    localStorage.setItem("chatId", "");
    setSidebarTab("chats");
    localStorage.setItem("sidebarTab", "chats");
    window.location.reload();
  };
  // Logout handler
  const [pendingLogout, setPendingLogout] = useState(false);
  const handleLogout = () => {
    setPendingLogout(true);
  };

  // Effect to handle logout
  useEffect(() => {
    if (pendingLogout) {
      setSession(null);
      localStorage.removeItem("session");
      setSidebarTab("chats");
      localStorage.setItem("sidebarTab", "chats");
      setChatId("");
      localStorage.setItem("chatId", "");
      setPendingLogout(false);
      window.location.reload();
    }
  }, [pendingLogout]);
  // For character gallery navigation
  const [characterGalleryId, setCharacterGalleryId] = useState(null);
  // Sidebar open/close state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, url: "" });
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [chats, setChats] = useState([]);
  const endRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [fadeIndexes, setFadeIndexes] = useState([]);
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const [outfit, setOutfit] = useState("");
  const [outfitStatus, setOutfitStatus] = useState("");
  const [outfitOpen, setOutfitOpen] = useState(false);
  const imagePromptStyle = "A candid, photorealistic portrait photograph of";
  const [sidebarTab, _setSidebarTab] = useState(() => {
    const storedTab = localStorage.getItem("sidebarTab");
    return ["chats", "images", "characters", "settings"].includes(storedTab) ? storedTab : "chats";
  });
  const [imageApi, setImageApi] = useState(() => localStorage.getItem("imageApi") || "default");
  const [pollinationsModel, setPollinationsModel] = useState(() => localStorage.getItem("pollinationsModel") || "flux");
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem("aspectRatio") || "1:1");

  // Custom setters to persist to localStorage
  const setSidebarTab = (tab) => {
    _setSidebarTab(tab);
    localStorage.setItem("sidebarTab", tab);
    if (tab === "account") setShowAccount(true);
    else setShowAccount(false);
  };

  // ChatId state and setter
  const [chatId, setChatId] = useState(() => localStorage.getItem("chatId") || "");
  // Gallery chat id for current user
  const galleryChatId = session ? `gallery_${session.user_id}` : "";
  // Persona state and setter
  const [persona, setPersona] = useState("");
  const [personaStatus, setPersonaStatus] = useState("");

  // ...existing code...
  // Move login screen rendering to after all hooks

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Show login screen if not signed in
  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  // Keep sidebarTab in sync with localStorage if changed elsewhere
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "sidebarTab") {
        _setSidebarTab(e.newValue || "chats");
      }
      if (e.key === "chatId") {
        setChatId(e.newValue || "");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Switch to hidden gallery chat id when Images tab is selected
  useEffect(() => {
    if (sidebarTab === "images") {
      setChatId(galleryChatId);
      localStorage.setItem("chatId", galleryChatId);
    }
  }, [sidebarTab, galleryChatId]);

  const resizeTextarea = (element) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = element.scrollHeight + "px";
  };

  useEffect(() => {
    resizeTextarea(inputRef.current);
  }, [input]);

  useEffect(() => {
    if (editMode) {
      resizeTextarea(editInputRef.current);
    }
  }, [editMode, input]);

  // Device detection: true if mobile
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);

  const handleInputChange = (event, target) => {
    setInput(event.target.value);
    resizeTextarea(target || event.target);
  };

  // Load chat list and last chat on mount
  useEffect(() => {
    fetchChats();
    if (chatId) {
      void loadHistory(chatId);
      void loadPersona(chatId);
    }
  }, []);

  // Fetch all chats
  const fetchChats = async () => {
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const res = await fetch("/api/chats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      // For each chat, if persona is empty, fetch the first user message
      const chatsWithSummary = await Promise.all(
        (data.chats || []).map(async (c) => {
          if (c.persona) return c;
          try {
            const resMsg = await fetch(`/api/chat/history?chatId=${encodeURIComponent(c.id)}&limit=10&offset=0`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const dataMsg = await resMsg.json();
            // Find the first user message
            const firstUserMsg = (dataMsg.messages || []).find(m => m.role === "user");
            return { ...c, firstUserMessage: firstUserMsg ? firstUserMsg.content : undefined };
          } catch {
            return c;
          }
        })
      );
      // Hide special gallery chat and deleted chat from sidebar
      setChats(chatsWithSummary.filter(c => !c.id.startsWith("gallery_") && c.id !== "deleted"));
    } catch {
      setChats([]);
    }
  };

  const loadHistory = async (existingChatId) => {
    if (!existingChatId) {
      return;
    }

    setIsLoadingHistory(true);
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const response = await fetch(`/api/chat/history?chatId=${encodeURIComponent(existingChatId)}&limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load history");
      }

      if (data?.messages?.length) {
        setMessages(data.messages.map((item) => ({
          role: item.role,
          content: item.content,
          kind: item.kind || "message",
          imageUrl: item.image_url || "",
          id: item.id
        })));
      } else {
        setMessages(starterMessages);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `History load failed: ${error.message}` }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadPersona = async (existingChatId) => {
    if (!existingChatId) {
      return;
    }

    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const response = await fetch(`/api/character?chatId=${encodeURIComponent(existingChatId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();
      if (response.ok && data?.persona) {
        setPersona(data.persona);
      }
    } catch (error) {
      setPersonaStatus("Failed to load persona");
    }
  };


  const handleNewChat = () => {
    setSidebarTab("chats"); // Always switch to chats tab
    setChatId("");
    setMessages(starterMessages);
    setPersona("");
    setPersonaStatus("");
    setOutfit("");
    setOutfitStatus("");
    setOutfitOpen(false);
    localStorage.removeItem("chatId");
    fetchChats(); // <-- ensure sidebar updates
    // Optionally, focus persona input if needed
  };

  // Select a chat from sidebar
  const handleSelectChat = (id) => {
    setChatId(id);
    localStorage.setItem("chatId", id);
    setPersona("");
    setPersonaStatus("");
    setOutfit("");
    setOutfitStatus("");
    setOutfitOpen(false);
    setMessages(starterMessages);
    loadHistory(id);
    loadPersona(id); // <-- ensure persona loads when entering chat from sidebar
  };

  const handleOpenOutfit = async () => {
    setOutfitOpen(true);

    if (!chatId) {
      setOutfit("");
      setOutfitStatus("Start or select a chat first.");
      return;
    }

    setOutfitStatus("Loading outfit...");
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const response = await fetch(`/api/outfit?chatId=${encodeURIComponent(chatId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load outfit");
      }
      setOutfit(data?.outfit || "No outfit set yet.");
      setOutfitStatus("");
    } catch (error) {
      setOutfit("");
      setOutfitStatus(`Load failed: ${error.message}`);
    }
  };

  const handleSavePersona = async () => {
    const trimmedPersona = persona.trim();
    if (!trimmedPersona) {
      setPersonaStatus("Persona is required");
      return;
    }

    setPersonaStatus("Saving persona...");
    try {
      const token = session?.token;
      const response = await fetch("/api/character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ chatId: chatId || undefined, persona: trimmedPersona })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save persona");
      }

      setChatId(data.chatId);
      localStorage.setItem("chatId", data.chatId);
      setPersonaStatus("Persona saved");
      fetchChats(); // <-- update sidebar after saving persona
    } catch (error) {
      setPersonaStatus(`Save failed: ${error.message}`);
    }
  };

  const handleEditLastPrompt = () => {
    // Find last user message
    const lastUserIdx = [...messages].map(m => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    setInput(messages[lastUserIdx].content);
    setEditMode(true);
    setEditIndex(lastUserIdx);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }

    let nextMessages = [...messages];
    // If editing, remove last user+assistant pair
    if (editMode && editIndex !== null) {
      // Remove user message and its following assistant reply
      nextMessages.splice(editIndex, 2);
      setEditMode(false);
      setEditIndex(null);
    }
    nextMessages = [...nextMessages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const token = session?.token;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: trimmed,
          chatId: chatId || undefined,
          persona: persona
        })
      });

      const rawText = await response.text();
      let data;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (parseError) {
        data = null;
      }

      if (!response.ok) {
        const errorMessage = data?.error || rawText || "Request failed";
        throw new Error(errorMessage);
      }

      if (data?.chatId) {
        setChatId(data.chatId);
        localStorage.setItem("chatId", data.chatId);
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data?.reply || "(No reply returned)" }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Error: ${error.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePrompt = async () => {
    // console.log('[App] handleImagePrompt called'); // Debug only
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      // Gather persona, last user prompt, and outfit for image prompt generation
      const lastUserPrompt = (() => {
        const lastUserMsg = messages.slice().reverse().find(m => m.role === "user");
        return lastUserMsg ? lastUserMsg.content : input;
      })();
      // Call image prompt API
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const response = await fetch("/api/chat/image-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          chatId: chatId || undefined,
          persona,
          outfit,
          lastUserPrompt,
          imageApi,
          pollinationsModel
        })
      });

      const rawText = await response.text();
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (parseError) {
        data = null;
      }

      // console.log('[App] /api/chat/image-prompt response:', data); // Debug only

      if (!response.ok) {
        const errorMessage = data?.error || rawText || "Request failed";
        throw new Error(errorMessage);
      }

      if (data?.chatId) {
        setChatId(data.chatId);
        localStorage.setItem("chatId", data.chatId);
      }

      const promptText = data?.prompt || "(No prompt returned)";
      const messageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setMessages((current) => [
        ...current,
        {
          id: messageId,
          role: "assistant",
          content: promptText,
          kind: "image_prompt",
          imageUrl: data?.imageUrl || '',
          imageLoading: promptText !== "(No prompt returned)" && !data?.imageUrl
        }
      ]);
      // If imageUrl is present, immediately set imageLoading to false for this message
      if (data?.imageUrl) {
        setMessages((current) => current.map((msg) =>
          msg.id === messageId ? { ...msg, imageLoading: false } : msg
        ));
      }
      setTimeout(() => {
        // console.log('[App] setMessages imageUrl:', data?.imageUrl); // Debug only
      }, 100);

      // Only send image request if prompt is valid
      // Image generation code removed as requested.
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Error: ${error.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete chat handler
  const handleDeleteChat = async (id) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      await fetch(`/api/chat/delete?chatId=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (chatId === id) {
        setChatId("");
        setMessages(starterMessages);
        setPersona("");
        setPersonaStatus("");
        localStorage.removeItem("chatId");
      }
      fetchChats();
    } catch {
      // Optionally show error
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId, messageIndex, messageKind) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      const session = JSON.parse(localStorage.getItem("session"));
      const token = session?.token;
      const res = await fetch(`/api/chat/message/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ messageId, kind: messageKind })
      });
      if (res.ok) {
        // Remove message from local state
        setMessages(current => current.filter((_, idx) => idx !== messageIndex));
      }
    } catch {
      // Optionally show error
    }
  };

  // Handler to open gallery for a specific character
  const handleOpenCharacterGallery = (characterId) => {
    setCharacterGalleryId(characterId);
    setSidebarTab("images");
  };

  // Clear characterGalleryId when leaving images tab
  useEffect(() => {
    if (sidebarTab !== "images" && characterGalleryId) {
      setCharacterGalleryId(null);
    }
  }, [sidebarTab]);

  return (
    <div className="app">
      {/* Sidebar overlay for mobile */}
      <div className={"sidebar" + (sidebarOpen ? " sidebar-open" : "") } style={{display:'flex',flexDirection:'column',height:'100%'}}>
        <div className="sidebar-header" style={{flexDirection:'column',alignItems:'flex-start',gap:'10px',position:'relative',width:'100%'}}>
          {/* Sidebar close button for mobile */}
          <button
            className="sidebar-close-btn"
            style={{position:'absolute',left:8,top:8,display:'none'}}
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >✕</button>
          <span style={{fontWeight:'bold',fontSize:'1.25rem',color:'#f5c26b',letterSpacing:'0.04em',fontFamily:'Space Grotesk,Arial,sans-serif',marginBottom:'10px'}}>Dreamweaver</span>
          <div className="nav-vertical">
            <button
              className={"nav-item" + (sidebarTab === "chats" ? " active" : "")}
              onClick={() => setSidebarTab("chats")}
              type="button"
            >Chats</button>
            <button
              className={"nav-item" + (sidebarTab === "images" ? " active" : "")}
              onClick={() => setSidebarTab("images")}
              type="button"
            >Images</button>
            <button
              className={"nav-item" + (sidebarTab === "characters" ? " active" : "")}
              onClick={() => setSidebarTab("characters")}
              type="button"
            >Characters</button>
            <button
              className={"nav-item" + (sidebarTab === "settings" ? " active" : "")}
              onClick={() => setSidebarTab("settings")}
              type="button"
            >Settings</button>
            <button
              className="nav-item"
              onClick={handleNewChat}
              type="button"
              style={{marginTop:'10px'}}
            >New</button>
          </div>
        </div>
        <div className="chat-list" style={{flex:1,overflowY:'auto'}}>
          {chats.length === 0 && <div className="chat-list-empty">No chats</div>}
          {chats.map((c) => {
            let chatTitle = c.persona ? c.persona.slice(0, 32) : c.id.slice(0, 8);
            if (!c.persona && c.firstUserMessage) {
              chatTitle = c.firstUserMessage.slice(0, 32);
            }
            return (
              <div
                key={c.id}
                className={`chat-list-item${sidebarTab === "chats" && c.id === chatId ? " active" : ""}`}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}
              >
                <div
                  style={{flex:1,minWidth:0,cursor:'pointer'}}
                  onClick={() => {
                    if (sidebarTab !== "chats") {
                      setSidebarTab("chats");
                    }
                    handleSelectChat(c.id);
                  }}
                >
                  <div className="chat-list-title" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {chatTitle}
                  </div>
                  <div className="chat-list-meta">{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <button
                  className="delete-chat-btn"
                  title="Delete chat"
                  onClick={e => { e.stopPropagation(); handleDeleteChat(c.id); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor"/>
                    <path d="M8 8v10c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V8" stroke="currentColor" strokeWidth="2"/>
                    <rect x="10" y="11" width="1.5" height="6" rx=".75" fill="currentColor"/>
                    <rect x="12.5" y="11" width="1.5" height="6" rx=".75" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        {/* Sidebar footer with username */}
        <div style={{padding:'12px 16px',fontSize:'1em',color:'#f5c26b',background:'#18181a',borderTop:'1px solid #222',textAlign:'left'}}>
          {session?.username && (
            <>Hello, <span style={{fontWeight:'bold'}}>{session.username}</span></>
          )}
        </div>
      </div>
      <div className="main-area">
        {/* Sidebar open button for mobile */}
        <button
          className="sidebar-open-btn"
          style={{position:'absolute',left:10,top:10,zIndex:10,display:'none'}}
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <svg width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="7" width="20" height="2" rx="1" fill="#f5c26b"/><rect x="4" y="13" width="20" height="2" rx="1" fill="#f5c26b"/><rect x="4" y="19" width="20" height="2" rx="1" fill="#f5c26b"/></svg>
        </button>
        {sidebarTab === "chats" ? (
          <main className="card simple-main" style={{display:'flex',flexDirection:'column',height:'100%'}}>
            <div className="character-panel">
              <label className="field">
                <span>Character persona</span>
                <textarea
                  rows={3}
                  value={persona}
                  onChange={(event) => setPersona(event.target.value)}
                  placeholder="Define the bot persona for this chat"
                />
              </label>
              <div className="character-actions">
                <button type="button" onClick={handleSavePersona} className="secondary">
                  Save persona
                </button>
                <button
                  type="button"
                  className="secondary outfit-button"
                  onClick={handleOpenOutfit}
                  title="View current outfit"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 4c.6 1.2 1.8 2 3 2s2.4-.8 3-2l3 2.2V9l-2.2-1.3V20H6V7.7L3.8 9V6.2L7 4h2z" />
                  </svg>
                  Outfit
                </button>
                {personaStatus && <span className="status">{personaStatus}</span>}
              </div>
            </div>
            {outfitOpen && (
              <div className="outfit-overlay" role="dialog" aria-modal="true">
                <div className="outfit-card">
                  <div className="outfit-header">
                    <h3>Current outfit</h3>
                    <button
                      type="button"
                      className="secondary outfit-close"
                      onClick={() => setOutfitOpen(false)}
                      aria-label="Close outfit"
                    >
                      Close
                    </button>
                  </div>
                  {outfitStatus && <div className="status">{outfitStatus}</div>}
                  {!outfitStatus && <p className="outfit-body">{outfit}</p>}
                </div>
              </div>
            )}
            <div className="messages simple-messages" style={{flex:1,overflowY:'auto'}}>
              {isLoadingHistory && (
                <article className="bubble assistant">
                  <span className="role">assistant</span>
                  <p className="typing">Loading history...</p>
                </article>
              )}
              {messages.map((message, index) => {
                const isLastUser = message.role === "user" && index === messages.map(m => m.role).lastIndexOf("user");
                const isLastAssistant = message.role === "assistant" && index === messages.length - 1;
                const isError = message.role === "assistant" && message.content.startsWith("Error:");
                const isImagePrompt = message.kind === "image_prompt";
                const hasMessageId = message.id != null;
                return (
                  <article
                    key={`${message.role}-${index}`}
                    className={`bubble ${message.role}${fadeIndexes.includes(index) ? " fade-out" : ""}`}
                    style={{position:'relative'}}
                  >
                    <span className="role">{message.role}</span>
                    {hasMessageId && (
                      <button
                        className="delete-message-btn"
                        title="Delete message"
                        onClick={() => handleDeleteMessage(message.id, index, message.kind)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor"/>
                          <path d="M8 8v10c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V8" stroke="currentColor" strokeWidth="2"/>
                          <rect x="10" y="11" width="1.5" height="6" rx=".75" fill="currentColor"/>
                          <rect x="12.5" y="11" width="1.5" height="6" rx=".75" fill="currentColor"/>
                        </svg>
                      </button>
                    )}
                    {/* If editing, show textarea and Update button in bubble */}
                    {editMode && isLastUser ? (
                      <>
                        <textarea
                          rows={2}
                          value={input}
                          onChange={(event) => handleInputChange(event, editInputRef.current)}
                          placeholder="Edit your message..."
                          style={{width:'100%',marginBottom:8}}
                          ref={editInputRef}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (input.trim() && !isLoading) handleSend(e);
                            }
                          }}
                        />
                        <button className="secondary" style={{marginTop:4}} onClick={handleSend}>Update</button>
                      </>
                    ) : (
                      <>
                        {isImagePrompt && !isError && (
                          <div className="message-pretext">
                            <span className="message-tag">Image prompt</span>
                          </div>
                        )}
                        {!editMode && renderMessageContent(message.content)}
                        {message.imageUrl && (
                          <>
                            <div style={{fontSize:12, color:'#aaa'}}>Image URL: {message.imageUrl}</div>
                            <img
                              className="image-preview image-thumb"
                              src={message.imageUrl}
                              alt="Generated"
                              loading="lazy"
                              style={{maxWidth:80,maxHeight:80,cursor:'pointer',borderRadius:6,boxShadow:'0 1px 4px #0003'}}
                              onClick={() => setMediaViewer({ open: true, url: message.imageUrl })}
                            />
                          </>
                        )}
                        {message.imageLoading && (
                          <div className="image-loading" aria-live="polite">
                            <div className="image-loading-bar" />
                            <span>Generating image...</span>
                          </div>
                        )}
                        {message.imageError && (
                          <div className="image-error">{message.imageError}</div>
                        )}
                        {isLastUser && !isLoading && !editMode && (
                          <button className="secondary" style={{marginTop:8}} onClick={handleEditLastPrompt}>Edit</button>
                        )}
                        {/* Retry icon for last assistant message (always visible for demo) */}
                        {isLastAssistant && !isLoading && (
                          <div className="bubble-actions">
                            <button
                              className="secondary image-btn"
                              title="Create image prompt"
                              onClick={handleImagePrompt}
                            >IMG</button>
                            <button
                              className="secondary retry-btn"
                              title="Retry"
                              onClick={() => {
                              // Find last user message
                              const lastUserIdx = messages.map(m => m.role).lastIndexOf("user");
                              const lastAssistantIdx = messages.map(m => m.role).lastIndexOf("assistant");
                              if (lastAssistantIdx !== -1 && lastAssistantIdx > lastUserIdx) {
                                // Fade out only the last assistant message
                                setFadeIndexes([lastAssistantIdx]);
                                setTimeout(() => {
                                  const newMessages = [...messages];
                                  newMessages.splice(lastAssistantIdx, 1);
                                  setMessages(newMessages);
                                  setFadeIndexes([]);
                                  setInput("");
                                  setEditMode(false);
                                  setEditIndex(null);
                                  // Resend last user prompt
                                  setIsLoading(true);
                                  (async () => {
                                    try {
                                      const session = JSON.parse(localStorage.getItem("session"));
                                      const token = session?.token;
                                      const response = await fetch("/api/chat", {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          ...(token ? { Authorization: `Bearer ${token}` } : {})
                                        },
                                        body: JSON.stringify({
                                          message: messages[lastUserIdx].content,
                                          chatId: chatId || undefined
                                        })
                                      });
                                      const rawText = await response.text();
                                      let data;
                                      try {
                                        data = rawText ? JSON.parse(rawText) : null;
                                      } catch (parseError) {
                                        data = null;
                                      }
                                      if (!response.ok) {
                                        const errorMessage = data?.error || rawText || "Request failed";
                                        throw new Error(errorMessage);
                                      }
                                      if (data?.chatId) {
                                        setChatId(data.chatId);
                                        localStorage.setItem("chatId", data.chatId);
                                      }
                                      setMessages((current) => [
                                        ...current,
                                        { role: "assistant", content: data?.reply || "(No reply returned)" }
                                      ]);
                                    } catch (error) {
                                      setMessages((current) => [
                                        ...current,
                                        {
                                          role: "assistant",
                                          content: `Error: ${error.message}`
                                        }
                                      ]);
                                    } finally {
                                      setIsLoading(false);
                                    }
                                  })();
                                }, 350); // match fade duration
                              }
                            }}
                            >&#8635;</button>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
              {isLoading && (
                <article className="bubble assistant">
                  <span className="role">assistant</span>
                  <p className="typing">Thinking...</p>
                </article>
              )}
              <div ref={endRef} />
            </div>

            <form className="composer" onSubmit={handleSend}>
              <label className="field">
                <span>Your message</span>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(event) => handleInputChange(event, inputRef.current)}
                  placeholder="Type a message..."
                  ref={inputRef}
                  onKeyDown={(e) => {
                    if (isMobile) {
                      // On mobile: Enter inserts newline, Ctrl+Enter sends
                      if (e.key === "Enter" && e.ctrlKey) {
                        e.preventDefault();
                        if (input.trim() && !isLoading) handleSend(e);
                      }
                    } else {
                      // On desktop: Enter sends, Shift+Enter inserts newline
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() && !isLoading) handleSend(e);
                      }
                    }
                  }}
                />
              </label>
              <button type="submit" disabled={!input.trim() || isLoading}>
                {isMobile ? (isLoading ? "Sending..." : "Send (Ctrl+Enter)") : (isLoading ? "Sending..." : "Send")}
              </button>
            </form>
          </main>
        ) : sidebarTab === "images" ? (
          !session ? (
            <Login onLogin={handleLogin} />
          ) : (
            <main className="card simple-main" style={{display:'flex',flexDirection:'column',height:'100%'}}>
              <ImagesSection
                chatId={chatId}
                characterId={characterGalleryId}
                pollinationsModel={pollinationsModel}
                setPollinationsModel={setPollinationsModel}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
              />
            </main>
          )
        ) : sidebarTab === "characters" ? (
          <main className="card simple-main" style={{display:'flex',flexDirection:'column',height:'100%'}}>
            <CharactersSection
              onUsePersona={async (personaText, characterIdFromPersona, actionType, chatIdToJump) => {
                setSidebarTab("chats");
                setMessages(starterMessages);
                setOutfit("");
                setOutfitStatus("");
                setOutfitOpen(false);
                if (actionType === "use") {
                  // Create new chat linked to existing character and save persona
                  try {
                    const session = JSON.parse(localStorage.getItem("session"));
                    const token = session?.token;
                    const res = await fetch("/api/character", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify({ characterId: characterIdFromPersona, persona: personaText, actionType: "use" })
                    });
                    const data = await res.json();
                    if (res.ok && data?.chatId) {
                      setChatId(data.chatId);
                      localStorage.setItem("chatId", data.chatId);
                      setPersona(personaText);
                      await loadHistory(data.chatId);
                      await loadPersona(data.chatId);
                      await fetchChats(); // <-- update sidebar immediately
                    }
                  } catch {}
                } else if (actionType === "jump" && chatIdToJump) {
                  setChatId(chatIdToJump);
                  localStorage.setItem("chatId", chatIdToJump);
                  await loadHistory(chatIdToJump);
                  await loadPersona(chatIdToJump);
                  await fetchChats(); // <-- update sidebar immediately
                }
              }}
              onOpenGallery={handleOpenCharacterGallery}
            />
          </main>
        ) : sidebarTab === "settings" ? (
          <SettingsSection
            imageApi={imageApi}
            setImageApi={setImageApi}
            pollinationsModel={pollinationsModel}
            setPollinationsModel={setPollinationsModel}
            session={session}
            setSession={setSession}
            onLogout={handleLogout}
          />
        ) : null}
      </div>
      {mediaViewer.open && (
        <div className="media-viewer-overlay" onClick={() => setMediaViewer({ open: false, url: "" })}>
          <div className="media-viewer-modal" onClick={e => e.stopPropagation()}>
            <img src={mediaViewer.url} alt="Enlarged" style={{maxWidth:'90vw',maxHeight:'90vh',borderRadius:12,boxShadow:'0 4px 32px #000b'}} />
            <button className="media-viewer-close" onClick={() => setMediaViewer({ open: false, url: "" })}>&times;</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
