import React, { useState, useEffect } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from '../firebase';
import { useNavigate } from 'react-router-dom';

const T = {
  bg:      '#16191f',
  surface: '#1e2230',
  border:  '#2a3045',
  text:    '#e8eaf0',
  textMid: '#8b92a8',
  textDim: '#4a5168',
  accent:  '#3b82f6',
  danger:  '#ef4444',
};

function Login() {
  const [mode, setMode]               = useState('login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();

  // If user already logged in, go straight to dashboard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/dashboard', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('Email ve şifre gerekli.'); return; }
    if (mode === 'signup' && password !== confirmPass) { setError('Şifreler eşleşmiyor.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      const msgs = {
        'auth/user-not-found':       'Bu email ile kayıtlı kullanıcı bulunamadı.',
        'auth/wrong-password':       'Şifre hatalı.',
        'auth/email-already-in-use': 'Bu email zaten kullanılıyor.',
        'auth/invalid-email':        'Geçersiz email adresi.',
        'auth/too-many-requests':    'Çok fazla deneme. Lütfen bekleyin.',
        'auth/invalid-credential':   'Email veya şifre hatalı.',
      };
      setError(msgs[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError('');
    setPassword('');
    setConfirmPass('');
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <span style={s.logoIcon}>🎙️</span>
          <span style={s.logoText}>iTurut</span>
        </div>

        <h2 style={s.title}>
          {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
        </h2>

        {error && <div style={s.errorBox}>{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={s.input}
          autoComplete="email"
          autoCapitalize="none"
        />

        <div style={{ position:'relative', marginBottom:12 }}>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Şifre"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...s.input, marginBottom:0, paddingRight:44 }}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            style={s.eyeBtn}
          >
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>

        {mode === 'signup' && (
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Şifreyi tekrar gir"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            style={s.input}
            autoComplete="new-password"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ ...s.button, opacity: loading ? 0.7 : 1 }}
        >
          {loading
            ? '⏳ Lütfen bekleyin…'
            : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>

        <div style={s.switchRow}>
          <span style={{ color: T.textMid, fontSize:'0.88rem' }}>
            {mode === 'login' ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'}
          </span>
          <button onClick={switchMode} style={s.linkBtn}>
            {mode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: {
    display:'flex', justifyContent:'center', alignItems:'center',
    minHeight:'100dvh', background: T.bg,
    fontFamily:"'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    padding:'20px',
  },
  card: {
    background: T.surface,
    padding:'36px 28px', borderRadius:20,
    boxShadow:'0 8px 40px rgba(0,0,0,0.4)',
    width:'100%', maxWidth:380,
    border:`1px solid ${T.border}`,
  },
  logoRow: {
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:8, marginBottom:20,
  },
  logoIcon: { fontSize:'2rem' },
  logoText: { fontSize:'1.6rem', fontWeight:700, color: T.text, letterSpacing:'-0.5px' },
  title: {
    textAlign:'center', color: T.text,
    fontSize:'1.1rem', fontWeight:600,
    marginBottom:20, marginTop:0,
  },
  errorBox: {
    background:'rgba(239,68,68,0.12)', color:'#fca5a5',
    border:'1px solid rgba(239,68,68,0.3)',
    borderRadius:10, padding:'10px 14px',
    fontSize:'0.85rem', marginBottom:14, textAlign:'center',
  },
  input: {
    width:'100%', padding:'13px 14px', marginBottom:12,
    borderRadius:10, border:`1px solid ${T.border}`,
    background:'#252a38', color: T.text,
    fontSize:'16px', boxSizing:'border-box', outline:'none',
    fontFamily:'inherit',
  },
  eyeBtn: {
    position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
    background:'none', border:'none', cursor:'pointer',
    color: T.textMid, fontSize:'1.2rem', padding:0,
  },
  button: {
    width:'100%', padding:'14px', marginTop:4,
    background: T.accent, color:'white',
    border:'none', borderRadius:12,
    fontSize:'1rem', fontWeight:600, cursor:'pointer',
    fontFamily:'inherit',
  },
  switchRow: {
    display:'flex', justifyContent:'center', alignItems:'center',
    gap:6, marginTop:16,
  },
  linkBtn: {
    background:'none', border:'none', cursor:'pointer',
    color: T.accent, fontSize:'0.88rem', fontWeight:600,
    padding:0, fontFamily:'inherit',
  },
};

export default Login;