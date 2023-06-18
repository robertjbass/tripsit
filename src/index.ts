import { OpenAiClientManager } from "./openAiClient";
import express, { Request, Response, text } from "express";
import cors from "cors";
import "dotenv/config";
import { AwsPollyClient } from "./polly";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const pollyClient = new AwsPollyClient();
const openAiClientManager = new OpenAiClientManager();

// Endpoint for sending a message
app.post("/message", text(), (req: Request, res: Response) => {
  const sessionId = req.headers["x-session-id"] as string;

  if (!sessionId) {
    console.log("Missing X-Session-Id header");
    return res.status(400).send("Missing X-Session-Id header");
  }

  const openAiClient = openAiClientManager.getInstance(sessionId);
  const message = req.body.message;
  openAiClient
    .processMessage(message)
    .then(() => res.status(200).send())
    .catch((err) => {
      console.error(err);
      res.status(500).send(err.message);
    });
});

// Endpoint for adding a connection
app.get("/connect", (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;

  if (!sessionId) {
    console.log("Missing session_id query parameter");
    return res.status(400).send("Missing session_id query parameter");
  }

  const openAiClient = openAiClientManager.getInstance(sessionId);

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Flush the headers to establish SSE with client
  res.flushHeaders();

  openAiClient.addConnection(req, res);

  // If the connection is closed by the client, remove it
  req.on("close", () => res.end());
});

app.post("/synthesize", async (req: Request, res: Response) => {
  try {
    const text = req.body.sentence;
    const audioBuffer = (await pollyClient.say(text)) as any;
    const audioBase64 = audioBuffer.toString("base64");
    res.json({ audio: audioBase64 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
