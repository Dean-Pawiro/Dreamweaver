import { useEffect, useRef, useState } from "react";
import "./App.css";

const starterMessages = [
  {
    role: "assistant",
    content: "Ask me anything. I will answer using the Hugging Face model you configure."
  }
];

const OPEN_QUOTES = ["\"", "\u201c"];
const CLOSE_QUOTES = {
  "\"": "\"",
  "\u201c": "\u201d"
};

function parseMessageSegments(text) {
  if (!text) {
    return [];
  }

  const segments = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        const content = text.slice(i + 1, end).trim();
        if (content) {
          segments.push({ type: "action", content });
        }
        i = end + 1;
        continue;
      }
    }

    if (OPEN_QUOTES.includes(char)) {
      const closeChar = CLOSE_QUOTES[char] || "\"";
      let end = i + 1;

      while (end < text.length) {
        if (text[end] === closeChar && text[end - 1] !== "\\") {
          break;
        }
        end += 1;
      }

      if (end < text.length) {
        const content = text.slice(i + 1, end).trim();
        if (content) {
          segments.push({ type: "dialogue", content });
        }
        i = end + 1;
        continue;
      }
    }

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
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [chatId, setChatId] = useState("");
  const [persona, setPersona] = useState("");
  const [personaStatus, setPersonaStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [chats, setChats] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const resizeTextarea = (element) => {
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTextarea(inputRef.current);
  }, [input]);

  useEffect(() => {
    if (editMode) {
      resizeTextarea(editInputRef.current);
    }
  }, [editMode, input]);

  const handleInputChange = (event, target) => {
    setInput(event.target.value);
    resizeTextarea(target || event.target);
  };


  // Load chat list and last chat on mount
  useEffect(() => {
    fetchChats();
    const storedChatId = localStorage.getItem("chatId");
    if (storedChatId) {
      setChatId(storedChatId);
      void loadHistory(storedChatId);
      void loadPersona(storedChatId);
    }
  }, []);

  // Fetch all chats
  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      setChats(data.chats || []);
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
      const response = await fetch(`/api/chat/history?chatId=${encodeURIComponent(existingChatId)}&limit=200`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load history");
      }

      if (data?.messages?.length) {
        setMessages(data.messages.map((item) => ({
          role: item.role,
          content: item.content,
          kind: item.kind || "message",
          imageUrl: item.image_url || ""
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
      const response = await fetch(`/api/character?chatId=${encodeURIComponent(existingChatId)}`);
      const data = await response.json();
      if (response.ok && data?.persona) {
        setPersona(data.persona);
      }
    } catch (error) {
      setPersonaStatus("Failed to load persona");
    }
  };


  const handleNewChat = () => {
    setChatId("");
    setMessages(starterMessages);
    setPersona("");
    setPersonaStatus("");
    setOutfit("");
    setOutfitStatus("");
    setOutfitOpen(false);
    localStorage.removeItem("chatId");
    fetchChats();
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
    loadPersona(id);
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
      const response = await fetch(`/api/outfit?chatId=${encodeURIComponent(chatId)}`);
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
      const response = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId || undefined, persona: trimmedPersona })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save persona");
      }

      setChatId(data.chatId);
      localStorage.setItem("chatId", data.chatId);
      setPersonaStatus("Persona saved");
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          model: model.trim() || undefined,
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
  };

  const handleImagePrompt = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId || undefined,
          model: model.trim() || undefined,
          style: imagePromptStyle
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

      const promptText = data?.prompt || "(No prompt returned)";
      const resolvedChatId = data?.chatId || chatId;
      const messageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setMessages((current) => [
        ...current,
        {
          id: messageId,
          role: "assistant",
          content: promptText,
          kind: "image_prompt",
          imageLoading: true
        }
      ]);

      if (resolvedChatId) {
        try {
          const imageResponse = await fetch("/api/images/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptText,
              chatId: resolvedChatId
            })
          });

          const imageRaw = await imageResponse.text();
          let imageData;

          try {
            imageData = imageRaw ? JSON.parse(imageRaw) : null;
          } catch (parseError) {
            imageData = null;
          }

          if (!imageResponse.ok) {
            const errorMessage = imageData?.error || imageRaw || "Image request failed";
            throw new Error(errorMessage);
          }

          setMessages((current) => current.map((message) => (
            message.id === messageId
              ? { ...message, imageUrl: imageData?.imageUrl || "", imageLoading: false }
              : message
          )));
        } catch (error) {
          setMessages((current) => current.map((message) => (
            message.id === messageId
              ? { ...message, imageLoading: false, imageError: `Image failed: ${error.message}` }
              : message
          )));
        }
      } else {
        setMessages((current) => current.map((message) => (
          message.id === messageId
            ? { ...message, imageLoading: false, imageError: "Image failed: missing chat id" }
            : message
        )));
      }
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
      await fetch(`/api/chat/delete?chatId=${encodeURIComponent(id)}`, { method: "POST" });
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

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Chats</h2>
          <button className="secondary" onClick={handleNewChat}>New</button>
        </div>
        <div className="chat-list">
          {chats.length === 0 && <div className="chat-list-empty">No chats</div>}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`chat-list-item${c.id === chatId ? " active" : ""}`}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}
            >
              <div
                style={{flex:1,minWidth:0,cursor:'pointer'}}
                onClick={() => handleSelectChat(c.id)}
              >
                <div className="chat-list-title" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {c.persona ? c.persona.slice(0, 32) : c.id.slice(0, 8)}
                </div>
                <div className="chat-list-meta">{new Date(c.created_at).toLocaleString()}</div>
              </div>
              <button
                className="delete-chat-btn"
                title="Delete chat"
                onClick={e => { e.stopPropagation(); handleDeleteChat(c.id); }}
                style={{padding:'4px 8px',border:'none',background:'none',color:'#f5c26b',cursor:'pointer',fontSize:'1.2em'}}
              >
                &#128465;
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="main-area">
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
              return (
                <article
                  key={`${message.role}-${index}`}
                  className={`bubble ${message.role}${fadeIndexes.includes(index) ? " fade-out" : ""}`}
                >
                  <span className="role">{message.role}</span>
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
                          <span className="message-pretext-text">{imagePromptStyle}</span>
                        </div>
                      )}
                      {!editMode && renderMessageContent(message.content)}
                      {message.imageUrl && (
                        <img
                          className="image-preview"
                          src={message.imageUrl}
                          alt="Generated"
                          loading="lazy"
                        />
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
                                    const response = await fetch("/api/chat", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        message: messages[lastUserIdx].content,
                                        model: model.trim() || undefined,
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
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) handleSend(e);
                  }
                }}
              />
            </label>
            <button type="submit" disabled={!input.trim() || isLoading}>
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
