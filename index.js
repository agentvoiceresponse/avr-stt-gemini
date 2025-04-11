/**
 * AVR Speech-to-Text Service using Google Gemini
 * 
 * This service receives audio data, converts it to FLAC format,
 * and uses Google's Gemini API to transcribe the speech to text.
 * 
 * @author Agent Voice Response <info@agentvoiceresponse.com>
 * @contributors Giuseppe Careri <info@gcareri.com>, seif walid mamdouh
 * @version 1.0.0
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { StreamEncoder } = require('flac-bindings');

// Load .env file from the current directory
require("dotenv").config({ path: path.join(__dirname, '.env') });

const app = express();

// --- Configuration ---
// Create a temporary directory for FLAC files within this service's folder
const tempDir = path.join(__dirname, 'temp_audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware to parse raw binary data (audio buffer)
// Increase limit as needed for longer audio segments
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// --- Initialize Gemini ---
let model = null;
try {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not found in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or your preferred model
    console.log("[Transcription Service] Google Generative AI Client Initialized.");
} catch(err) {
    console.error("!!! FATAL ERROR: Failed to initialize Google Generative AI Client:", err);
    console.error("Ensure GEMINI_API_KEY is set correctly in the .env file in the project root.");
    process.exit(1); // Exit if Gemini setup fails
}


// --- FLAC Creation Function ---
/**
 * Creates a FLAC file from raw audio data
 * @param {Buffer} audioData - Raw audio data (PCM)
 * @param {string} outputPath - Path to save the FLAC file
 * @param {number} sampleRate - The sample rate of the audioData (e.g., 16000)
 * @returns {Promise<void>}
 */
async function createFlacFile(audioData, outputPath, sampleRate) {
  return new Promise((resolve, reject) => {
    if (!audioData || audioData.length === 0) {
        return reject(new Error("Cannot create FLAC from empty audio data."));
    }
    const writeStream = fs.createWriteStream(outputPath);
    const encoder = new StreamEncoder({
      channels: 1, // Assuming mono
      bitsPerSample: 16, // Assuming 16-bit PCM
      samplerate: 8000, // Hardcode to 8000 Hz
      compressionLevel: 5 // Default compression
    });

    encoder.on('verify', (ok) => {
        if (!ok) console.warn(`[createFlacFile] FLAC verification failed for ${outputPath}`);
    });
    encoder.on('error', (err) => { console.error(`FLAC encoder error for ${outputPath}:`, err); reject(err); });
    writeStream.on('error', (err) => { console.error(`Write stream error for ${outputPath}:`, err); reject(err); });
    encoder.pipe(writeStream);
    writeStream.on('finish', () => {
      console.log(`[createFlacFile] FLAC file created successfully at ${outputPath} (Forced 8000 Hz)`);
      resolve();
    });
    writeStream.on('close', () => {
         // Ensure file handle is released, though finish should be sufficient
         // console.log(`[createFlacFile] Write stream closed for ${outputPath}`);
    });

    try {
      encoder.write(audioData);
      encoder.end();
    } catch (err) {
      console.error(`Error writing audio data to FLAC encoder for ${outputPath}:`, err);
      reject(err);
    }
  });
}

// --- Transcription Handler ---
const handleTranscriptionRequest = async (req, res) => {
  console.log(`\n[${new Date().toISOString()}] Transcription Service: Received request on /transcribe`);

  if (!model) {
     console.error("[Transcription Service] Gemini model not initialized.");
     return res.status(503).json({ message: "Transcription service not ready." });
  }

  // Get raw audio buffer from request body
  const audioBuffer = req.body;
  // Get sample rate from header (sent by VAD service)
  const sampleRateHeader = req.headers['x-sample-rate'];
  const sampleRate = parseInt(sampleRateHeader, 10);

  if (!audioBuffer || audioBuffer.length === 0) {
    console.error("[Transcription Service] Received empty audio buffer.");
    return res.status(400).json({ message: "Empty audio data received." });
  }
  if (!sampleRate || isNaN(sampleRate)) {
       console.error(`[Transcription Service] Invalid or missing X-Sample-Rate header: ${sampleRateHeader}`);
       return res.status(400).json({ message: "Missing or invalid X-Sample-Rate header." });
   }

  console.log(`[Transcription Service] Received audio buffer: ${(audioBuffer.length / 1024).toFixed(2)} KB, Sample Rate: ${sampleRate} Hz`);

  const tempFlacPath = path.join(tempDir, `audio-${Date.now()}.flac`);

  try {
    // 1. Create FLAC file from the raw buffer
    console.log(`[Transcription Service] Creating FLAC file at ${tempFlacPath}`);
    await createFlacFile(audioBuffer, tempFlacPath, sampleRate);

    // 2. Read the created FLAC file
     if (!fs.existsSync(tempFlacPath)) {
         throw new Error(`FLAC file was not created successfully at ${tempFlacPath}`);
     }
     console.log(`[Transcription Service] Reading FLAC file: ${tempFlacPath}`);
     const fileContent = fs.readFileSync(tempFlacPath);

    // 3. Verify FLAC header (optional but recommended)
     if (!fileContent.toString('utf8', 0, 4).startsWith('fLaC')) {
       throw new Error('Temporary file is not a valid FLAC file');
     }
     console.log("[Transcription Service] FLAC file verified.");

    // 4. Convert audio to base64
    const audioBase64 = fileContent.toString('base64');
    console.log(`[Transcription Service] Converted FLAC to Base64 (${(audioBase64.length / 1024).toFixed(2)} KB)`);

    // 5. Prepare request for Gemini
    const prompt = "Please transcribe this audio accurately."; // Customize as needed
    const requestPayload = [
      prompt,
      {
        inlineData: {
          mimeType: "audio/flac", // Gemini needs to know the format
          data: audioBase64
        }
      }
    ];

    // 6. Generate content with Gemini
    console.log("[Transcription Service] Sending request to Gemini API...");
    const result = await model.generateContent(requestPayload);
    const response = await result.response;
    const transcription = response.text();

    if (transcription) {
      console.log(`(${new Date().toISOString()}) Transcription Result: ${transcription}`);
      // 7. Send transcription back to the VAD service (or whoever called)
      res.status(200).json({ transcription: transcription });
    } else {
      console.log("[Transcription Service] Gemini returned no transcription text.");
      res.status(200).json({ transcription: "[No transcription]" }); // Send empty transcription indication
    }

  } catch (err) {
    console.error(`[Transcription Service] Error during transcription process:`, err);
    res.status(500).json({ message: `Transcription failed: ${err.message}` });
  } finally {
    // 8. Clean up the temporary FLAC file (COMMENTED OUT TO SAVE FILES)
    
    if (fs.existsSync(tempFlacPath)) {
      fs.unlink(tempFlacPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`[Transcription Service] Error deleting temporary file ${tempFlacPath}:`, unlinkErr);
        } else {
            console.log(`[Transcription Service] Deleted temporary file: ${tempFlacPath}`);
        }
      });
    }
    
  }
};

// --- Route Configuration ---
app.post('/transcribe', handleTranscriptionRequest);

// Start the Transcription server
const TRANSCRIPTION_PORT = process.env.PORT || 6021;
app.listen(TRANSCRIPTION_PORT, () => {
  console.log(`\n=== Transcription Service Started ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Listening on port ${TRANSCRIPTION_PORT}`);
  console.log(`Waiting for audio data on /transcribe`);
  console.log(`Temporary audio directory: ${tempDir}`);
  console.log(`=================================\n`);
});
