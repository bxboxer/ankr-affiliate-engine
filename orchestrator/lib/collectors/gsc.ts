import { google } from "googleapis";
import { getGSCOAuth2Client } from "../google-auth";
import { log } from "../utils";

export interface GSCPageData {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export class GSCCollector {
  private searchconsole;

  constructor() {
    const auth = getGSCOAuth2Client();
    this.searchconsole = google.searchconsole({ version: "v1", auth });
  }

  async getPagePerformance(
    siteUrl: string,
    days: number = 28
  ): Promise<GSCPageData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    try {
      const res = await this.searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["page"],
          rowLimit: 500,
        },
      });

      return (res.data.rows ?? []).map((row) => ({
        url: row.keys![0],
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }));
    } catch (err) {
      log.warn(`GSC page performance query failed: ${err}`);
      return [];
    }
  }

  async getTopQueries(
    siteUrl: string,
    days: number = 28
  ): Promise<GSCQueryData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    try {
      const res = await this.searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["query"],
          rowLimit: 500,
        },
      });

      return (res.data.rows ?? []).map((row) => ({
        query: row.keys![0],
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }));
    } catch (err) {
      log.warn(`GSC top queries failed: ${err}`);
      return [];
    }
  }
}
