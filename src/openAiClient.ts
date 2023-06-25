import { Configuration, OpenAIApi } from "openai";
import { TextDecoder } from "util";
import { Request, Response } from "express";
const decoder = new TextDecoder("utf-8");

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const defaultSystemPrompt = `You are a general AI assistant. You are speaking with a human. Your goal is to be as helpful as possible similar to Siri, Alexa, or Google Assistant.`;

class OpenAiClient {
  private openai: OpenAIApi;
  private messages: ChatMessage[];
  private connections: Response[];

  constructor() {
    this.connections = [];
    this.messages = [{ role: "system", content: defaultSystemPrompt }];
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  private async chatCompletion(): Promise<void> {
    const completion: any = await this.openai.createChatCompletion(
      {
        messages: this.messages,
        model: "gpt-3.5-turbo",
        stream: true,
      },
      { responseType: "stream" }
    );

    completion.data.on("data", (chunk: any) => {
      const lines = decoder.decode(chunk).split("\n");
      const mappedLines = lines
        .map((line) => line.replace(/^data: /, "").trim())
        .filter((line) => line !== "" && line !== undefined);

      let sentences: string[] = [];

      for (const line of mappedLines) {
        if (line !== "[DONE]") {
          const parsedLine = JSON.parse(line);
          const { choices } = parsedLine;
          const { delta } = choices[0];
          const { content } = delta;

          if (content) {
            sentences.push(content);
            this.addAssistantMessage(content);
          }
        } else {
          sentences.push(line);
        }
      }

      // Split sentences and send to clients
      const completeMessage = sentences.join(" ");
      const splitSentences = completeMessage
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);
      this.sendSplitSentencesToClient(splitSentences);
    });

    completion.data.on("error", (error: any) => console.error(error));
  }

  private addAssistantMessage(content: string) {
    this.messages.push({ role: "assistant", content });
  }

  private sendSplitSentencesToClient(sentences: string[]) {
    const message = sentences.join("\n");

    this.connections.forEach((res) => {
      res.write(`data: ${message}\n\n`);
    });
  }

  public addConnection(req: Request, res: Response) {
    this.connections.push(res);

    // When the connection is closed, remove it from the array
    req.on("close", () => {
      this.connections = this.connections.filter((conn) => conn !== res);
    });
  }

  public setSystemPrompt(prompt: string) {
    this.messages = [{ role: "system", content: prompt }];
  }

  public async processMessage(message: string) {
    // Add the user's message to the chat history
    this.messages.push({ role: "user", content: message });

    // Get the assistant's response and add it to the chat history
    await this.chatCompletion();
  }
}

export class OpenAiClientManager {
  private instances: { [key: string]: OpenAiClient };

  constructor() {
    this.instances = {};
  }

  public getInstance(sessionId: string): OpenAiClient {
    if (!this.instances[sessionId]) {
      this.instances[sessionId] = new OpenAiClient();
    }

    const instance = this.instances[sessionId];
    return instance;
  }
}
