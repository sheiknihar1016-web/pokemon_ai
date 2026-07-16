import { useState, useEffect, useRef } from 'react';
import {
  Mic, Send, X, Bell, Menu, Pause,
  ChevronDown, Paperclip, Sparkles, AlertCircle,
  Users, MessageSquare, Brain, Target, BookOpen
} from 'lucide-react';
import './App.css';

/* ============================================================
   CONFIG
   ============================================================ */
const API_KEY = import.meta.env.VITE_API_KEY || "";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL   = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

const SYSTEM_PROMPT = `You are Aria, an expert AI Communication Coach helping students improve their English communication skills. Your role is to:
1. Help students practice public speaking, presentations, debates, and everyday conversations.
2. Give concise, encouraging, constructive feedback on grammar, pronunciation, clarity, confidence, and delivery.
3. Conduct mock interviews and guide students through answering well.
4. Suggest improvements with specific examples.
5. Always stay warm, motivating, and student-friendly.
6. Keep responses under 200 words unless asked for detail.
7. If asked who made you, say: "I was created by SpeakUp AI to help students like you!"
When a student shares speech or an answer: acknowledge what they did well first, give 2-3 improvement tips, offer to practice again.`;

/* ============================================================
   SUGGESTION CARDS — communication practice
   ============================================================ */
const SUGGESTIONS = [
  {
    text: "I want to practice a 2-minute self-introduction speech for my interview.",
    label: "Self-introduction practice"
  },
  {
    text: "Help me practice answering: 'What are your greatest strengths and weaknesses?'",
    label: "Mock interview prep"
  },
  {
    text: "I want to improve my pronunciation and accent for professional settings.",
    label: "Pronunciation coaching"
  },
  {
    text: "Give me a debate topic and let me practice arguing both sides.",
    label: "Debate practice"
  },
  {
    text: "Help me structure a 5-minute class presentation on climate change.",
    label: "Presentation skills"
  },
];

const MODES = ['Coaching Mode', 'Interview Mode', 'Debate Mode', 'Presentation Mode'];

/* ============================================================
   MARKDOWN PARSER
   ============================================================ */
function parseMd(text) {
  if (!text) return [];
  return text
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .filter(l => l.trim())
    .map((line, idx) => {
      let parts = [line];

      // Bold
      parts = parts.flatMap(p => {
        if (typeof p !== 'string') return [p];
        return p.split(/\*\*([\s\S]*?)\*\*/g).map((s, i) =>
          i % 2 === 1 ? <span key={`b${idx}${i}`} className="md-b">{s}</span> : s
        );
      });
      // Italic
      parts = parts.flatMap(p => {
        if (typeof p !== 'string') return [p];
        return p.split(/\*([^*]+)\*/g).map((s, i) =>
          i % 2 === 1 ? <span key={`i${idx}${i}`} className="md-i">{s}</span> : s
        );
      });
      // Inline code
      parts = parts.flatMap(p => {
        if (typeof p !== 'string') return [p];
        return p.split(/`([^`]+)`/g).map((s, i) =>
          i % 2 === 1 ? <code key={`c${idx}${i}`} className="md-c">{s}</code> : s
        );
      });

      return <p key={idx} className="md-p">{parts}</p>;
    });
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [view, setView]           = useState('welcome');   // welcome | listening | chat
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [modeIdx, setModeIdx]     = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const feedEnd  = useRef(null);
  const recRef   = useRef(null);
  const inputRef = useRef(null);
  const autoModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const transcriptRef = useRef('');

  /* Send message ref to avoid stale closures in SpeechRec */
  const sendMsgRef = useRef(null);

  /* Text to Speech */
  const speakText = (text) => {
    if (!window.speechSynthesis) {
      if (autoModeRef.current) { setTimeout(() => { try { recRef.current?.start(); } catch(e){} }, 500); }
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    
    utterance.onstart = () => { setIsSpeaking(true); isSpeakingRef.current = true; };
    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (autoModeRef.current) {
        setTimeout(() => { try { recRef.current?.start(); } catch(e){} }, 300);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (autoModeRef.current) {
        setTimeout(() => { try { recRef.current?.start(); } catch(e){} }, 300);
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  /* Auto-scroll */
  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, transcript, view]);

  /* Speech Recognition */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous     = false; // False so it stops when user pauses, triggering onend
    rec.interimResults = true;
    rec.lang           = 'en-US';
    rec.onstart  = () => { setListening(true); setTranscript(''); transcriptRef.current = ''; setView('listening'); };
    rec.onresult = e  => { 
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text); 
      transcriptRef.current = text;
    };
    rec.onerror  = e  => {
      if (e.error === 'no-speech') return; // Ignore silence timeouts
      setListening(false);
      if (e.error !== 'aborted') {
        setError(`Voice error: ${e.error}. Allow microphone access.`);
        setView('welcome');
        autoModeRef.current = false;
      }
    };
    rec.onend = () => {
      setListening(false);
      if (autoModeRef.current && transcriptRef.current.trim()) {
        if (sendMsgRef.current) sendMsgRef.current(transcriptRef.current);
      } else if (autoModeRef.current && !isSpeakingRef.current) {
        try { rec.start(); } catch(err){}
      }
    };
    recRef.current = rec;
    
    return () => {
      rec.stop();
    };
  }, []);

  /* Update sendMsgRef */
  useEffect(() => {
    sendMsgRef.current = sendMsg;
  });

  /* Send message */
  const sendMsg = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    setView('chat');
    setError(null);

    const userMsg = { role: 'user', content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...updated.map(m => ({ role: m.role, content: m.content }))
          ],
          temperature: 0.75,
          max_tokens: 600
        })
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'I had trouble responding. Please try again!';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
      if (autoModeRef.current) {
        speakText(reply);
      }
    } catch (err) {
      setError(err.message || 'Connection error. Check your internet.');
    } finally {
      setLoading(false);
    }
  };

  /* Mic toggle */
  const toggleMic = () => {
    if (!recRef.current) { setError('Speech recognition not supported.'); return; }
    if (autoModeRef.current || listening) {
      // Turn OFF Alexa mode
      autoModeRef.current = false;
      recRef.current.stop();
      window.speechSynthesis?.cancel();
      setListening(false);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (transcriptRef.current.trim()) sendMsg(transcriptRef.current);
      else setView(messages.length > 0 ? 'chat' : 'welcome');
    } else {
      // Turn ON Alexa mode
      autoModeRef.current = true;
      try { recRef.current.start(); } catch (e) { console.warn(e); }
    }
  };

  /* Close/reset */
  const closeChat = () => {
    autoModeRef.current = false;
    window.speechSynthesis?.cancel();
    setMessages([]); setError(null); setView('welcome'); setTranscript('');
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className={`app-container view-${view}`}>
      <div className="workspace-shell">

        {/* ── HEADER ── */}
        <header className="main-header">
          {view !== 'welcome' ? (
            /* Close chat pill — centered */
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <button id="close-chat-btn" className="close-pill" onClick={closeChat}>
                <X size={11} />
                Close chat
              </button>
            </div>
          ) : (
            /* Welcome header */
            <>
              <div className="header-left">
                <div className="app-logo" />
                <div className="header-info">
                  <span className="header-brand">SpeakUp AI,</span>
                  <span className="header-sub">Welcome back</span>
                </div>
              </div>
              <div className="header-right">
                <button id="notif-btn" className="icon-btn" aria-label="Notifications">
                  <Bell size={14} />
                </button>
                <button id="menu-btn" className="icon-btn" aria-label="Menu">
                  <Menu size={14} />
                </button>
              </div>
            </>
          )}
        </header>

        {/* ── FEED ── */}
        <div className="chat-feed">
          <div className="feed-content">

            {/* SCREEN 1: Welcome */}
            {view === 'welcome' && (
              <div>
                <h1 className="hero-title">
                  What would you<br />like to practice<br />today?
                </h1>

                {/* Suggestion cards */}
                <div className="suggestion-scroller">
                  {SUGGESTIONS.map((s, i) => (
                    <div
                      key={i}
                      id={`card-${i}`}
                      className="suggestion-card"
                      onClick={() => sendMsg(s.text)}
                    >
                      {/* ✦ sparkle icon — exact from UI */}
                      <span className="card-sparkle">✦</span>
                      <span className="card-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCREEN 2: Listening */}
            {view === 'listening' && (
              <div className="listening-wrap">
                <div className="orb" />
                <div className="orb-label">Aria is listening...</div>
                <div className="transcript-text">
                  {transcript || '...'}
                </div>
              </div>
            )}

            {/* SCREEN 3: Chat */}
            {view === 'chat' && messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isLast = i === messages.length - 1;
              return (
                <div key={i} style={{ width: '100%' }}>
                  <div className={`msg-row ${isUser ? 'user-row' : 'bot-row'}`}>
                    {!isUser && <div className="bot-avatar" />}
                    <div className="bubble">
                      {isUser ? msg.content : parseMd(msg.content)}
                    </div>
                  </div>
                  {/* Practice again chip after last bot message */}
                  {!isUser && isLast && !loading && (
                    <button
                      id="practice-again-btn"
                      className="chip-btn"
                      onClick={() => sendMsg('Let me try that again with a better response.')}
                    >
                      🔄 Practice again
                    </button>
                  )}
                </div>
              );
            })}

            {/* Loading animation */}
            {loading && (
              <div className="msg-row bot-row">
                <div className="bot-avatar" />
                <div className="bubble" style={{ padding: '0.55rem 0.85rem' }}>
                  <div className="dots"><span /><span /><span /></div>
                </div>
              </div>
            )}

            {loading && <div className="working-text">Aria is working...</div>}
            {isSpeaking && <div className="working-text">Aria is speaking...</div>}

            {error && (
              <div className="err-msg">
                <AlertCircle size={14} />{error}
              </div>
            )}

            <div ref={feedEnd} />
          </div>
        </div>

        {/* ── BOTTOM BAR ── */}
        <div className="bottom-bar">
          <div className="bottom-inner">

            {/* Screen 1 controls */}
            {view === 'welcome' && (
              <>
                <div 
                  className="welcome-prompt" 
                  style={{ cursor: 'text' }}
                  onClick={() => { setView('chat'); setTimeout(() => inputRef.current?.focus(), 100); }}
                >
                  Ask AI a question or describe your idea
                </div>
                <div className="ctrl-row">
                  <div className="ctrl-left">
                    <button id="attach-btn" className="icon-btn" style={{ width: 34, height: 34 }}>
                      <Paperclip size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
                    </button>
                    <button
                      id="mode-pill"
                      className="mode-pill"
                      onClick={() => setModeIdx(i => (i + 1) % MODES.length)}
                    >
                      {MODES[modeIdx]}
                      <ChevronDown size={9} style={{ opacity: 0.5 }} />
                    </button>
                  </div>
                  <button
                    id="mic-btn-welcome"
                    className={`mic-btn${listening ? ' active' : ''}`}
                    onClick={toggleMic}
                    aria-label="Start speaking"
                  >
                    <Mic size={19} />
                  </button>
                </div>
              </>
            )}

            {/* Screen 2: voice controls */}
            {view === 'listening' && (
              <div className="voice-row">
                <button
                  id="voice-pause-btn"
                  className="ghost-btn"
                  onClick={() => {
                    autoModeRef.current = false;
                    recRef.current?.stop();
                    window.speechSynthesis?.cancel();
                    setView(messages.length > 0 ? 'chat' : 'welcome');
                  }}
                  aria-label="Pause"
                >
                  <Pause size={16} />
                </button>
                <button
                  id="voice-mic-btn"
                  className="ghost-btn big-mic"
                  onClick={toggleMic}
                  aria-label="Stop recording"
                >
                  <Mic size={20} />
                </button>
                <button
                  id="voice-send-btn"
                  className="ghost-btn"
                  onClick={toggleMic}
                  aria-label="Send"
                >
                  <Send size={15} />
                </button>
              </div>
            )}

            {/* Screen 3: text input */}
            {view === 'chat' && (
              <form
                id="chat-form"
                onSubmit={e => { e.preventDefault(); sendMsg(); }}
                className="pill-input"
              >
                <button type="button" id="chat-attach" className="pill-icon">
                  <Paperclip size={15} />
                </button>
                <input
                  id="chat-input"
                  ref={inputRef}
                  type="text"
                  placeholder="Ask AI a question"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  id="chat-mic"
                  className="pill-icon"
                  onClick={toggleMic}
                  aria-label="Voice input"
                >
                  <Mic size={15} />
                </button>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
