
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://eduaxisindia.com";

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

  return pages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: page === "" ? 1 : 0.8,
  }));
}
