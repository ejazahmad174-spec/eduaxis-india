
import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://eduaxisindia.com";

  // Existing static pages
  const pages = [
    "",
    "/author",
    "/blogs",
    "/career-updates",
    "/courses",
    "/government-jobs",
    "/mock-tests",
    "/study-materials",
  ];

  const staticPages: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: page === "" ? 1 : 0.8,
  }));

  // Fetch published blog articles
  let blogArticles: { slug: string; published_at: string | null }[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("blog_articles")
      .select("slug, published_at")
      .eq("status", "published");

    if (!error && data) {
      blogArticles = data;
    }
  }

  // Add individual blog article URLs
  const blogPages: MetadataRoute.Sitemap = blogArticles
    .filter((article) => article.slug)
    .map((article) => ({
      url: `${baseUrl}/blogs/${article.slug}`,
      lastModified: article.published_at
        ? new Date(article.published_at)
        : new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [...staticPages, ...blogPages];
}
