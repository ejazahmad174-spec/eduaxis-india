
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/student/",
      ],
    },
    sitemap: "https://eduaxisindia.com/sitemap.xml",
  };
}
