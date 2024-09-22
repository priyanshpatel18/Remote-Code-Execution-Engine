import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import * as ptyProcess from 'node-pty';
import path from 'path';
import tmp from 'tmp';

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }),
);

// Request body
interface RunCodeRequest {
  language: string;
  code: string;
}

// Helpers
function getFileName(language: string) {
  switch (language) {
    case 'python':
      return 'script.py';
    case 'javascript':
      return 'index.js';
    case 'typescript':
      return 'index.ts';
    case 'c':
      return 'index.c';
    case 'cpp':
      return 'index.cpp';
    case 'java':
      return 'Main.java';
    default:
      throw new Error('Language not supported');
  }
}

function getExecutionCommand(language: string, filePath: string) {
  const outputFilePath = path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)),
  );
  switch (language) {
    case 'python':
      return `python3 ${filePath}`;
    case 'javascript':
      return `node ${filePath}`;
    case 'typescript':
      return `tsc ${filePath} && node ${filePath.replace('.ts', '.js')}`;
    case 'c':
      return `gcc ${filePath} -o ${outputFilePath} && ${outputFilePath}`;
    case 'cpp':
      return `g++ ${filePath} -o ${outputFilePath} && ${outputFilePath}`;
    case 'java':
      return `java ${filePath}`;
    default:
      throw new Error('Language not supported');
  }
}

function createPtyProcess(command: string) {
  const shell = process.env.SHELL || 'bash';
  return ptyProcess.spawn(shell, ['-c', command], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env,
  });
}

// Routes
app.post('/execute', async (req: Request, res: Response) => {
  // Validate request
  const { language, code } = req.body as RunCodeRequest;
  if (!language || !code) {
    return res
      .status(400)
      .json({ result: 'Language and code are required.', success: false });
  }

  // Ensure scripts directory exists
  const scriptsDir = path.join(__dirname, 'scripts');
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  // Create temporary file
  const tempFile = tmp.fileSync({ postfix: getFileName(language) });
  const filePath = tempFile.name;
  const command = getExecutionCommand(language, filePath);

  try {
    // Write code to file
    fs.writeFileSync(filePath, code, { encoding: 'utf8' });

    // Execute code
    const pty = createPtyProcess(command);
    if (!pty) {
      return res
        .status(500)
        .json({ result: 'Failed to create PTY process.', success: false });
    }

    // Stream output
    let outputBuffer = '';
    pty.onData((data) => {
      outputBuffer += data;
    });

    // Wait for exit
    pty.onExit((exitCode) => {
      res.status(200).json({ result: outputBuffer, exitCode, success: true });
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ result: 'Failed to run code.', success: false });
  } finally {
    // Cleanup on success or error
    fs.readdir(scriptsDir, (err, files) => {
      if (err) return console.error('Error reading scripts directory:', err);
      files.forEach((file) => {
        const filePath = path.join(scriptsDir, file);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
      });
    });
  }
});

const PORT = Number(process.env.PORT) || 5555;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
