import { getAdsOAuth2Client } from "../google-auth";
import { log } from "../utils";

export interface KeywordIdea {
  keyword: string;
  avgMonthlySearches: number;
  competition: "LOW" | "MEDIUM" | "HIGH" | "UNSPECIFIED";
  competitionIndex: number;
  lowTopOfPageBidMicros: number;
  highTopOfPageBidMicros: number;
}

const ADS_API_VERSION = "v17";
const ADS_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;

export class KeywordPlannerCollector {
  private developerToken: string;
  private mccId: string;

  constructor() {
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
    this.mccId = process.env.GOOGLE_ADS_MCC_ID!;
  }

  private async getAccessToken(): Promise<string> {
    const client = getAdsOAuth2Client();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Failed to get Google Ads access token");
    return token;
  }

  async getKeywordIdeas(
    seedKeywords: string[],
    geo: string = "2840" // US
  ): Promise<KeywordIdea[]> {
    if (!this.developerToken || !this.mccId) {
      log.warn("Google Ads credentials not configured — skipping Keyword Planner");
      return [];
    }

    try {
      const accessToken = await this.getAccessToken();

      const res = await fetch(
        `${ADS_BASE}/customers/${this.mccId}:generateKeywordIdeas`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": this.developerToken,
            "login-customer-id": this.mccId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            keywordSeed: { keywords: seedKeywords },
            geoTargetConstants: [`geoTargetConstants/${geo}`],
            language: "languageConstants/1000", // English
            keywordPlanNetwork: "GOOGLE_SEARCH",
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        log.warn(`Keyword Planner API error ${res.status}: ${errText.slice(0, 300)}`);
        return [];
      }

      const data = await res.json();
      return (data.results ?? []).map(
        (r: {
          text: string;
          keywordIdeaMetrics?: {
            avgMonthlySearches?: string;
            competition?: string;
            competitionIndex?: string;
            lowTopOfPageBidMicros?: string;
            highTopOfPageBidMicros?: string;
          };
        }) => ({
          keyword: r.text,
          avgMonthlySearches: Number(
            r.keywordIdeaMetrics?.avgMonthlySearches ?? 0
          ),
          competition:
            (r.keywordIdeaMetrics?.competition as KeywordIdea["competition"]) ??
            "UNSPECIFIED",
          competitionIndex: Number(
            r.keywordIdeaMetrics?.competitionIndex ?? 0
          ),
          lowTopOfPageBidMicros: Number(
            r.keywordIdeaMetrics?.lowTopOfPageBidMicros ?? 0
          ),
          highTopOfPageBidMicros: Number(
            r.keywordIdeaMetrics?.highTopOfPageBidMicros ?? 0
          ),
        })
      );
    } catch (err) {
      log.warn(`Keyword Planner failed: ${err}`);
      return [];
    }
  }

  async getKeywordIdeasForUrl(url: string): Promise<KeywordIdea[]> {
    if (!this.developerToken || !this.mccId) {
      log.warn("Google Ads credentials not configured — skipping URL research");
      return [];
    }

    try {
      const accessToken = await this.getAccessToken();

      const res = await fetch(
        `${ADS_BASE}/customers/${this.mccId}:generateKeywordIdeas`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": this.developerToken,
            "login-customer-id": this.mccId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urlSeed: { url },
            geoTargetConstants: ["geoTargetConstants/2840"],
            language: "languageConstants/1000",
            keywordPlanNetwork: "GOOGLE_SEARCH",
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        log.warn(`URL keyword research error ${res.status}: ${errText.slice(0, 300)}`);
        return [];
      }

      const data = await res.json();
      return (data.results ?? []).map(
        (r: {
          text: string;
          keywordIdeaMetrics?: {
            avgMonthlySearches?: string;
            competition?: string;
            competitionIndex?: string;
            lowTopOfPageBidMicros?: string;
            highTopOfPageBidMicros?: string;
          };
        }) => ({
          keyword: r.text,
          avgMonthlySearches: Number(
            r.keywordIdeaMetrics?.avgMonthlySearches ?? 0
          ),
          competition:
            (r.keywordIdeaMetrics?.competition as KeywordIdea["competition"]) ??
            "UNSPECIFIED",
          competitionIndex: Number(
            r.keywordIdeaMetrics?.competitionIndex ?? 0
          ),
          lowTopOfPageBidMicros: Number(
            r.keywordIdeaMetrics?.lowTopOfPageBidMicros ?? 0
          ),
          highTopOfPageBidMicros: Number(
            r.keywordIdeaMetrics?.highTopOfPageBidMicros ?? 0
          ),
        })
      );
    } catch (err) {
      log.warn(`URL keyword research failed: ${err}`);
      return [];
    }
  }
}
