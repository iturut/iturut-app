const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.post('/speech-to-text', upload.single('audio'), async (req, res) => {
  const originalFile = req.file;
  const originalPath = originalFile.path;
  const wavPath = `${originalPath}.wav`;

  console.log('🎧 Ses dosyası alındı:', originalFile.originalname);
  console.log('🔄 WAV formatına dönüştürülüyor...');

  const ffmpegCommand = `ffmpeg -i ${originalPath} -ar 16000 -ac 1 -f wav ${wavPath}`;

  exec(ffmpegCommand, async (error, stdout, stderr) => {
    if (error) {
      console.error('❌ FFmpeg hatası:', error.message);
      return res.status(500).json({ error: 'FFmpeg conversion failed' });
    }

    console.log('✅ Dönüştürme tamam, Azure’a gönderiliyor...');

    try {
      const audioBuffer = fs.readFileSync(wavPath);

     const response = await axios({
  method: 'post',
  url: `https://${process.env.AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=tr-TR`,
  headers: {
    'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
    'Content-Type': 'audio/wav',
    'Accept': 'application/json'
  },
  data: audioBuffer
});



      const resultText =
        response.data.DisplayText ||
        response.data.NBest?.[0]?.Display ||
        '[No text recognized]';

      console.log('✅ Azure yanıtı:', resultText);
      console.log('🧠 Algılanan Dil:', response.data.DetectionLanguage || 'Belirlenemedi');

      fs.unlinkSync(originalPath);
      fs.unlinkSync(wavPath);

      res.json({ transcript: resultText });
    } catch (err) {
      console.error('❌ Azure hata:', err.response?.data || err.message);
      res.status(500).json({
        error: 'Speech-to-text failed',
        details: err.response?.data || err.message,
      });
    }
  });
});

app.listen(5000, () => {
  console.log('🚀 iTurut backend listening on port 5000');
});
