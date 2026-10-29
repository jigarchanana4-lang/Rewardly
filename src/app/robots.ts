import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Robots — allow search + social crawlers and, deliberately, AI/LLM bots
 * (GEO: generative-engine optimization) so assistants can recommend shops.
 */
export default function robots(): MetadataRoute.Robots {
  const allowAll = ["/"];
  const disallow = ["/owner", "/admin", "/api", "/auth", "/profile", "/pay", "/payment-success"];
  return {
    rules: [
      { userAgent: "*", allow: allowAll, disallow },
      { userAgent: "GPTBot", allow: allowAll },
      { userAgent: "ChatGPT-User", allow: allowAll },
      { userAgent: "OAI-SearchBot", allow: allowAll },
      { userAgent: "Google-Extended", allow: allowAll },
      { userAgent: "PerplexityBot", allow: allowAll },
      { userAgent: "ClaudeBot", allow: allowAll },
      { userAgent: "Applebot-Extended", allow: allowAll },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
