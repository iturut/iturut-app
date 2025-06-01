// src/Recorder.js
import React, { useState, useRef } from 'react';

function Recorder({ onTranscribe }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunks.current = [];

    mediaRecorderRef.current.ondataavailable = event => {
      audioChunks.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      onTranscribe(audioBlob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);

    // 3 dakika sonra otomatik durdur
    setTimeout(() => stopRecording(), 180000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
}

export default Recorder;
