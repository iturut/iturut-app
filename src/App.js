import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SpeechToText from './SpeechToText';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/record" element={<SpeechToText />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;