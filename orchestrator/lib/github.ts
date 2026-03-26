export class GitHubClient {
  private token: string;
  private owner: string;

  constructor(token: string, owner: string) {
    this.token = token;
    this.owner = owner;
  }

  private async request(path: string, options: RequestInit = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async createRepoFromTemplate(templateRepo: string, newRepoName: string, description: string) {
    return this.request(`/repos/${this.owner}/${templateRepo}/generate`, {
      method: "POST",
      body: JSON.stringify({
        owner: this.owner,
        name: newRepoName,
        description,
        private: false,
      }),
    });
  }

  async getRepo(repoName: string) {
    return this.request(`/repos/${this.owner}/${repoName}`);
  }

  async createOrUpdateFile(repoName: string, path: string, content: string, message: string) {
    const encoded = Buffer.from(content).toString("base64");

    // Check if file exists to get SHA
    let sha: string | undefined;
    try {
      const existing = await this.request(
        `/repos/${this.owner}/${repoName}/contents/${path}`
      );
      sha = existing?.sha;
    } catch {
      // File doesn't exist, that's fine
    }

    return this.request(`/repos/${this.owner}/${repoName}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: encoded,
        sha,
      }),
    });
  }
}
