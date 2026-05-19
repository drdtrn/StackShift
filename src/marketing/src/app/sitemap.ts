import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://stacksift.io",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://stacksift.io/about",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
