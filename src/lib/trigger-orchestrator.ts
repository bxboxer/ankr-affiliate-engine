/**
 * Triggers the orchestrator GitHub Actions workflow dispatch.
 * Shared by API route and server actions — no HTTP round-trip needed.
 */
export async function triggerOrchestrator(
  runMode: string
): Promise<{ ok: boolean; error?: string }> {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER ?? "bxboxer";
  const repo = "ankr-affiliate-engine";

  if (!githubToken) {
    return { ok: false, error: "GITHUB_TOKEN not configured" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/orchestrator.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { run_mode: runMode },
        }),
      }
    );

    if (res.status === 204) {
      return { ok: true };
    }

    const errorText = await res.text();
    return { ok: false, error: errorText };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
