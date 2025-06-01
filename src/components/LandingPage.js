import React from 'react';
import '../App.css';
import { useNavigate } from 'react-router-dom';

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="container">
      <img src="/iturut_logo.png" alt="iTurut logo" style={{ width: "100px", marginBottom: "1rem" }} />

      <h1>Your Voice. Your Thoughts.</h1>
      <h2>Instantly Captured.</h2>

      <p><strong>Introducing iTurut</strong> — The voice-first note-taking app powered by AI. Capture your ideas effortlessly, anytime.</p>

      <ul>
        <li>3-min uninterrupted recording</li>
        <li>One-tap start & voice commands</li>
        <li>Auto-save every minute</li>
        <li>ChatGPT-based smart editing</li>
        <li>English & Turkish support</li>
      </ul>

      <div className="buttons">
        <button className="btn" onClick={() => navigate('/record')}>🎙️ Try Recording</button>
        <button className="btn">📄 See Demo Note</button>
      </div>

      <form className="email-form">
        <input type="email" placeholder="Enter your email for early access" required />
        <button type="submit">Notify Me</button>
      </form>

      <footer>
        © 2025 iTurut. All rights reserved.
      </footer>
    </div>
  );
}

export default Landing;
