const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Ses dosyasını metne çevir (Whisper)
app.post('/speech-to-text', upload.single('audio'), async (req, res) => {
  const originalFile = req.file;
  const originalPath = originalFile.path;

  console.log('🎧 Ses dosyası alındı:', originalFile.originalname);

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(originalPath), {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'tr');

    console.log('📡 Whisper\'a gönderiliyor...');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const resultText = response.data.text || '[Ses tanınamadı]';
    console.log('✅ Whisper yanıtı:', resultText);

    fs.unlinkSync(originalPath);

    res.json({ transcript: resultText });
  } catch (err) {
    console.error('❌ Whisper hata:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Speech-to-text failed',
      details: err.response?.data || err.message,
    });
  }
});

// ChatGPT ile düzenleme
app.post('/chatgpt/edit', async (req, res) => {
  const { text, type } = req.body;
  const prompt =
    type === 'grammar'
      ? `Aşağıdaki Türkçe metnin sadece dil bilgisi ve yazım hatalarını düzelt:\n\n"${text}"`
      : `Aşağıdaki Türkçe metni daha profesyonel, düzenli ve anlaşılır şekilde yeniden yaz:\n\n"${text}"`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    res.json({ result: response.data.choices[0].message.content.trim() });
  } catch (err) {
    console.error('❌ ChatGPT hata:', err.response?.data || err.message);
    res.status(500).json({
      error: 'ChatGPT düzenleme hatası',
      details: err.response?.data || err.message,
    });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});