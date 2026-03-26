export class VercelClient {
  private token: string;
  private teamId?: string;

  constructor(token: string, teamId?: string) {
    this.token = token;
    this.teamId = teamId;
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = new URL(`https://api.vercel.com${path}`);
    if (this.teamId) {
      url.searchParams.set("teamId", this.teamId);
    }

    const res = await fetch(url.toString(), {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vercel API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async createProject(name: string, gitRepo: { owner: string; repo: string }) {
    return this.request("/v10/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        framework: "nextjs",
        gitRepository: {
          type: "github",
          repo: `${gitRepo.owner}/${gitRepo.repo}`,
        },
      }),
    });
  }

  async addDomain(projectId: string, domain: string) {
    return this.request(`/v10/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  }

  async getProject(nameOrId: string) {
    return this.request(`/v9/projects/${nameOrId}`);
  }

  async listProjects() {
    return this.request("/v9/projects");
  }
}
