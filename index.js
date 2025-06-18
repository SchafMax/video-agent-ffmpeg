const express = require('express');
const https = require('https');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Route POST /generate
app.post('/generate', async (req, res) => {
  const audioUrl = req.body.audioUrl;
  const imageUrl = req.body.imageUrl;

  if (!audioUrl || !imageUrl) {
    return res.status(400).json({ error: 'audioUrl and imageUrl are required' });
  }

  const id = uuidv4();
  const output = `/tmp/video-${id}.mp4`;
  const imagePath = `/tmp/bg-${id}.jpg`;
  const audioPath = `/tmp/audio-${id}.mp3`;

  // Fonction pour télécharger un fichier
  const download = (url, path) => {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(path, () => reject(err));
      });
    });
  };

  try {
    await download(imageUrl, imagePath);
    await download(audioUrl, audioPath);

    ffmpeg()
      .input(imagePath)
      .loop()
      .input(audioPath)
      .videoCodec('libx264')
      .size('1080x1920')
      .outputOptions('-pix_fmt yuv420p')
      .duration(30)
      .save(output)
      .on('end', () => {
        res.sendFile(output);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).send('Error during video processing');
      });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Error downloading files');
  }
});

app.listen(3000, () => {
  console.log('Server ready on port 3000');
});
