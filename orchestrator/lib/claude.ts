import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function askClaude(
  prompt: string,
  options?: {
    system?: string;
    maxTokens?: number;
    model?: string;
  }
): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: options?.model ?? "claude-sonnet-4-20250514",
    max_tokens: options?.maxTokens ?? 4096,
    system: options?.system,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }

  return "";
}
