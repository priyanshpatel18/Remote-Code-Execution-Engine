import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import * as ptyProcess from 'node-pty';
import path from 'path';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }),
);

interface RunCodeRequest {
  language: string;
  code: string;
}

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
  switch (language) {
    case 'python':
      return `python3 ${filePath}`;
    case 'javascript':
      return `node ${filePath}`;
    case 'typescript':
      return `ts-node ${filePath}`;
    case 'c':
      return `gcc ${filePath} && ./a.out`;
    case 'cpp':
      return `g++ ${filePath} && ./a.out`;
    case 'java':
      return `java ${filePath}`;
    default:
      throw new Error('Language not supported');
  }
}

function createPtyProcess(command: string) {
  try {
    const shell = process.env.SHELL || 'bash';
    return ptyProcess.spawn(shell, ['-c', command], {
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

app.post('/execute', async (req: Request, res: Response) => {
  const { language, code } = req.body as RunCodeRequest;
  if (!language || !code) {
    return res
      .status(400)
      .json({ result: 'Language and code are required.', success: false });
  }

  const fileName = getFileName(language);
  const dirPath = path.join(__dirname, 'scripts');
  const filePath = path.join(__dirname, 'scripts', fileName);
  const command = getExecutionCommand(language, filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  try {
    // Write code to file
    await fs.promises.writeFile(filePath, code);

    // Create a PTY process
    const ptyProcess = createPtyProcess(command);
    if (!ptyProcess) {
      return res
        .status(500)
        .json({ result: 'Failed to create PTY process.', success: false });
    }

    let outputBuffer = '';
    ptyProcess.onData((data) => {
      console.log(`Received data from PTY process: ${data}`);
      outputBuffer += data;
    });

    ptyProcess.onExit((exitCode) => {
      return res
        .status(200)
        .json({ result: outputBuffer, exitCode, success: true });
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ result: 'Failed to run code.', success: false });
  } finally {
    fs.promises
      .readdir(dirPath)
      .then((files) => {
        const deletePromises = files.map((file) => {
          return fs.promises.unlink(path.join(dirPath, file));
        });
        return Promise.all(deletePromises);
      })
      .catch((err) => {
        console.error('Failed to empty scripts directory', err);
      });
  }
});

const PORT = Number(process.env.PORT) || 5555;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
