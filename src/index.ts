import cors from 'cors';
import express, { Request, Response } from 'express';

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

interface Container {
  ip: string;
  port: number;
  busy: boolean;
}

const containers: Container[] = [
  { ip: '172.18.0.2', port: 30007, busy: false },
  { ip: '172.18.0.3', port: 30007, busy: false },
  { ip: '172.18.0.4', port: 30007, busy: false },
];

function selectAvailableContainer(): Container | undefined {
  return containers.find((container) => !container.busy);
}

function stripAnsiCodes(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '');
}

app.post('/run', async (req: Request, res: Response) => {
  const { language, code } = req.body as RunCodeRequest;
  if (!language || !code) {
    return res
      .status(400)
      .json({ result: 'Language and code are required.', success: false });
  }

  const container = selectAvailableContainer();
  if (!container) {
    // Push the body to the queue
    return res
      .status(503)
      .json({ result: 'All containers are busy.', success: false });
  }

  try {
    container.busy = true;
    // const response = await fetch(`http://${container.ip}:${container.port}/execute`, {
    const response = await fetch(`http://localhost:5555/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, language }),
    });
    const { result } = await response.json();

    if (result) {
      const cleanedOutput = stripAnsiCodes(result);
      res.status(200).json({ result: cleanedOutput, success: true });
    } else {
      res.status(500).json({ result: 'Failed to run code.', success: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ result: 'Internal Server Error', success: false });
  } finally {
    container.busy = false;
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
