
import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://eduaxisindia.com";

  // Static website pages
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

  // Dynamic published blog articles
  let blogArticles: {
    slug: string;
    published_at: string | null;
  }[] = [];

  // Dynamic published career notifications
  let careerUpdates: {
    id: string;
    created_at: string | null;
  }[] = [];

  if (supabase) {
    // Fetch published blogs
    const { data: blogData, error: blogError } = await supabase
      .from("blog_articles")
      .select("slug, published_at")
      .eq("status", "published");

    if (!blogError && blogData) {
      blogArticles = blogData;
    }

    // Fetch published career updates
    const { data: careerData, error: careerError } = await supabase
      .from("career_updates")
      .select("id, created_at")
      .eq("status", "published");

    if (!careerError && careerData) {
      careerUpdates = careerData;
    }
  }

  // Generate blog URLs
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

  // Generate individual career notification URLs
  const careerUpdatePages: MetadataRoute.Sitemap = careerUpdates
    .filter((item) => item.id)
    .map((item) => ({
      url: `${baseUrl}/career-updates/${item.id}`,
      lastModified: item.created_at
        ? new Date(item.created_at)
        : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  // Combine all URLs
  return [
    ...staticPages,
    ...blogPages,
    ...careerUpdatePages,
  ];
}
