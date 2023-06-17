import AWS from "aws-sdk";

export class AwsPollyClient {
  polly: AWS.Polly;
  voiceId: string;

  constructor() {
    const region = "us-east-1";
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region,
    });

    this.voiceId = "Joanna";

    this.polly = new AWS.Polly();
  }

  public say = (str: string) => {
    const params = {
      Text: str,
      OutputFormat: "mp3",
      VoiceId: this.voiceId,
    };

    return new Promise((resolve, reject) => {
      this.polly.synthesizeSpeech(
        params,
        (err: AWS.AWSError, data: AWS.Polly.SynthesizeSpeechOutput) => {
          if (err) {
            console.log(err.code);
            reject(err);
          } else if (data) {
            if (data.AudioStream instanceof Buffer) {
              resolve(data.AudioStream);
            }
          }
        }
      );
    });
  };
}
