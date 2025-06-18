const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Téléchargement des fichiers
function download(url, path) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Erreur HTTP ${response.statusCode} pour ${url}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(path, () => reject(err));
    });
  });
}

app.post("/generate", async (req, res) => {
  const { audioUrl, imageUrl, text } = req.body;

  const id = uuidv4();
  const audioPath = `audio_${id}.mp3`;
  const imagePath = `image_${id}.jpg`;
  const outputPath = `output_${id}.mp4`;

  try {
    await download(audioUrl, audioPath);
    await download(imageUrl, imagePath);

    // Création de la vidéo avec audio, image de fond et sous-titres
    ffmpeg()
      .input(imagePath)
      .loop(30)
      .input(audioPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mp4")
      .outputOptions([
        "-pix_fmt yuv420p",
        "-shortest",
        "-vf", `scale=720:1280,drawtext=text='${text.replace(/'/g, "\\'")}':fontcolor=white:fontsize=36:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-th-30`
      ])
      .save(outputPath)
      .on("end", () => {
        res.sendFile(outputPath, { root: __dirname }, (err) => {
          if (!err) {
            fs.unlinkSync(audioPath);
            fs.unlinkSync(imagePath);
            fs.unlinkSync(outputPath);
          }
        });
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        res.status(500).send("Erreur lors de la génération de la vidéo.");
      });

  } catch (err) {
    console.error("Erreur générale:", err);
    res.status(500).send("Erreur de traitement.");
  }
});

app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});
