const express = require('express');
const https = require('https');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { audioUrl, imageUrls, text, backgroundMusic } = req.body;

  if (!audioUrl || !imageUrls || !text) {
    return res.status(400).json({ error: 'Missing required fields: audioUrl, imageUrls, text' });
  }

  const id = uuidv4();
  const audioPath = `/tmp/audio-${id}.mp3`;
  const musicPath = `/tmp/music-${id}.mp3`;
  const output = `/tmp/video-${id}.mp4`;
  const imagePaths = [];

  const download = (url, path) =>
    new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', (err) => {
        console.error('Download error:', err.message);
        reject(err);
      });
    });

  try {
    // Télécharger les images
    for (let i = 0; i < imageUrls.length; i++) {
      const imgPath = `/tmp/image-${id}-${i}.jpg`;
      await download(imageUrls[i], imgPath);
      imagePaths.push(imgPath);
    }

    // Télécharger l'audio principal
    await download(audioUrl, audioPath);

    // Télécharger la musique de fond si elle existe
    if (backgroundMusic) {
      await download(backgroundMusic, musicPath);
    }

    // Créer le fichier concat list pour les images
    const listPath = `/tmp/list-${id}.txt`;
    const fileList = imagePaths.map(p => `file '${p}'\nduration 6`).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
    fs.writeFileSync(listPath, fileList);

    // Générer le slideshow vidéo
    const slideshowPath = `/tmp/slideshow-${id}.mp4`;
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions('-r 30')
        .size('1080x1920')
        .videoCodec('libx264')
        .output(slideshowPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Préparer la commande finale FFmpeg
    const ffmpegCommand = ffmpeg()
      .input(slideshowPath)
      .input(audioPath);

    if (backgroundMusic) {
      ffmpegCommand.input(musicPath);
    }

    // Construction des filtres complexes dynamiques
    const filters = [`[1:a]volume=1[a1]`];
    if (backgroundMusic) {
      filters.push(`[2:a]volume=0.4[a2]`, `[a1][a2]amix=inputs=2:duration=first[aout]`);
    } else {
      filters.push(`[a1]anull[aout]`);
    }

    // Ajouter le filtre de texte avec échappement
    filters.push({
      filter: 'drawtext',
      options: {
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        text: text.replace(/'/g, "\\'").replace(/:/g, '\\:'),
        fontsize: 48,
        fontcolor: 'white',
        box: 1,
        boxcolor: 'black@0.5',
        boxborderw: 5,
        x: '(w-text_w)/2',
        y: 'h-(text_h*2)',
        line_spacing: 10,
        enable: 'between(t,0,30)'
      }
    });

    ffmpegCommand
      .complexFilter(filters, ['v', 'aout'])
      .map('v')
      .map('[aout]')
      .videoCodec('libx264')
      .audioCodec('aac')
      .duration(30)
      .outputOptions('-pix_fmt yuv420p')
      .save(output)
      .on('end', () => res.sendFile(output))
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).send('Video generation failed.');
      });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Error downloading files.');
  }
});

app.listen(10000, () => {
  console.log('Server ready on port 10000');
});
