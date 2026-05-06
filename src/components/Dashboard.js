import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import {
  auth, db, signOut, onAuthStateChanged,
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from '../firebase';

const AZURE_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY || 'BN3TJVa9xVG9cyY8QSWKLVbik6q4figqJGK6Ixh0GnuzH32XAnKzJQQJ99CEACBsN54XJ3w3AAAYACOGgz17';
const AZURE_REGION = 'canadacentral';

// ── icons (inline SVG) ──────────────────────────────────────────
const IconMic    = () => <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6.5 10.5A6.5 6.5 0 0 1 5.5 11.5H4a8 8 0 0 0 7 7.93V22h2v-2.57A8 8 0 0 0 20 11.5h-1.5z"/></svg>;
const IconStop   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
const IconHome   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const IconNotes  = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 13h8v1.5H8V13zm0 3h5v1.5H8V16zm0-6h3v1.5H8V10z"/></svg>;
const IconUser   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>;
const IconEdit   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSave   = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>;
const IconShare  = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 16a3 3 0 0 0-2.04.8L8.91 12.7A3.07 3.07 0 0 0 9 12a3.07 3.07 0 0 0-.09-.7l7.05-4.1A3 3 0 1 0 15 5a3.07 3.07 0 0 0 .09.7L8.04 9.8A3 3 0 1 0 8 15a3.07 3.07 0 0 0 .91-.1L15.96 19a3 3 0 1 0 2.04-3z"/></svg>;
const IconDelete = () => <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>;


function Dashboard() {
  const [user, setUser]                   = useState(null);
  const [notes, setNotes]                 = useState([]);
  const [categories, setCategories]       = useState([]);
  const [selectedNote, setSelectedNote]   = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRecording, setIsRecording]     = useState(false);
  const [language, setLanguage]           = useState(() => navigator.language?.startsWith('tr') ? 'tr' : 'en');
  const [transcript, setTranscript]       = useState('');
  const [timeLeft, setTimeLeft]           = useState(180);
  const [warning, setWarning]             = useState(false);
  const [status, setStatus]               = useState('');
  const [activeTab, setActiveTab]         = useState('home');
  
  const recognizerRef = useRef(null);
  const timerRef      = useRef(null);
  const navigate      = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { navigate('/login'); return; }
      setUser(u);
      loadCategories(u.uid);
      loadNotes(u.uid, 'all');
    });
    return () => unsub();
  }, [navigate]);

  async function loadCategories(uid) {
    const q    = query(collection(db, 'categories'), where('userId', '==', uid));
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

 const startRecording = () => {
    if (!AZURE_KEY) { setStatus('⚠️ Azure key bulunamadı'); return; }
    const lang         = language === 'tr' ? 'tr-TR' : 'en-US';
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
    speechConfig.speechRecognitionLanguage = lang;
    const audioConfig  = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer   = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    setTranscript(''); setTimeLeft(180); setWarning(false);
    setStatus(language === 'tr' ? '🎙️ Dinleniyor...' : '🎙️ Listening...');
    setIsRecording(true);

    recognizer.recognizing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech)
        setStatus('💬 ' + e.result.text);
    };
    recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = e.result.text;
        setStatus(language === 'tr' ? '🎙️ Dinleniyor...' : '🎙️ Listening...');
        setTranscript(prev => prev ? prev + ' ' + text : text);
      }
    };
    recognizer.startContinuousRecognitionAsync(
      () => {},
      err => { setStatus('⚠️ ' + err); setIsRecording(false); }
    );

    let seconds = 180;
    timerRef.current = setInterval(() => {
      seconds -= 1; setTimeLeft(seconds);
      if (seconds <= 30) setWarning(true);
      if (seconds <= 0)  stopRecording();
    }, 1000);
  };
  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => { recognizerRef.current?.close(); recognizerRef.current = null; },
        err => console.error(err)
      );
    }
    
    setWarning(false); setStatus(''); setTimeLeft(180);
  };

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
    const title = prompt(language === 'tr' ? 'Not başlığı:' : 'Note title:');
    if (!title) return;
    const ref = await addDoc(collection(db, 'notes'), {
      title, content: transcript || '',
      userId: user.uid,
      categoryId: selectedCategory === 'all' ? '' : selectedCategory,
      categoryName: selectedCategory === 'all' ? '' : categories.find(c => c.id === selectedCategory)?.name || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    loadNotes(user.uid, selectedCategory);
    setSelectedNote({ id: ref.id, title, content: transcript || '' });
    setTranscript('');
    setActiveTab('notes');
  }

  async function addCategory() {
    const name = prompt(language === 'tr' ? 'Kategori adı:' : 'Category name:');
    if (!name) return;
    await addDoc(collection(db, 'categories'), { name, userId: user.uid, createdAt: serverTimestamp() });
    loadCategories(user.uid);
  }

  const shareText = () => {
    const text = transcript || selectedNote?.content || '';
    if (navigator.share) navigator.share({ text });
    else { navigator.clipboard.writeText(text); }
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
        if (selectedNote) setSelectedNote(prev => ({ ...prev, content: data.result }));
      }
    } catch { setStatus('⚠️ Error'); }
    finally  { setStatus(''); }
  };

  if (!user) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#0f172a' }}>
      <div style={{ color:'#94a3b8', fontSize:'1rem' }}>Loading…</div>
    </div>
  );

  // ── TAB CONTENTS ────────────────────────────────────────────────
  const HomeTab = () => (
    <div style={s.tabContent}>
      {/* speak button */}
      <div style={s.speakWrapper}>
        {isRecording && <div style={s.ripple1}/>}
        {isRecording && <div style={s.ripple2}/>}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={isRecording ? s.stopBtn : s.speakBtn}
        >
          {isRecording ? <IconStop /> : <IconMic />}
          <span style={s.speakLabel}>{isRecording ? (language === 'tr' ? 'DURDUR' : 'STOP') : (language === 'tr' ? 'KONUŞ' : 'SPEAK')}</span>
        </button>
      </div>

      {/* timer */}
      {isRecording && (
        <div style={s.timerRow}>
          <span style={{ ...s.timer, color: warning ? '#f87171' : '#e2e8f0' }}>{formatTime(timeLeft)}</span>
          {warning && <span style={s.warningBadge}>{language === 'tr' ? 'Az kaldı!' : 'Almost done!'}</span>}
        </div>
      )}

      {/* status */}
      {status && <p style={s.statusText}>{status}</p>}

      {/* transcript box */}
      <textarea
  value={transcript || ''}
  onChange={e => setTranscript(e.target.value)}
  placeholder={language === 'tr' ? 'Konuşmak için butona bas…' : 'Tap the button to speak…'}
  style={{
    ...s.transcriptBox,
    color: transcript ? '#e2e8f0' : '#475569',
    resize: 'none',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '1rem',
    lineHeight: '1.75',
    background: '#1e293b',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 120,
  }}
/> 

      {/* action bar */}
      {transcript && (
        <div style={s.actionBar}>
          <button onClick={editWithChatGPT} style={s.actionBtn('#6366f1')}>
            <IconEdit /><span>{language === 'tr' ? 'Düzenle' : 'Edit'}</span>
          </button>
          <button onClick={createNote} style={s.actionBtn('#10b981')}>
            <IconSave /><span>{language === 'tr' ? 'Kaydet' : 'Save'}</span>
          </button>
          <button onClick={shareText} style={s.actionBtn('#f59e0b')}>
            <IconShare /><span>{language === 'tr' ? 'Paylaş' : 'Share'}</span>
          </button>
        </div>
      )}
    </div>
  );

  const NotesTab = () => (
    <div style={s.tabContent}>
      {/* category filter */}
      <div style={s.filterRow}>
        <select
          value={selectedCategory}
          onChange={e => { setSelectedCategory(e.target.value); loadNotes(user.uid, e.target.value); }}
          style={s.select}
        >
          <option value="all">{language === 'tr' ? 'Tüm Notlar' : 'All Notes'}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={addCategory} style={s.addCatBtn}>+</button>
      </div>

      {/* notes list */}
      {notes.length === 0 ? (
        <div style={s.emptyState}>
          <p style={{ color:'#475569', fontSize:'0.9rem' }}>{language === 'tr' ? 'Henüz not yok' : 'No notes yet'}</p>
        </div>
      ) : (
        <div style={s.noteList}>
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note)}
              style={{ ...s.noteCard, borderColor: selectedNote?.id === note.id ? '#3b82f6' : 'transparent' }}
            >
              <h4 style={s.noteCardTitle}>{note.title || (language === 'tr' ? 'Başlıksız' : 'Untitled')}</h4>
              <p style={s.noteCardPreview}>{(note.content || '').substring(0, 80)}…</p>
              <small style={s.noteCardDate}>{note.updatedAt?.toDate?.()?.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US') || ''}</small>
            </div>
          ))}
        </div>
      )}

      {/* note editor */}
      {selectedNote && (
        <div style={s.noteEditorOverlay}>
          <div style={s.noteEditor}>
            <input
              value={selectedNote.title || ''}
              onChange={e => setSelectedNote(p => ({ ...p, title: e.target.value }))}
              style={s.titleInput}
              placeholder={language === 'tr' ? 'Başlık…' : 'Title…'}
            />
            <textarea
              value={selectedNote.content || ''}
              onChange={e => setSelectedNote(p => ({ ...p, content: e.target.value }))}
              style={s.textarea}
            />
            <div style={s.editorToolbar}>
              <button onClick={saveNote}   style={s.actionBtn('#10b981')}><IconSave /><span>{language === 'tr' ? 'Kaydet' : 'Save'}</span></button>
              <button onClick={deleteNote} style={s.actionBtn('#ef4444')}><IconDelete /><span>{language === 'tr' ? 'Sil' : 'Delete'}</span></button>
              <button onClick={shareText}  style={s.actionBtn('#f59e0b')}><IconShare /><span>{language === 'tr' ? 'Paylaş' : 'Share'}</span></button>
              <button onClick={() => setSelectedNote(null)} style={s.actionBtn('#475569')}><span>✕</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const ProfileTab = () => (
    <div style={s.tabContent}>
      <div style={s.profileCard}>
        <div style={s.avatar}>{user.email?.[0]?.toUpperCase()}</div>
        <p style={s.profileEmail}>{user.email}</p>
      </div>

      <div style={s.settingGroup}>
        <p style={s.settingLabel}>{language === 'tr' ? 'Uygulama Dili' : 'App Language'}</p>
        <div style={s.langToggle}>
          <button onClick={() => setLanguage('tr')} style={language === 'tr' ? s.langActive : s.langInactive}>🇹🇷 Türkçe</button>
          <button onClick={() => setLanguage('en')} style={language === 'en' ? s.langActive : s.langInactive}>🇬🇧 English</button>
        </div>
      </div>

      <button onClick={handleLogout} style={s.logoutBtn}>
        {language === 'tr' ? 'Çıkış Yap' : 'Sign Out'}
      </button>
    </div>
  );

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      {/* header */}
      <header style={s.header}>
        <span style={s.headerLogo}>🎙️</span>
        <span style={s.headerTitle}>iTurut</span>
      </header>

      {/* page */}
      <main style={s.main}>
        {activeTab === 'home'    && <HomeTab />}
        {activeTab === 'notes'   && <NotesTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* bottom nav */}
      <nav style={s.bottomNav}>
        {[
          { id:'home',    Icon:IconHome,  label: language === 'tr' ? 'Ana Sayfa' : 'Home' },
          { id:'notes',   Icon:IconNotes, label: language === 'tr' ? 'Notlarım'  : 'Notes' },
          { id:'profile', Icon:IconUser,  label: language === 'tr' ? 'Profilim'  : 'Profile' },
        ].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={s.navItem(activeTab === id)}>
            <Icon />
            <span style={s.navLabel(activeTab === id)}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── STYLES ──────────────────────────────────────────────────────────
const s = {
  app: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#0f172a',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e2e8f0', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  },
  headerLogo:  { fontSize: '1.4rem' },
  headerTitle: { fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.5px', color: '#f1f5f9' },
  main:        { flex: 1, overflowY: 'auto', position: 'relative' },
  tabContent:  { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' },

  // speak button
  speakWrapper: { display:'flex', justifyContent:'center', alignItems:'center', position:'relative', marginTop: 16, marginBottom: 8 },
  speakBtn: {
    width: 160, height: 160, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 0 40px rgba(59,130,246,0.4)',
    transition: 'transform 0.15s', fontSize: '1rem',
  },
  stopBtn: {
    width: 160, height: 160, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 0 40px rgba(239,68,68,0.5)',
    fontSize: '1rem',
  },
  speakLabel: { fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' },
  ripple1: {
    position:'absolute', width:180, height:180, borderRadius:'50%',
    border:'2px solid rgba(59,130,246,0.3)', animation:'ripple 1.5s infinite',
  },
  ripple2: {
    position:'absolute', width:210, height:210, borderRadius:'50%',
    border:'2px solid rgba(59,130,246,0.15)', animation:'ripple 1.5s infinite 0.5s',
  },

  timerRow:    { display:'flex', alignItems:'center', justifyContent:'center', gap:12 },
  timer:       { fontSize:'2rem', fontWeight:700, fontVariantNumeric:'tabular-nums' },
  warningBadge:{ background:'#7f1d1d', color:'#fca5a5', fontSize:'0.75rem', fontWeight:600, padding:'3px 10px', borderRadius:99 },
  statusText:  { textAlign:'center', color:'#64748b', fontSize:'0.9rem', margin:0 },

  transcriptBox: {
    flex:1, background:'#1e293b', borderRadius:16, padding:20,
    minHeight:120, border:'1px solid #334155',
  },
  transcriptText: { margin:0, fontSize:'1rem', lineHeight:1.75 },

  actionBar: { display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' },
  actionBtn: color => ({
    display:'flex', alignItems:'center', gap:6,
    padding:'10px 18px', borderRadius:12, border:'none', cursor:'pointer',
    background:color, color:'white', fontWeight:600, fontSize:'0.85rem',
  }),

  // notes tab
  filterRow:   { display:'flex', gap:10, alignItems:'center' },
  select: {
    flex:1, padding:'10px 14px', background:'#1e293b', color:'#e2e8f0',
    border:'1px solid #334155', borderRadius:10, fontSize:'0.9rem',
  },
  addCatBtn: {
    width:42, height:42, borderRadius:10, border:'none', cursor:'pointer',
    background:'#3b82f6', color:'white', fontSize:'1.3rem', fontWeight:700,
  },
  emptyState:  { display:'flex', justifyContent:'center', alignItems:'center', flex:1 },
  noteList:    { display:'flex', flexDirection:'column', gap:10 },
  noteCard: {
    background:'#1e293b', borderRadius:14, padding:16,
    cursor:'pointer', border:'2px solid transparent', transition:'border-color 0.2s',
  },
  noteCardTitle:   { margin:'0 0 4px', fontSize:'0.95rem', fontWeight:600, color:'#f1f5f9' },
  noteCardPreview: { margin:'0 0 6px', fontSize:'0.8rem', color:'#64748b', lineHeight:1.5 },
  noteCardDate:    { color:'#475569', fontSize:'0.75rem' },

  noteEditorOverlay: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50,
    display:'flex', alignItems:'flex-end',
  },
  noteEditor: {
    width:'100%', background:'#1e293b', borderRadius:'20px 20px 0 0',
    padding:20, display:'flex', flexDirection:'column', gap:12, maxHeight:'80vh',
  },
  titleInput: {
    padding:'12px 14px', background:'#0f172a', color:'#f1f5f9',
    border:'1px solid #334155', borderRadius:10, fontSize:'1rem', fontWeight:600,
  },
  textarea: {
    padding:'12px 14px', background:'#0f172a', color:'#e2e8f0',
    border:'1px solid #334155', borderRadius:10, fontSize:'0.9rem',
    resize:'none', minHeight:160, lineHeight:1.7,
  },
  editorToolbar: { display:'flex', gap:8, flexWrap:'wrap' },

  // profile tab
  profileCard: { display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'24px 0' },
  avatar: {
    width:72, height:72, borderRadius:'50%', fontSize:'1.8rem', fontWeight:700,
    background:'linear-gradient(135deg,#3b82f6,#06b6d4)',
    display:'flex', alignItems:'center', justifyContent:'center', color:'white',
  },
  profileEmail: { color:'#94a3b8', fontSize:'0.9rem', margin:0 },
  settingGroup: { background:'#1e293b', borderRadius:14, padding:16, display:'flex', flexDirection:'column', gap:12 },
  settingLabel: { margin:0, fontSize:'0.8rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em' },
  langToggle:   { display:'flex', gap:8 },
  langActive: {
    flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
    background:'#3b82f6', color:'white', fontWeight:600, fontSize:'0.9rem',
  },
  langInactive: {
    flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #334155', cursor:'pointer',
    background:'transparent', color:'#64748b', fontSize:'0.9rem',
  },
  logoutBtn: {
    marginTop:8, padding:'14px 0', borderRadius:12, border:'none', cursor:'pointer',
    background:'#1e293b', color:'#f87171', fontWeight:600, fontSize:'0.95rem',
    width:'100%',
  },

  // bottom nav
  bottomNav: {
    display:'flex', borderTop:'1px solid #1e293b',
    background:'#0f172a', padding:'8px 0 env(safe-area-inset-bottom)',
  },
  navItem: active => ({
    flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
    padding:'8px 0', border:'none', cursor:'pointer',
    background:'transparent', color: active ? '#3b82f6' : '#475569',
    transition:'color 0.2s',
  }),
  navLabel: active => ({
    fontSize:'0.68rem', fontWeight: active ? 700 : 400,
  }),
};

export default Dashboard;