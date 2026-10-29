import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const CATEGORIES = ["cafe", "restaurant", "bakery", "salon", "gym", "bar"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();
  const { data: shops } = await supabase
    .from("restaurants")
    .select("slug, updated_at")
    .eq("is_active", true)
    .limit(5000);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/pricing`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/legal`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE}/explore?category=${c}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const shopRoutes: MetadataRoute.Sitemap = (shops ?? []).map((s) => ({
    url: `${SITE}/shop/${s.slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  return [...staticRoutes, ...categoryRoutes, ...shopRoutes];
}
