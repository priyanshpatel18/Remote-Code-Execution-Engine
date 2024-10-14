import { db } from "@repo/database";
import { CONNECTED, UPDATE_USER } from "@repo/messages";
import { redisClient } from "@repo/redis";
import { QueuePayload } from "@repo/types";
import "dotenv/config";
import { WebSocket } from "ws";

async function processSubmission(data: QueuePayload, ws: WebSocket) {
  const { code, language, userId, submissionId } = data;

  try {
    // Validate data
    if (!code || !language || !userId || !submissionId) {
      sendMessage("Invalid submission data", userId, ws);
      return;
    }

    // Update submission status
    let submission = await db.submission.update({
      where: { id: submissionId },
      data: { status: "UNDER_EXECUTION" },
    });
    if (!submission) {
      sendMessage("Submission was not saved", userId, ws);
      return;
    }

    // Update user status
    sendMessage("Executing Code", userId, ws);

    // Execute code
    const response = await executeCode(code, language.toLowerCase());
    if (!response.ok) {
      sendMessage("Failed to Execute Code", userId, ws);
      return;
    }

    const data = await response.json();

    // Update submission status & result
    submission = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        result: data.result,
      },
    });
    if (!submission) {
      sendMessage("Failed to Save Result", userId, ws);
      return;
    }

    // Send result
    sendMessage(data.result, userId, ws);
  } catch (error) {
    console.error("Error in processSubmission:", error);
    sendMessage("Error processing submission", userId, ws);
  }
}

function sendMessage(result: any, userId: string, ws: WebSocket) {
  ws.send(
    JSON.stringify({
      type: UPDATE_USER,
      payload: { userId, result },
    })
  );
}

async function executeCode(code: string, language: string) {
  try {
    return await fetch(
      `http://${process.env.CONTAINER_IP}:${process.env.CONTAINER_PORT}/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      }
    );
  } catch (error) {
    console.error("Error during code execution:", error);
    throw error;
  }
}

async function startWorker() {
  const queue = process.env.REDIS_QUEUE || "redis-queue";

  const ws = connectWebSocket();
  console.log("STARTING WORKER");

  const shutdown = async () => {
    console.log("Shutting down worker...");
    // Perform any cleanup operations here
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (true) {
    try {
      // Blocking pop from Redis queue
      const result = await redisClient.brpop(queue, 0);

      if (result) {
        const data = JSON.parse(result[1]) as QueuePayload;
        if (!data) {
          continue;
        }
        await processSubmission(data, ws);
      }
    } catch (error) {
      console.error("Error in startWorkerLoop:", error);
    }
  }
}

function connectWebSocket(): WebSocket {
  let ws = new WebSocket(process.env.WS_URL || "ws://localhost:8080");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === CONNECTED) {
      console.log("WS", CONNECTED);
    }
  });

  ws.on("close", () => {
    console.error("WebSocket connection closed. Reconnecting...");
    setTimeout(() => (ws = connectWebSocket()), 5000);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  return ws;
}

startWorker();