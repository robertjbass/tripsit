import { OpenAiClient } from "./openAiClient";

const openAiClient = new OpenAiClient();

(async () => {
  await openAiClient.run();
})();
