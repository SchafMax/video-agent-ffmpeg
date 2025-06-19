const express = require('express');
const https = require('https');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/generate', async (req, res) => {
  const { audioUrl, imageUrls, text } = req.body;

  if (!audioUrl || !imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0 || !text) {
    return res.status(400).json({ error: 'audioUrl, imageUrls[] and text are required' });
  }

  const id = uuidv4();
  const output = `/tmp/video-${id}.mp4`;
  const audioPath = `/tmp/audio-${id}.mp3`;
  const subtitleText = text || "Default subtitle text";
  const imagePaths = [];

  const download = (url, path) =>
    new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path);
      https.get(url, response => {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => {
        console.error("Download error:", err.message);
        reject(err);
      });
    });

  try {
    // Téléchargement des images
    for (let i = 0; i < imageUrls.length; i++) {
      const imagePath = `/tmp/image-${id}-${i}.jpg`;
      await download(imageUrls[i], imagePath);
      imagePaths.push(imagePath);
    }

    // Téléchargement audio
    await download(audioUrl, audioPath);

    // Construction du filtre d’images avec effets
    const imageInputs = imagePaths.map(path => `-loop 1 -t 5 -i ${path}`).join(' ');
    const filterComplex = imagePaths
      .map((_, i) => `[${i}:v]scale=1080:1920,zoompan=z='zoom+0.001':d=125:s=1080x1920:fps=25[v${i}]`)
      .join('; ') + `; ` + imagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${imagePaths.length}:v=1:a=0[outv]`;

    ffmpeg()
      .input(audioPath)
      .inputOptions(imageInputs.split(' '))
      .complexFilter([
        filterComplex,
        {
          filter: 'drawtext',
          options: {
            fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            text: subtitleText,
            fontsize: 48,
            fontcolor: 'white',
            x: '(w-text_w)/2',
            y: 'h-text_h-80',
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 5,
            line_spacing: 10
          }
        }
      ], 'outv')
      .videoCodec('libx264')
      .size('1080x1920')
      .outputOptions(['-pix_fmt yuv420p'])
      .output(output)
      .on('end', () => res.sendFile(output))
      .on('error', err => {
        console.error('FFmpeg error:', err.message);
        res.status(500).send('Error during video processing');
      })
      .run();
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).send('Error downloading files');
  }
});

app.listen(10000, () => {
  console.log('Server ready on port 10000');
});
