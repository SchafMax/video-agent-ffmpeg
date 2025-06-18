const express = require('express');
const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(express.json());

app.post('/generate', async (req, res) => {
  const audioUrl = req.body.audioUrl;
  const imageUrl = req.body.imageUrl;
  const id = uuidv4();
  const output = `/tmp/video-${id}.mp4`;
  const imagePath = `/tmp/bg-${id}.jpg`;
  const audioPath = `/tmp/audio-${id}.mp3`;

  const download = (url, path) =>
    new Promise((resolve) => {
      const file = fs.createWriteStream(path);
      https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      });
    });

  await download(imageUrl, imagePath);
  await download(audioUrl, audioPath);

  ffmpeg()
    .input(imagePath)
    .loop()
    .input(audioPath)
    .audioCodec('aac')
    .videoCodec('libx264')
    .size('1080x1920')
    .outputOptions('-pix_fmt yuv420p')
    .duration(30)
    .save(output)
    .on('end', () => {
      res.sendFile(output);
    });
});

app.listen(3000, () => {
  console.log('Server ready on port 3000');
});
