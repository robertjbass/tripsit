import express, { Request, Response, text } from "express";
import cors from "cors";
import "dotenv/config";
import { OpenAiClientManager } from "./openAiClient";
import { AwsPollyClient } from "./pollyClient";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const pollyClient = new AwsPollyClient();
const openAiClientManager = new OpenAiClientManager();

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

app.get("/connect", (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;

  if (!sessionId) {
    console.log("Missing session_id query parameter");
    return res.status(400).send("Missing session_id query parameter");
  }

  const openAiClient = openAiClientManager.getInstance(sessionId);

  //? Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  //? Add the connection to the client manager so it can send streaming responses
  openAiClient.addConnection(req, res);

  //? Close connection when client closes it
  req.on("close", () => res.end());
});

app.post("/synthesize", async (req: Request, res: Response) => {
  try {
    const text = req.body.sentence;
    const audioBuffer = await pollyClient.synthesize(text);

    if (audioBuffer) {
      const audioBase64 = audioBuffer.toString("base64");
      res.json({ audio: audioBase64 });
    } else {
      throw new Error("Audio synthesis failed");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
