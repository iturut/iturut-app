import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, onAuthStateChanged } from './firebase';
import SpeechToText from './SpeechToText';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser]         = useState(undefined);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  // Firebase auth kontrol ederken koyu boş ekran göster
  if (checking) {
    return <div style={{ height: '100dvh', background: '#16191f' }} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/record" element={<SpeechToText />} />
      </Routes>
    </Router>
  );
}

export default App;