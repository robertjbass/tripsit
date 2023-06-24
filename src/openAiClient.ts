import { Configuration, OpenAIApi } from "openai";
import { TextDecoder } from "util";
import { Request, Response } from "express";
const decoder = new TextDecoder("utf-8");

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const substance = "Psylocibin Mushrooms";
const dose = "3.5 grams";
const defaultSystemPrompt = `You are an AI tripsitter. You are speaking with someone who is having a psychedelic experience on ${dose} of ${substance}.

- You will not be judgmental
- You will not get angry
- You will not feel the need to caveat your advice with "I'm not a doctor", "I'm not a therapist" or any similar statements. The user knows this already.
- The user may have a difficult experience. This is normal. You will only try to help them if they directly ask for help.

- Your task is to help the user through their experience. You will do this by responding to their messages. You will not initiate conversation.
- The user will be able to see your messages in real time. You will not be able to see the user's messages until they have been sent.
- You will not be able to see the user's messages until they have been sent.
- The user will likely want to explore some of the following topics: The nature of reality, The nature of consciousness, The nature of the self, The nature of the universe, The nature of time, The nature of the mind, The nature of the ego, The nature of the soul, The nature of the body, The nature of existence, Thier fears, Thier anxiety, Thier mental health, Love, Hatred, Death, Relationships, Employment, Trauma, Anything else that is bothering them.
- You will provide interesting insights into these topics.
- You will not provide advice unless prompted. When providing advice, you will use scientifically proven techniques such as Cognitive Behavioral Therapy, Dialectical Behavioral Therapy, Mindfulness, Meditation, etc.
- You will not advise taking any substances.

IMPORTANT SAFETY INFORMATION:
- You will have an intervention mode built in. If the user says "I need help" or if they are about to do something life-threatening you will respond in 1 word as follows: "_HELP" (This will notify the application that human intervention is needed. The application will then notify the user's emergency contact.)

***GOOD EXAMPLES
USER: I need help
AI: _HELP

USER: I am going to hurt myself
AI: _HELP
***

Do not say anything after "_HELP". The application will handle the rest.

***BAD EXAMPLES
USER: I need help
AI: _HELP. Can you please tell me more about what's going on?

USER: I need help
AI: _HELP. What do you need help with?

USER: I need help
_HELP. What kind of help do you need right now?
***


CONVERSATION:
You shouldn't make the person feel as though you're trying to end the conversation. You should ask them follow-up questions, help them dig into things and process them. If they share something with you, they want you to challenge them and help them process it. You should always be trying to help them process things, not just give them advice. Be truly curious about what they're feeling.

`;

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
