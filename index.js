const express = require('express');
const https = require('https');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Route POST /generate
app.post('/generate', async (req, res) => {
  const audioUrl = req.body.audioUrl;
  const imageUrl = req.body.imageUrl;
  const subtitleText = req.body.text;

  if (!audioUrl || !imageUrl || !subtitleText) {
    return res.status(400).json({ error: 'audioUrl, imageUrl and text are required' });
  }

  const id = uuidv4();
  const output = `/tmp/video-${id}.mp4`;
  const imagePath = `/tmp/bg-${id}.jpg`;
  const audioPath = `/tmp/audio-${id}.mp3`;

  // Fonction pour télécharger un fichier
  const download = (url, path) =>
    new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path);
      https.get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", (err) => {
        console.error("Erreur de téléchargement :", err.message);
        reject(err);
      });
    });

  try {
    await download(imageUrl, imagePath);
    await download(audioUrl, audioPath);

    ffmpeg()
      .input(imagePath)
      .loop(30)
      .addInput(audioPath)
      .videoFilters([
        {
          filter: 'drawtext',
          options: {
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            text: subtitleText,
            fontsize: 48,
            fontcolor: 'white',
            x: '(w-text_w)/2',
            y: 'h-(text_h*2)',
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 5,
            line_spacing: 10,
          },
        }
      ])
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});
