import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import * as pty from 'node-pty';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

function getDirname(importMetaUrl) {
  return path.dirname(fileURLToPath(importMetaUrl));
}
const __dirname = getDirname(import.meta.url);
const app = express();
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure TEMP_DIR exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }),
);

// Function to create a process
function createPtyProcess(command) {
  try {
    const shell = process.env.SHELL || 'bash';
    const args = ['-c', command];

    return pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 200,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });
  } catch (error) {
    console.error('Failed to create PTY process:', error);
    return null;
  }
}

function getFileName(language) {
  const extensions = {
    python: 'script.py',
    js: 'script.js',
    ts: 'script.ts',
    c: 'script.c',
    cpp: 'script.cpp',
    java: 'Main.java',
  };
  return extensions[language];
}

function getExecutionCommand(language, fileName) {
  const filePath = path.join(TEMP_DIR, fileName);
  const commands = {
    python: `python3 ${filePath}`,
    js: `node ${filePath}`,
    ts: `tsc ${filePath} && node ${filePath.replace('.ts', '.js')}`,
    c: `gcc ${filePath} -o ${path.join(TEMP_DIR, 'script')} && ${path.join(TEMP_DIR, 'script')}`,
    cpp: `g++ ${filePath} -o ${path.join(TEMP_DIR, 'script')} && ${path.join(TEMP_DIR, 'script')}`,
    java: `javac ${filePath} && java -cp ${TEMP_DIR} Main`,
  };
  return commands[language];
}

app.post('/execute', async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({ result: 'Language and code are required.' });
  }

  const fileName = getFileName(language);
  if (!fileName) {
    return res.status(400).json({ result: 'Invalid language.' });
  }

  const filePath = path.join(TEMP_DIR, fileName);
  const executionCommand = getExecutionCommand(language, fileName);

  fs.writeFile(filePath, code, (err) => {
    if (err) {
      console.error('Failed to write file:', err);
      return res.status(500).json({ result: 'Failed to write file.' });
    }

    // Create a PTY process
    const ptyProcess = createPtyProcess(executionCommand);
    if (!ptyProcess) {
      return res.status(500).json({ result: 'Failed to create PTY process' });
    }

    let outputBuffer = '';

    ptyProcess.on('data', (data) => {
      outputBuffer += data;
    });

    ptyProcess.on('exit', () => {
      // Clean up the temporary file
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Failed to delete file:', err);
        }
      });

      // Send the output once the process exits
      return res.status(200).json({ result: outputBuffer });
    });
  });
});

const PORT = Number(process.env.PORT) || 5555;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
