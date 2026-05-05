import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import {
  auth, db, signOut, onAuthStateChanged,
  collection, query, where, getDocs, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy
} from '../firebase';

const AZURE_KEY = process.env.REACT_APP_AZURE_SPEECH_KEY;
const AZURE_REGION = 'canadacentral';
const MAX_DURATION = 3 * 60 * 1000;

function Dashboard() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('tr');
  const [transcript, setTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(180);
  const [warning, setWarning] = useState(false);
  const [status, setStatus] = useState('');
  
  const recognizerRef = useRef(null);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate('/login'); return; }
      setUser(u);
      loadCategories(u.uid);
      loadNotes(u.uid, 'all');
    });
    return () => unsubscribe();
  }, [navigate]);

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

  const startRecording = () => {
    if (!AZURE_KEY) {
      setStatus('⚠️ Azure key bulunamadı! .env dosyasını kontrol et.');
      return;
    }

    const lang = language === 'tr' ? 'tr-TR' : 'en-US';
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
    speechConfig.speechRecognitionLanguage = lang;
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recognizerRef.current = recognizer;

    setTranscript('');
    setTimeLeft(180);
    setWarning(false);
    setStatus('🎙️ Dinleniyor...');
    setIsRecording(true);

recognizer.recognizing = (s, e) => {
  if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
    setStatus('💬 ' + e.result.text);
  }
};

recognizer.recognized = (s, e) => {
  if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
    const text = e.result.text;
    setStatus('🎙️ Dinleniyor...');  // ← cümle bitince temizle
    setTranscript(prev => prev ? prev + ' ' + text : text);
  }
};

    recognizer.startContinuousRecognitionAsync(
      () => console.log('✅ Kayıt başladı'),
      (err) => {
        console.error(err);
        setStatus('⚠️ Mikrofon hatası: ' + err);
        setIsRecording(false);
      }
    );

    let seconds = 180;
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setTimeLeft(seconds);
      if (seconds <= 30) setWarning(true);
      if (seconds <= 0) stopRecording();
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => { recognizerRef.current?.close(); recognizerRef.current = null; },
        (err) => console.error(err)
      );
    }
    setIsRecording(false);
    setWarning(false);
    setStatus('');
    setTimeLeft(180);
  };

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  async function saveNote() {
    if (!selectedNote) return;
    await updateDoc(doc(db, 'notes', selectedNote.id), {
      title: selectedNote.title,
      content: selectedNote.content,
      updatedAt: serverTimestamp(),
    });
    loadNotes(user.uid, selectedCategory);
    alert('✅ Kaydedildi!');
  }

  async function deleteNote() {
    if (!selectedNote || !window.confirm('Notu silmek istiyor musunuz?')) return;
    await deleteDoc(doc(db, 'notes', selectedNote.id));
    setSelectedNote(null);
    loadNotes(user.uid, selectedCategory);
  }

  async function createNote() {
    const title = prompt('Not başlığı:');
    if (!title) return;
    const ref = await addDoc(collection(db, 'notes'), {
      title, content: transcript || '',
      userId: user.uid,
      categoryId: selectedCategory === 'all' ? '' : selectedCategory,
      categoryName: selectedCategory === 'all' ? 'Kategorisiz' : categories.find(c => c.id === selectedCategory)?.name || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    loadNotes(user.uid, selectedCategory);
    setSelectedNote({ id: ref.id, title, content: transcript || '' });
    setTranscript('');
  }

  async function addCategory() {
    const name = prompt('Kategori adı:');
    if (!name) return;
    await addDoc(collection(db, 'categories'), { name, userId: user.uid, createdAt: serverTimestamp() });
    loadCategories(user.uid);
  }

  const shareText = () => {
    const text = transcript || selectedNote?.content || '';
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert('📋 Panoya kopyalandı!');
    }
  };

  const editWithChatGPT = async () => {
    const text = transcript || selectedNote?.content || '';
    if (!text) return;
    setStatus('⏳ Düzenleniyor...');
    try {
      const res = await fetch('https://iturut-app.onrender.com/chatgpt/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: 'grammar' }),
      });
      const data = await res.json();
      if (data.result) {
        setTranscript(data.result);
        if (selectedNote) setSelectedNote(prev => ({ ...prev, content: data.result }));
      }
    } catch (err) {
      setStatus('⚠️ Düzenleme hatası');
    } finally {
      setStatus('');
    }
  };

  if (!user) return <div style={{ padding: 40 }}>Yükleniyor...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={styles.navTitle}>🎙️ iTurut</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={styles.email}>{user.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Çıkış</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <div style={styles.sidebar}>
            <h3 style={styles.sidebarTitle}>Kategoriler</h3>
            <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); loadNotes(user.uid, e.target.value); }} style={styles.select}>
              <option value="all">Tüm Kategoriler</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={addCategory} style={styles.addCategoryBtn}>+ Kategori</button>
          </div>
          <div style={styles.notesList}>
            {notes.length === 0 && <div style={styles.emptyMsg}>Henüz not yok</div>}
            {notes.map(note => (
              <div key={note.id} onClick={() => setSelectedNote(note)}
                style={{ ...styles.noteItem, backgroundColor: selectedNote?.id === note.id ? '#dbeafe' : 'white' }}>
                <h4 style={styles.noteTitle}>{note.title || 'Başlıksız'}</h4>
                <p style={styles.notePreview}>{(note.content || '').substring(0, 50)}...</p>
                <small style={styles.noteDate}>{note.updatedAt?.toDate?.()?.toLocaleDateString('tr-TR') || ''}</small>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.editor}>
          <div style={styles.langBar}>
            <button onClick={() => setLanguage('tr')} style={language === 'tr' ? styles.langActive : styles.langInactive}>🇹🇷 Türkçe</button>
            <button onClick={() => setLanguage('en')} style={language === 'en' ? styles.langActive : styles.langInactive}>🇬🇧 English</button>
          </div>

          <div style={styles.speakContainer}>
            <button onClick={isRecording ? stopRecording : startRecording}
              style={isRecording ? styles.speakBtnRecording : styles.speakBtn}>
              {isRecording ? 'DURDUR' : 'KONUŞ'}
            </button>
            {isRecording && (
              <div style={styles.timerContainer}>
                <span style={{ ...styles.timer, color: warning ? '#ef4444' : '#1f2937' }}>{formatTime(timeLeft)}</span>
                {warning && <span style={styles.warningText}>⚠️ Toparla, az kaldı!</span>}
              </div>
            )}
          </div>

          {status && <p style={styles.status}>{status}</p>}

          {transcript && (
            <div style={styles.transcriptBox}>
              <p style={styles.transcriptText}>{transcript}</p>
            </div>
          )}

          {transcript && (
            <div style={styles.actionBar}>
              <button onClick={editWithChatGPT} style={styles.editBtn}>✏️ Düzenle</button>
              <button onClick={createNote} style={styles.saveBtn}>💾 Kaydet</button>
              <button onClick={shareText} style={styles.shareBtn}>📤 Paylaş</button>
            </div>
          )}

          {selectedNote && (
            <div style={styles.noteEditor}>
              <input value={selectedNote.title || ''} onChange={(e) => setSelectedNote(prev => ({ ...prev, title: e.target.value }))} style={styles.titleInput} placeholder="Not başlığı..." />
              <textarea value={selectedNote.content || ''} onChange={(e) => setSelectedNote(prev => ({ ...prev, content: e.target.value }))} style={styles.textarea} />
              <div style={styles.noteToolbar}>
                <button onClick={saveNote} style={styles.saveBtn}>💾 Kaydet</button>
                <button onClick={deleteNote} style={{ ...styles.editBtn, backgroundColor: '#ef4444' }}>🗑️ Sil</button>
                <button onClick={shareText} style={styles.shareBtn}>📤 Paylaş</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { fontFamily: 'Segoe UI, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f4ff' },
  navbar: { backgroundColor: '#1e3a8a', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTitle: { fontSize: '1.3rem', fontWeight: 'bold' },
  email: { fontSize: '0.85rem', opacity: 0.8 },
  logoutBtn: { padding: '6px 14px', backgroundColor: 'white', color: '#1e3a8a', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  leftPanel: { width: 260, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', backgroundColor: 'white' },
  sidebar: { padding: 14, borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 8 },
  sidebarTitle: { margin: 0, color: '#1f2937', fontSize: '0.9rem' },
  select: { padding: 7, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: '0.85rem' },
  addCategoryBtn: { padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' },
  notesList: { flex: 1, overflowY: 'auto' },
  noteItem: { padding: 12, borderBottom: '1px solid #f3f4f6', cursor: 'pointer' },
  noteTitle: { margin: '0 0 3px', fontSize: '0.88rem', color: '#1f2937' },
  notePreview: { margin: '0 0 3px', fontSize: '0.76rem', color: '#6b7280' },
  noteDate: { color: '#9ca3af', fontSize: '0.7rem' },
  editor: { flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' },
  langBar: { display: 'flex', gap: 10 },
  langActive: { padding: '8px 20px', borderRadius: 20, border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 'bold' },
  langInactive: { padding: '8px 20px', borderRadius: 20, border: '2px solid #2563eb', backgroundColor: 'white', color: '#2563eb', cursor: 'pointer' },
  speakContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  speakBtn: { width: 150, height: 150, borderRadius: '50%', border: 'none', backgroundColor: '#2563eb', color: 'white', fontSize: '1.4rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(37,99,235,0.4)' },
  speakBtnRecording: { width: 150, height: 150, borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '1.4rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' },
  timerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  timer: { fontSize: '1.8rem', fontWeight: 'bold' },
  warningText: { color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' },
  status: { textAlign: 'center', color: '#6b7280', margin: 0 },
  transcriptBox: { backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb', minHeight: 60 },
  transcriptText: { margin: 0, fontSize: '1rem', lineHeight: 1.7, color: '#1f2937' },
  actionBar: { display: 'flex', gap: 12, justifyContent: 'center' },
  editBtn: { padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  saveBtn: { padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  shareBtn: { padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  noteEditor: { display: 'flex', flexDirection: 'column', gap: 10, backgroundColor: 'white', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb' },
  titleInput: { padding: 10, fontSize: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, fontWeight: 'bold' },
  textarea: { padding: 12, fontSize: '0.95rem', border: '1px solid #e5e7eb', borderRadius: 8, resize: 'none', minHeight: 180, lineHeight: 1.6 },
  noteToolbar: { display: 'flex', gap: 10 },
  emptyMsg: { padding: 20, color: '#9ca3af', textAlign: 'center', fontSize: '0.85rem' },
};

export default Dashboard;