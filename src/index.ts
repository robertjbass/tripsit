import { OpenAiClient } from "./openAiClient";
import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import { AwsPollyClient } from "./polly";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const openAiClient = new OpenAiClient();
const pollyClient = new AwsPollyClient();

// Endpoint for sending a message
app.post("/message", express.text(), (req: Request, res: Response) => {
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
  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // flush the headers to establish SSE with client

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

// app.get("/", (_req: Request, res: Response) => {
//   res.json({ message: "Hello World" });
// });

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
