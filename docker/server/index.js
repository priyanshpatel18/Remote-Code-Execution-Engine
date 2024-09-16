import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import * as pty from 'node-pty';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: true,
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

app.post('/execute', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ message: 'Command Required!' });
  }

  const ptyProcess = createPtyProcess(command);
  if (!ptyProcess) {
    return res.status(500).json({ message: 'Failed to create PTY process' });
  }

  try {
    let outputBuffer = '';

    ptyProcess.on('data', (data) => {
      outputBuffer += data;
    });

    ptyProcess.on('exit', () => {
      // Send the output once the process exits
      return res.status(200).json({ outputBuffer });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Failed to execute command' });
  }
});

const PORT = Number(process.env.PORT) || 5555;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
