import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const detectSchema = z.object({
  domain: z.string().min(1),
});

/**
 * Auto-detect site metadata from a domain.
 * Fetches the live site, extracts title/description/meta,
 * and infers niche, repo name, and affiliate info.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = detectSchema.parse(body);

    // Normalize domain (strip protocol, trailing slash)
    const cleanDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")
      .toLowerCase();

    // Fetch the live site
    let html = "";
    let fetchError = "";
    for (const proto of ["https://", "http://"]) {
      try {
        const res = await fetch(`${proto}${cleanDomain}`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; ANKR-Engine/1.0; +https://ankr.dev)",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          html = await res.text();
          break;
        }
      } catch (e) {
        fetchError = String(e);
      }
    }

    // Extract metadata from HTML
    const title = extractMeta(html, "title") || titleCase(cleanDomain.split(".")[0]);
    const description = extractMeta(html, "description") || "";
    const ogTitle = extractMeta(html, "og:title") || "";
    const ogDescription = extractMeta(html, "og:description") || "";

    // Detect affiliate tags in page HTML
    const amazonTag = detectAmazonTag(html);
    const affiliateProgram = amazonTag ? "amazon" : detectAffiliateProgram(html);

    // Infer niche from title + description
    const niche = inferNiche(title, description, ogDescription, cleanDomain);

    // Generate repo name from domain
    const repoName = cleanDomain
      .replace(/\.(com|net|org|io|co|dev)$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Generate a friendly site name from the domain or title
    const siteName = ogTitle || title || titleCase(repoName.replace(/-/g, " "));

    return NextResponse.json({
      domain: cleanDomain,
      name: siteName,
      niche,
      repo_name: repoName,
      affiliate_program: affiliateProgram,
      affiliate_tag: amazonTag || "",
      description: ogDescription || description,
      detected: {
        title,
        description,
        ogTitle,
        ogDescription,
        htmlLength: html.length,
        fetchError: html ? null : fetchError,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid domain", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Detection failed", detail: String(error) },
      { status: 500 }
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractMeta(html: string, key: string): string {
  if (!html) return "";

  // <title>...</title>
  if (key === "title") {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : "";
  }

  // <meta name="..." content="..."> or <meta property="..." content="...">
  const patterns = [
    new RegExp(
      `<meta\\s+(?:name|property)=["']${escapeRegex(key)}["']\\s+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta\\s+content=["']([^"']+)["']\\s+(?:name|property)=["']${escapeRegex(key)}["']`,
      "i"
    ),
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectAmazonTag(html: string): string {
  // Look for Amazon affiliate tags like tag=bestgamingb04-20 or ?tag=xxx
  const m = html.match(/[?&]tag=([a-z0-9]+-\d{2})/i);
  return m ? m[1] : "";
}

function detectAffiliateProgram(html: string): string {
  if (html.includes("amazon.com") || html.includes("amzn.to")) return "amazon";
  if (html.includes("impact.com") || html.includes("sjv.io")) return "impact";
  if (html.includes("shareasale.com")) return "shareasale";
  if (html.includes("partnerstack.com")) return "partnerstack";
  return "amazon"; // default
}

function inferNiche(
  title: string,
  description: string,
  ogDesc: string,
  domain: string
): string {
  const text = `${title} ${description} ${ogDesc} ${domain}`.toLowerCase();

  const niches: [string, string[]][] = [
    ["Gaming Peripherals & Equipment", ["gaming", "gamer", "game", "esports", "controller", "headset", "keyboard", "mouse"]],
    ["Home Office Equipment", ["office", "desk", "ergonomic", "chair", "monitor", "work from home", "remote work"]],
    ["Smart Home Devices", ["smart home", "alexa", "google home", "iot", "automation", "smart speaker"]],
    ["Fitness Equipment", ["fitness", "workout", "exercise", "gym", "training", "yoga", "weight"]],
    ["Outdoor Gear", ["outdoor", "camping", "hiking", "adventure", "trail", "survival"]],
    ["Pet Supplies", ["pet", "dog", "cat", "animal", "puppy", "kitten"]],
    ["Kitchen Gadgets", ["kitchen", "cooking", "chef", "food", "recipe", "appliance"]],
    ["Baby Products", ["baby", "toddler", "infant", "nursery", "parenting"]],
    ["Tech & Electronics", ["tech", "electronic", "gadget", "phone", "laptop", "tablet", "computer"]],
    ["Beauty & Personal Care", ["beauty", "skincare", "makeup", "cosmetic", "hair"]],
    ["Health & Wellness", ["health", "supplement", "vitamin", "wellness", "medical"]],
    ["Automotive", ["car", "auto", "vehicle", "automotive", "truck", "motor"]],
  ];

  let bestMatch = "General Product Reviews";
  let bestScore = 0;

  for (const [niche, keywords] of niches) {
    const score = keywords.filter((k) => text.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = niche;
    }
  }

  return bestMatch;
}

function titleCase(s: string): string {
  return s
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
