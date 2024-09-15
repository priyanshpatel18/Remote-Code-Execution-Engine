import cors from "cors";
import Docker from 'dockerode';
import express, { Request, Response } from 'express';
import tar from 'tar-stream';

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
    const { result, success } = await executeCode(language, code);
    res.json({ result, success });
  } catch (error) {
    console.log(error);
    let errorMessage = 'Error executing code.';

    if (error instanceof Error) {
      errorMessage = `Error executing code: ${error.message}\nStack trace: ${error.stack}`;
    }

    res.status(500).json({ result: errorMessage });
  }
});

function getDockerImage(language: string): string | null {
  const images: { [key: string]: string } = {
    python: 'priyanshptl18/python-custom:latest',
    js: 'priyanshptl18/js-custom:latest',
    ts: 'priyanshptl18/ts-custom:latest',
    c: 'priyanshptl18/clang-custom:latest',
    cpp: 'priyanshptl18/cpp-custom:latest',
    java: 'priyanshptl18/java-custom:latest',
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
    python: ['sh', '-c', `python3 ${fileName}`],
    js: ['sh', '-c', `node ${fileName}`],
    ts: ['sh', '-c', `tsc ${fileName} && node ${fileName.replace('.ts', '.js')}`,],
    c: ['sh', '-c', `gcc ${fileName} -o script && ./script`],
    cpp: ['sh', '-c', `g++ ${fileName} -o script && ./script`],
    java: ['sh', '-c', `time  javac ${fileName} && java Main`],
  };
  return commands[language];
}

async function executeCode(language: string, code: string): Promise<{ result: string, success: boolean }> {
  const image = getDockerImage(language);
  if (!image) {
    return {
      result: 'Invalid language',
      success: false,
    };
  }

  const fileName = getFileName(language);
  const cmd = getExecutionCommand(language, fileName);

  await pullDockerImage(image);

  const container = await docker.createContainer({
    Image: image,
    Cmd: cmd,
    Tty: false, // Do not allocate a TTY
    AttachStdout: true, // Attach stdout to the container
    AttachStderr: true, // Attach stderr to the container
    HostConfig: {
      AutoRemove: true, // Remove the container when it exits
      NetworkMode: 'none', // No Network Access
      Memory: 64 * 1024 * 1024, // 64MB
      CpuShares: 512, // Limit to 512 CPU shares
      SecurityOpt: ['seccomp:unconfined', 'apparmor:unconfined', 'no-new-privileges'], // Isolation of Container
    },
    WorkingDir: '/usr/src/app',
    User: 'codeuser',
  });

  const tarStream = createTarStream(fileName, code);
  await container.putArchive(tarStream, { path: '/usr/src/app' });

  const timeout = 10000;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const dataPromise = startContainerAndGetOutput(container);

  // Create a promise that will reject if the timeout is reached
  const timeoutPromise = new Promise<string>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Execution timed out')), timeout);
  });

  try {
    // Race between the container output promise and the timeout promise
    const output = await Promise.race([dataPromise, timeoutPromise]);
    return {
      result: output,
      success: true,
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Execution timed out') {
      return { result: 'Execution timed out', success: false };
    } throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}


function createTarStream(fileName: string, code: string): NodeJS.ReadableStream {
  const pack = tar.pack();
  pack.entry({ name: fileName, mode: 0o755 }, code);
  // Ensure executable permissions by mode = 0o755
  pack.finalize();
  return pack;
}

async function startContainerAndGetOutput(container: Docker.Container): Promise<string> {
  // Attach to the container's output streams
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
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
    stream.on('error', (chunk) => {
      errorOutput += chunk.toString();
    });
    stream.on('end', () => {
      if (errorOutput) {
        reject(new Error(errorOutput));
      } else {
        resolve(output);
      }
    });

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
