import {
  Polly,
  PollyClientConfig,
  SynthesizeSpeechCommandInput,
} from "@aws-sdk/client-polly";
import { Readable } from "stream";

export class AwsPollyClient {
  polly: Polly;
  voiceId: string;

  constructor() {
    const region = "us-east-1";

    this.voiceId = "Joanna";

    const config: PollyClientConfig = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    };

    this.polly = new Polly(config);
  }

  public synthesize = async (str: string) => {
    const params: SynthesizeSpeechCommandInput = {
      Text: str,
      OutputFormat: "mp3",
      VoiceId: this.voiceId,
    };

    try {
      const data = await this.polly.synthesizeSpeech(params);
      if (data.AudioStream) {
        const audioBuffer = await this.streamToBuffer(data.AudioStream as any);
        return audioBuffer;
      } else {
        console.log("No AudioStream received");
        return undefined;
      }
    } catch (error) {
      console.error("Failed to synthesize speech");
      console.error(error);
      return undefined;
    }
  };

  private streamToBuffer = (stream: Readable): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  };
}
