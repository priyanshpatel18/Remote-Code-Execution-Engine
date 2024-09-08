import Docker from 'dockerode';
import express, { Request, Response } from 'express';
import tar from 'tar-stream';
import cors from "cors";

const app = express();
const docker = new Docker();

app.use(express.json());
app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

interface RunCodeRequest {
  language: string;
  code: string;
}

app.post('/run', async (req: Request, res: Response) => {
  const { language, code } = req.body as RunCodeRequest;

  if (!language || !code) {
    return res.status(400).json({ result: 'Language and code are required.' });
  }

  try {
    const result = await executeCode(language, code);
    res.json({ result });
  } catch (error) {
    console.log(error);
    let errorMessage = 'Error executing code.';

    if (error instanceof Error) {
      if (error.message === 'Execution timed out') {
        errorMessage = 'Execution timed out';
      }
      res.status(500).json({ result: errorMessage });
    } else {
      res.status(500).json({ result: errorMessage, error: 'An unknown error occurred' });
    }
  }
});

function getDockerImage(language: string): string | null {
  const images: { [key: string]: string } = {
    python: 'python:alpine',
    js: 'node:22-alpine',
    ts: 'priyanshptl18/ts-custom:latest',
    c: 'gcc:13.3',
    cpp: 'gcc:13.3',
    java: 'openjdk:19-alpine',
  };
  return images[language] || null;
}

function getFileName(language: string): string {
  const extensions: { [key: string]: string } = {
    python: 'script.py',
    js: 'script.js',
    ts: 'script.ts',
    c: 'script.c',
    cpp: 'script.cpp',
    java: 'Main.java',
  };
  return extensions[language];
}

function getExecutionCommand(language: string, fileName: string): string[] {
  const commands: { [key: string]: string[] } = {
    python: ['python3', fileName],
    js: ['node', fileName],
    ts: ['ts-node', fileName],
    c: ['sh', '-c', `gcc ${fileName} -o script && ./script`],
    cpp: ['sh', '-c', `g++ ${fileName} -o script && ./script`],
    java: ['sh', '-c', `javac ${fileName} && java Main`],
  };
  return commands[language];
}

async function executeCode(language: string, code: string): Promise<string> {
  const image = getDockerImage(language);
  if (!image) {
    throw new Error('Unsupported language.');
  }

  const fileName = getFileName(language);
  const cmd = getExecutionCommand(language, fileName);

  await pullDockerImage(image);

  const container = await docker.createContainer({
    Image: image,
    Cmd: cmd,
    Tty: false,
    AttachStdout: true,
    AttachStderr: true,
    HostConfig: {
      AutoRemove: true,
      NetworkMode: 'none',
      Memory: 64 * 1024 * 1024, // 64MB
      CpuShares: 512,
    },
    WorkingDir: '/usr/src/app',
  });

  const tarStream = createTarStream(fileName, code);
  await container.putArchive(tarStream, { path: '/usr/src/app' });

  const timeout = 10000; // Set a timeout limit (e.g., 10 seconds)
  let timeoutHandle: NodeJS.Timeout | null = null;

  const dataPromise = startContainerAndGetOutput(container);

  // Create a promise that will reject if the timeout is reached
  const timeoutPromise = new Promise<string>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Execution timed out')), timeout);
  });

  try {
    // Race between the container output promise and the timeout promise
    const output = await Promise.race([dataPromise, timeoutPromise]);
    return output
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}


function createTarStream(fileName: string, code: string): NodeJS.ReadableStream {
  const pack = tar.pack();
  pack.entry({ name: fileName }, code);
  pack.finalize();
  return pack;
}

async function startContainerAndGetOutput(container: Docker.Container): Promise<string> {
  // Attach to the container's output streams
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });

  return new Promise((resolve, reject) => {
    let output = '';
    // This line splits the combined stdout and stderr streams coming from the Docker container
    // and pipes them to the local terminal's process.stdout and process.stderr, allowing
    // the container's output to be displayed in real-time in the terminal.
    // We remove it if we want to capture and store the output instead of logging it.

    // container.modem.demuxStream(stream, process.stdout, process.stderr);

    // Read the container's output streams and append them to the output variable
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    // Resolve the promise when the container exits
    stream.on('end', () => resolve(output));
    stream.on('error', (err) => reject(err));

    // Start the container
    container.start((err) => {
      if (err) return reject(err);
    });
  });
}

async function pullDockerImage(image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: any, stream: any) => {
      if (err) return reject(err);
      docker.modem.followProgress(
        stream,
        (err) => (err ? reject(err) : resolve()),
      );
    });
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
