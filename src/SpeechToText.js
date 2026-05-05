import React, { useState, useRef } from 'react';

const BACKEND_URL = 'https://iturut-app.onrender.com';

const SpeechToText = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('tr');
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = 'audio/webm;codecs=opus';
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
    audioChunks.current = [];

    mediaRecorderRef.current.ondataavailable = event => {
      audioChunks.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      setLoading(true);
      const blob = new Blob(audioChunks.current, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', language);

      try {
        const response = await fetch(`${BACKEND_URL}/speech-to-text`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.transcript) {
          setTranscript(data.transcript);
        } else {
          setTranscript('[Ses tanınamadı]');
        }
      } catch (error) {
        setTranscript('[Bağlantı hatası]');
      } finally {
        setLoading(false);
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);

    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }, 180000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadTextFile = (text) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'iturut-note.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎙️ iTurut</h2>

      {/* Dil Toggle */}
      <div style={styles.toggleContainer}>
        <button
          onClick={() => setLanguage('tr')}
          style={language === 'tr' ? styles.toggleActive : styles.toggleInactive}
        >
          🇹🇷 Türkçe
        </button>
        <button
          onClick={() => setLanguage('en')}
          style={language === 'en' ? styles.toggleActive : styles.toggleInactive}
        >
          🇬🇧 English
        </button>
      </div>

      {/* Kayıt Butonu */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={isRecording ? styles.recordingBtn : styles.recordBtn}
        disabled={loading}
      >
        {isRecording ? '⏹ Durdur' : '🎙️ Kayıt Başlat'}
      </button>

      {loading && <p style={styles.loading}>⏳ Ses işleniyor...</p>}

      {/* Transcript */}
      {transcript ? (
        <div style={styles.transcriptBox}>
          <strong>Transkript:</strong>
          <p style={styles.transcriptText}>{transcript}</p>
          <button
            onClick={() => downloadTextFile(transcript)}
            style={styles.downloadBtn}
          >
            📥 .txt olarak indir
          </button>
        </div>
      ) : null}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    fontFamily: 'Segoe UI, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '24px',
    color: '#1a1a2e',
  },
  toggleContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
  },
  toggleActive: {
    padding: '10px 24px',
    borderRadius: '24px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  toggleInactive: {
    padding: '10px 24px',
    borderRadius: '24px',
    border: '2px solid #2563eb',
    backgroundColor: 'white',
    color: '#2563eb',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  recordBtn: {
    padding: '16px 40px',
    borderRadius: '50px',
    border: 'none',
    backgroundColor: '#10b981',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    marginBottom: '24px',
  },
  recordingBtn: {
    padding: '16px 40px',
    borderRadius: '50px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    marginBottom: '24px',
  },
  loading: {
    color: '#6b7280',
    marginBottom: '16px',
  },
  transcriptBox: {
    width: '100%',
    padding: '20px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    backgroundColor: '#f9fafb',
    marginTop: '16px',
  },
  transcriptText: {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    color: '#1f2937',
    marginTop: '8px',
  },
  downloadBtn: {
    marginTop: '12px',
    padding: '8px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6b7280',
    color: 'white',
    cursor: 'pointer',
  },
};

export default SpeechToText;