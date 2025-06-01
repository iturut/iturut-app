import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/LandingPage';
import SpeechToText from './SpeechToText';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/record" element={<SpeechToText />} />
      </Routes>
    </Router>
  );
}

export default App;

