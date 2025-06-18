const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  try {
    const { audioUrl, imageUrl, text } = req.body;
    if (!audioUrl || !imageUrl || !text) {
      return res.status(400).json({ error: 'Missing required fields: audioUrl, imageUrl, text' });
    }

    const download = (url, dest) => {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(new URL(url), (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download file from ${url}. Status code: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        }).on('error', reject);
      });
    };

    const audioPath = path.join(__dirname, 'audio.mp3');
    const imagePath = path.join(__dirname, 'image.png');
    const outputPath = path.join(__dirname, 'output.mp4');

    await download(audioUrl, audioPath);
    await download(imageUrl, imagePath);

    const escapedText = text.replace(/'/g, "\\'").replace(/:/g, '\\:');

    const ffmpegCommand = `ffmpeg -loop 1 -i "${imagePath}" -i "${audioPath}" -vf "drawtext=text='${escapedText}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-th-30" -shortest -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p "${outputPath}"`;

    exec(ffmpegCommand, (err) => {
      if (err) {
        console.error('FFmpeg error:', err);
        return res.status(500).json({ error: 'Video generation failed.' });
      }

      res.sendFile(outputPath, () => {
        fs.unlinkSync(audioPath);
        fs.unlinkSync(imagePath);
        fs.unlinkSync(outputPath);
      });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(port, () => {
  console.log(`Server ready on port ${port}`);
});
