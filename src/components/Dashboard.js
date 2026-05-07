import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import {
  auth, db, signOut, onAuthStateChanged,
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from '../firebase';

const AZURE_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY || 'BN3TJVa9xVG9cyY8QSWKLVbik6q4figqJGK6Ixh0GnuzH32XAnKzJQQJ99CEACBsN54XJ3w3AAAYACOGgz17';
const AZURE_REGION = 'canadacentral';

const IconMic    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6.5 10.5A6.5 6.5 0 0 1 5.5 11.5H4a8 8 0 0 0 7 7.93V22h2v-2.57A8 8 0 0 0 20 11.5h-1.5z"/></svg>;
const IconStop   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
const IconHome   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const IconNotes  = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 13h8v1.5H8V13zm0 3h5v1.5H8V16zm0-6h3v1.5H8V10z"/></svg>;
const IconUser   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>;
const IconEdit   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSave   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>;
const IconShare  = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 16a3 3 0 0 0-2.04.8L8.91 12.7A3.07 3.07 0 0 0 9 12a3.07 3.07 0 0 0-.09-.7l7.05-4.1A3 3 0 1 0 15 5a3.07 3.07 0 0 0 .09.7L8.04 9.8A3 3 0 1 0 8 15a3.07 3.07 0 0 0 .91-.1L15.96 19a3 3 0 1 0 2.04-3z"/></svg>;
const IconDelete = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>;

const T = {
  bg:       '#16191f',
  surface:  '#1e2230',
  surface2: '#252a38',
  border:   '#2a3045',
  text:     '#e8eaf0',
  textMid:  '#8b92a8',
  textDim:  '#4a5168',
  accent:   '#3b82f6',
  accentCy: '#06b6d4',
  danger:   '#ef4444',
  success:  '#10b981',
  warn:     '#f59e0b',
  purple:   '#6366f1',
};

function smartTitle(content) {
  if (!content) return 'Not';
  const words = content.trim().split(/\s+/).slice(0, 5).join(' ');
  return words.length < content.trim().length ? words + '…' : words;
}

function nowStamp(lang) {
  const now = new Date();
  return now.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function Dashboard() {
  const [user, setUser]                         = useState(null);
  const [notes, setNotes]                       = useState([]);
  const [categories, setCategories]             = useState([]);
  const [selectedNote, setSelectedNote]         = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRecording, setIsRecording]           = useState(false);
  const [language, setLanguage]                 = useState(() => navigator.language?.startsWith('tr') ? 'tr' : 'en');
  const [transcript, setTranscript]             = useState('');
  const [interimText, setInterimText]           = useState('');
  const [timeLeft, setTimeLeft]                 = useState(180);
  const [warning, setWarning]                   = useState(false);
  const [status, setStatus]                     = useState('');
  const [activeTab, setActiveTab]               = useState('home');
  const [keyboardHeight, setKeyboardHeight]     = useState(0);

  const recognizerRef  = useRef(null);
  const timerRef       = useRef(null);
  const isRecordingRef = useRef(false);
  const transcriptRef  = useRef('');
  const textareaRef    = useRef(null); // for auto-scroll
  const navigate       = useNavigate();

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Auto-scroll textarea to bottom when transcript or interimText changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { navigate('/login'); return; }
      setUser(u);
      loadCategories(u.uid);
      loadNotes(u.uid, 'all');
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardHeight(diff > 80 ? diff : 0);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => { vv.removeEventListener('resize', handler); vv.removeEventListener('scroll', handler); };
  }, []);

  async function loadCategories(uid) {
    const q = query(collection(db, 'categories'), where('userId', '==', uid));
    const snap = await getDocs(q);
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadNotes(uid, categoryId) {
    let q;
    if (categoryId === 'all') {
      q = query(collection(db, 'notes'), where('userId', '==', uid), orderBy('updatedAt', 'desc'));
    } else {
      q = query(collection(db, 'notes'), where('userId', '==', uid), where('categoryId', '==', categoryId), orderBy('updatedAt', 'desc'));
    }
    const snap = await getDocs(q);
    setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleLogout() {
    await signOut(auth);
    navigate('/');
  }

  // ── SPEAK BUTTON — DO NOT TOUCH ─────────────────────────────
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setInterimText('');
    setWarning(false);
    setStatus('');
    setTimeLeft(180);
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => { recognizerRef.current?.close(); recognizerRef.current = null; },
        err => { console.error(err); recognizerRef.current = null; }
      );
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!AZURE_KEY) { setStatus('⚠️ Azure key bulunamadı'); return; }

    if (transcriptRef.current.trim()) {
      const msg = language === 'tr'
        ? 'Kaydedilmemiş bir notunuz var. Yine de yeni kayda başlayacak mısınız?'
        : 'You have an unsaved note. Start a new recording anyway?';
      if (!window.confirm(msg)) return;
    }

    const lang         = language === 'tr' ? 'tr-TR' : 'en-US';
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
    speechConfig.speechRecognitionLanguage = lang;
    const audioConfig  = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer   = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    setTranscript('');
    transcriptRef.current = '';
    setInterimText('');
    setTimeLeft(180);
    setWarning(false);
    setStatus(language === 'tr' ? '🎙️ Dinleniyor...' : '🎙️ Listening...');
    setIsRecording(true);
    isRecordingRef.current = true;

    recognizer.recognizing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
        setInterimText(e.result.text);
      }
    };

    recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = e.result.text;
        setInterimText('');
        setTranscript(prev => {
          const next = prev ? prev + ' ' + text : text;
          transcriptRef.current = next;
          return next;
        });
      }
    };

    recognizer.startContinuousRecognitionAsync(
      () => {},
      err => { setStatus('⚠️ ' + err); setIsRecording(false); isRecordingRef.current = false; }
    );

    let seconds = 180;
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setTimeLeft(seconds);
      if (seconds <= 30) setWarning(true);
      if (seconds <= 0 && isRecordingRef.current) stopRecording();
    }, 1000);
  }, [language, stopRecording]);
  // ── END SPEAK BUTTON ─────────────────────────────────────────

  const formatTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  async function saveNote() {
    if (!selectedNote) return;
    await updateDoc(doc(db, 'notes', selectedNote.id), {
      title: selectedNote.title, content: selectedNote.content, updatedAt: serverTimestamp(),
    });
    loadNotes(user.uid, selectedCategory);
  }

  async function deleteNote() {
    if (!selectedNote || !window.confirm(language === 'tr' ? 'Notu sil?' : 'Delete note?')) return;
    await deleteDoc(doc(db, 'notes', selectedNote.id));
    setSelectedNote(null);
    loadNotes(user.uid, selectedCategory);
  }

  async function createNote() {
    if (!transcript) return;
    const title   = smartTitle(transcript);
    const stamp   = nowStamp(language);
    const content = `[${stamp}]\n${transcript}`;
    const ref = await addDoc(collection(db, 'notes'), {
      title, content,
      userId: user.uid,
      categoryId: selectedCategory === 'all' ? '' : selectedCategory,
      categoryName: selectedCategory === 'all' ? '' : categories.find(c => c.id === selectedCategory)?.name || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    loadNotes(user.uid, selectedCategory);
    setSelectedNote({ id: ref.id, title, content });
    setTranscript('');
    transcriptRef.current = '';
    setActiveTab('notes');
  }

  async function createBlankNote() {
    const title   = language === 'tr' ? 'Yeni Not' : 'New Note';
    const content = '';
    const ref = await addDoc(collection(db, 'notes'), {
      title, content,
      userId: user.uid,
      categoryId: '',
      categoryName: '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await loadNotes(user.uid, selectedCategory);
    setSelectedNote({ id: ref.id, title, content });
  }

  const shareText = () => {
    const text = transcript || selectedNote?.content || '';
    if (navigator.share) navigator.share({ text });
    else navigator.clipboard.writeText(text);
  };

  const editWithChatGPT = async () => {
    const text = transcript || selectedNote?.content || '';
    if (!text) return;
    setStatus('⏳ ' + (language === 'tr' ? 'Düzenleniyor...' : 'Editing...'));
    try {
      const res  = await fetch('https://iturut-app.onrender.com/chatgpt/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: 'grammar' }),
      });
      const data = await res.json();
      if (data.result) {
        setTranscript(data.result);
        transcriptRef.current = data.result;
        if (selectedNote) setSelectedNote(prev => ({ ...prev, content: data.result }));
      }
    } catch { setStatus('⚠️ Error'); }
    finally  { setStatus(''); }
  };

  if (!user) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100dvh', background: T.bg }}>
      <div style={{ color: T.textMid, fontSize:'1rem' }}>Loading…</div>
    </div>
  );

  const displayText = transcript + (interimText ? (transcript ? ' ' : '') + interimText : '');

  return (
    <div style={s.app}>
      <header style={s.header}>
        <span style={s.headerTitle}>iTurut</span>
      </header>

      <main style={s.main}>

        {/* ── HOME TAB ── */}
        {activeTab === 'home' && (
          <div style={s.tabContent}>
            <div style={s.speakWrapper}>
              {isRecording && <div style={s.ripple1}/>}
              {isRecording && <div style={s.ripple2}/>}
              {/* ── SPEAK BUTTON — DO NOT MODIFY ── */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isRecordingRef.current) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                style={isRecording ? s.stopBtn : s.speakBtn}
              >
                {isRecording ? <IconStop /> : <IconMic />}
                <span style={s.speakLabel}>
                  {isRecording ? (language === 'tr' ? 'DURDUR' : 'STOP') : (language === 'tr' ? 'KONUŞ' : 'SPEAK')}
                </span>
              </button>
            </div>

            {isRecording && (
              <div style={s.timerRow}>
                <span style={{ ...s.timer, color: warning ? T.danger : T.text }}>{formatTime(timeLeft)}</span>
                {warning && <span style={s.warningBadge}>{language === 'tr' ? 'Az kaldı!' : 'Almost done!'}</span>}
              </div>
            )}

            {status && <p style={s.statusText}>{status}</p>}

            {/* textarea with ref for auto-scroll */}
            <textarea
              ref={textareaRef}
              value={displayText}
              onChange={e => {
                setTranscript(e.target.value);
                transcriptRef.current = e.target.value;
              }}
              placeholder={language === 'tr' ? 'Konuşmak için butona bas…' : 'Tap the button to speak…'}
              style={{
                ...s.transcriptBox,
                color: interimText && !transcript ? T.textMid : T.text,
              }}
            />

            <div style={s.actionBar}>
              <button onClick={editWithChatGPT} disabled={!transcript} style={s.actionBtn(T.purple, !transcript)}>
                <IconEdit /><span>{language === 'tr' ? 'Düzenle' : 'Edit'}</span>
              </button>
              <button onClick={createNote} disabled={!transcript} style={s.actionBtn(T.success, !transcript)}>
                <IconSave /><span>{language === 'tr' ? 'Kaydet' : 'Save'}</span>
              </button>
              <button onClick={shareText} disabled={!transcript} style={s.actionBtn(T.warn, !transcript)}>
                <IconShare /><span>{language === 'tr' ? 'Paylaş' : 'Share'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {activeTab === 'notes' && (
          <div style={s.tabContent}>
            <div style={s.filterRow}>
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); loadNotes(user.uid, e.target.value); }}
                style={s.select}
              >
                <option value="all">{language === 'tr' ? 'Tüm Notlar' : 'All Notes'}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={createBlankNote} style={s.addCatBtn}>+</button>
            </div>

            {notes.length === 0 ? (
              <div style={s.emptyState}>
                <p style={{ color: T.textDim, fontSize:'0.9rem' }}>
                  {language === 'tr' ? 'Henüz not yok' : 'No notes yet'}
                </p>
              </div>
            ) : (
              <div style={s.noteList}>
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    style={{ ...s.noteCard, borderColor: selectedNote?.id === note.id ? T.accent : 'transparent' }}
                  >
                    <h4 style={s.noteCardTitle}>{note.title || (language === 'tr' ? 'Başlıksız' : 'Untitled')}</h4>
                    <p style={s.noteCardPreview}>{(note.content || '').substring(0, 80)}…</p>
                    <small style={s.noteCardDate}>
                      {note.updatedAt?.toDate?.()?.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US') || ''}
                    </small>
                  </div>
                ))}
              </div>
            )}

            {selectedNote && (
              <div style={s.noteEditorOverlay}>
                <div style={{
                  ...s.noteEditor,
                  marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
                  maxHeight: keyboardHeight > 0 ? '58vh' : '82vh',
                }}>
                  <input
                    value={selectedNote.title || ''}
                    onChange={e => setSelectedNote(p => ({ ...p, title: e.target.value }))}
                    style={s.titleInput}
                    placeholder={language === 'tr' ? 'Başlık…' : 'Title…'}
                    autoComplete="off"
                  />
                  <textarea
                    value={selectedNote.content || ''}
                    onChange={e => setSelectedNote(p => ({ ...p, content: e.target.value }))}
                    style={{ ...s.noteTextarea, minHeight: keyboardHeight > 0 ? 60 : 140 }}
                    autoCapitalize="sentences"
                  />
                  <div style={s.editorToolbar}>
                    <button onPointerDown={saveNote}                    style={s.actionBtn(T.success)}><IconSave /><span>{language === 'tr' ? 'Kaydet' : 'Save'}</span></button>
                    <button onPointerDown={deleteNote}                  style={s.actionBtn(T.danger)}><IconDelete /><span>{language === 'tr' ? 'Sil' : 'Delete'}</span></button>
                    <button onPointerDown={shareText}                   style={s.actionBtn(T.warn)}><IconShare /><span>{language === 'tr' ? 'Paylaş' : 'Share'}</span></button>
                    <button onPointerDown={() => setSelectedNote(null)} style={s.actionBtn(T.textDim)}><span>✕</span></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div style={s.tabContent}>
            <div style={s.profileCard}>
              <div style={s.avatar}>{user.email?.[0]?.toUpperCase()}</div>
              <p style={s.profileEmail}>{user.email}</p>
            </div>
            <div style={s.settingGroup}>
              <p style={s.settingLabel}>{language === 'tr' ? 'Uygulama Dili' : 'App Language'}</p>
              <div style={s.langToggle}>
                <button onPointerDown={() => setLanguage('tr')} style={language === 'tr' ? s.langActive : s.langInactive}>🇹🇷 Türkçe</button>
                <button onPointerDown={() => setLanguage('en')} style={language === 'en' ? s.langActive : s.langInactive}>🇬🇧 English</button>
              </div>
            </div>
            <button onPointerDown={handleLogout} style={s.logoutBtn}>
              {language === 'tr' ? 'Çıkış Yap' : 'Sign Out'}
            </button>
          </div>
        )}

      </main>

      <nav style={s.bottomNav}>
        {[
          { id:'home',    Icon:IconHome,  label: language === 'tr' ? 'Ana Sayfa' : 'Home' },
          { id:'notes',   Icon:IconNotes, label: language === 'tr' ? 'Notlarım'  : 'Notes' },
          { id:'profile', Icon:IconUser,  label: language === 'tr' ? 'Profilim'  : 'Profile' },
        ].map(({ id, Icon, label }) => (
          <button key={id} onPointerDown={() => setActiveTab(id)} style={s.navItem(activeTab === id)}>
            <Icon />
            <span style={s.navLabel(activeTab === id)}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const s = {
  app: {
    display:'flex', flexDirection:'column',
    height:'100dvh', background: T.bg,
    fontFamily:"'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: T.text, overflow:'hidden',
  },
  header: {
    display:'flex', alignItems:'center',
    paddingLeft: 20, paddingRight: 20,
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 10,
    background: T.bg,
    borderBottom:`1px solid ${T.border}`,
    flexShrink:0, minHeight: 44,
  },
  headerTitle: { fontSize:'1rem', fontWeight:700, letterSpacing:'-0.3px', color: T.textMid },
  main:        { flex:1, overflowY:'auto', position:'relative', minHeight:0 },
  tabContent:  { padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 },

  speakWrapper: {
    display:'flex', justifyContent:'center', alignItems:'center',
    position:'relative',
    marginTop: 32,   // FIX: more space from top so button is lower
    marginBottom: 8,
  },
  speakBtn: {
    position:'relative', zIndex:5,
    width:155, height:155, borderRadius:'50%', border:'none', cursor:'pointer',
    background:`linear-gradient(135deg, ${T.accent}, ${T.accentCy})`,
    color:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
    boxShadow:'0 0 36px rgba(59,130,246,0.35)', fontSize:'1rem',
    touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
  },
  stopBtn: {
    position:'relative', zIndex:5,
    width:155, height:155, borderRadius:'50%', border:'none', cursor:'pointer',
    background:`linear-gradient(135deg, ${T.danger}, #dc2626)`,
    color:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
    boxShadow:'0 0 36px rgba(239,68,68,0.45)', fontSize:'1rem',
    touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
  },
  speakLabel: { fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.1em' },
  ripple1: {
    position:'absolute', width:178, height:178, borderRadius:'50%',
    border:'2px solid rgba(59,130,246,0.25)', animation:'ripple 1.5s infinite',
    pointerEvents:'none', zIndex:1,
  },
  ripple2: {
    position:'absolute', width:208, height:208, borderRadius:'50%',
    border:'2px solid rgba(59,130,246,0.12)', animation:'ripple 1.5s infinite 0.5s',
    pointerEvents:'none', zIndex:1,
  },

  timerRow:    { display:'flex', alignItems:'center', justifyContent:'center', gap:12 },
  timer:       { fontSize:'2rem', fontWeight:700, fontVariantNumeric:'tabular-nums' },
  warningBadge:{ background:'#7f1d1d', color:'#fca5a5', fontSize:'0.75rem', fontWeight:600, padding:'3px 10px', borderRadius:99 },
  statusText:  { textAlign:'center', color: T.textMid, fontSize:'0.88rem', margin:0 },

  transcriptBox: {
    background: T.surface, borderRadius:14, padding:16,
    minHeight:110, border:`1px solid ${T.border}`,
    color: T.text, fontSize:'16px', lineHeight:1.75,
    resize:'none', outline:'none', fontFamily:'inherit',
    width:'100%', boxSizing:'border-box',
    overflowY: 'auto', // FIX: ensure scroll works
  },

  actionBar: { display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' },
  actionBtn: (color, disabled = false) => ({
    display:'flex', alignItems:'center', gap:5,
    padding:'10px 16px', borderRadius:12, border:'none',
    cursor: disabled ? 'default' : 'pointer',
    background: disabled ? T.surface : color,
    color: disabled ? T.textDim : 'white',
    fontWeight:600, fontSize:'0.82rem',
    opacity: disabled ? 0.5 : 1,
    transition:'opacity 0.2s',
  }),

  filterRow: { display:'flex', gap:10, alignItems:'center' },
  select: {
    flex:1, padding:'10px 14px', background: T.surface, color: T.text,
    border:`1px solid ${T.border}`, borderRadius:10, fontSize:'0.9rem',
  },
  addCatBtn: {
    width:42, height:42, borderRadius:10, border:'none', cursor:'pointer',
    background: T.accent, color:'white', fontSize:'1.3rem', fontWeight:700,
  },
  emptyState: { display:'flex', justifyContent:'center', alignItems:'center', paddingTop:40 },
  noteList:   { display:'flex', flexDirection:'column', gap:10 },
  noteCard: {
    background: T.surface, borderRadius:14, padding:16,
    cursor:'pointer', border:'2px solid transparent', transition:'border-color 0.2s',
  },
  noteCardTitle:   { margin:'0 0 4px', fontSize:'1.05rem', fontWeight:600, color: T.text },
  noteCardPreview: { margin:'0 0 6px', fontSize:'0.88rem', color: T.textMid, lineHeight:1.5 },
  noteCardDate:    { color: T.textDim, fontSize:'0.8rem' },

  noteEditorOverlay: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:50,
    display:'flex', alignItems:'flex-end',
  },
  noteEditor: {
    width:'100%', background: T.surface, borderRadius:'20px 20px 0 0',
    padding:20,
    paddingBottom:'max(20px, env(safe-area-inset-bottom))',
    display:'flex', flexDirection:'column', gap:12,
    maxHeight:'82vh', overflowY:'auto',
    transition:'margin-bottom 0.25s ease, max-height 0.25s ease',
  },
  titleInput: {
    padding:'12px 14px', background: T.surface2, color: T.text,
    border:`1px solid ${T.border}`, borderRadius:10,
    fontSize:'16px', fontWeight:600, outline:'none',
  },
  noteTextarea: {
    padding:'12px 14px', background: T.surface2, color: T.text,
    border:`1px solid ${T.border}`, borderRadius:10,
    fontSize:'16px', resize:'none', minHeight:140, lineHeight:1.7,
    outline:'none', fontFamily:'inherit',
  },
  editorToolbar: { display:'flex', gap:8, flexWrap:'wrap' },

  profileCard: { display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'24px 0' },
  avatar: {
    width:72, height:72, borderRadius:'50%', fontSize:'1.8rem', fontWeight:700,
    background:`linear-gradient(135deg, ${T.accent}, ${T.accentCy})`,
    display:'flex', alignItems:'center', justifyContent:'center', color:'white',
  },
  profileEmail: { color: T.textMid, fontSize:'0.9rem', margin:0 },
  settingGroup: { background: T.surface, borderRadius:14, padding:16, display:'flex', flexDirection:'column', gap:12 },
  settingLabel: { margin:0, fontSize:'0.78rem', fontWeight:600, color: T.textDim, textTransform:'uppercase', letterSpacing:'0.08em' },
  langToggle:   { display:'flex', gap:8 },
  langActive:   { flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer', background: T.accent, color:'white', fontWeight:600, fontSize:'0.9rem' },
  langInactive: { flex:1, padding:'10px 0', borderRadius:10, border:`1px solid ${T.border}`, cursor:'pointer', background:'transparent', color: T.textMid, fontSize:'0.9rem' },
  logoutBtn: {
    marginTop:8, padding:'14px 0', borderRadius:12, border:'none', cursor:'pointer',
    background: T.surface, color: T.danger, fontWeight:600, fontSize:'0.95rem', width:'100%',
  },

  bottomNav: {
    display:'flex', borderTop:`1px solid ${T.border}`,
    background: T.bg, paddingBottom:'env(safe-area-inset-bottom)', flexShrink:0,
  },
  navItem: active => ({
    flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    padding:'9px 0', border:'none', cursor:'pointer',
    background:'transparent', color: active ? T.accent : T.textDim, transition:'color 0.2s',
  }),
  navLabel: active => ({ fontSize:'0.68rem', fontWeight: active ? 700 : 400 }),
};

export default Dashboard;