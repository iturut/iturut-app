// ✅ SpeechToText.js (frontend/src/SpeechToText.js)
import React, { useState, useRef } from 'react';

const SpeechToText = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    console.log('🎙️ Recording started...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = 'audio/webm;codecs=opus'; // En yaygın desteklenen


    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
    audioChunks.current = [];

    mediaRecorderRef.current.ondataavailable = event => {
      audioChunks.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      console.log('🎙️ Recording stopped...');
      const blob = new Blob(audioChunks.current, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      console.log('🧪 Blob size:', blob.size);

      console.log('📡 Fetch gönderiliyor...');
      try {
        const response = await fetch('https://iturut-app.onrender.com/speech-to-text', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        console.log('✅ Azure response:', data);

        if (data.transcript) {
          setTranscript(data.transcript);
        } else if (data.details) {
          setTranscript(`[Azure error] ${JSON.stringify(data.details)}`);
        } else {
          setTranscript('[Transcription failed]');
        }
      } catch (error) {
        console.error('❌ Fetch error:', error);
        setTranscript('[Error contacting backend]');
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);

    setTimeout(() => {
      if (mediaRecorderRef.current) {
        console.log('🛑 Stopping recorder...');
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } else {
        console.log('⚠️ mediaRecorder boş!');
      }
    }, 10000); // 20 saniye sonra otomatik durdur
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      console.log('🛑 Manual stop...');
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
    <div>
      <h2>iTurut | Speak to Note (Azure)</h2>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start Recording'}
      </button>
      <button onClick={() => downloadTextFile(transcript)} disabled={!transcript} style={{ marginLeft: '10px' }}>
        Download as .txt
      </button>

      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid gray' }}>
        <strong>Transcript:</strong>
        <p>{transcript}</p>
      </div>
    </div>
  );
};

export default SpeechToText;
