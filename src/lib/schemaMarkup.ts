import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SPACES } from "./brand";
import {
  resolveConfiguredSiteUrl as resolveSiteUrl,
  resolvePageUrl,
} from "./siteConfig";

export { resolveSiteUrl, resolvePageUrl };

const SITE_NAME = BRAND_NAME;
const DEFAULT_DESCRIPTION = BRAND_DESCRIPTION;

export function getDefaultDescription(): string {
  return DEFAULT_DESCRIPTION;
}

export function getSiteName(): string {
  return SITE_NAME;
}

export function getOrganizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "ThermalTrace temperature dashboard",
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/logo.svg`,
    },
    image: `${siteUrl}/og-dashboard.jpg`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [
      "https://github.com/doodersrage/thermaltrace",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${siteUrl}/contact`,
    },
  };
}

export function getWebSiteSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/about?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function getSoftwareApplicationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "IoT temperature monitoring",
    operatingSystem: "Web",
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free plan available; Member and Pro paid tiers",
      url: `${siteUrl}/pricing`,
    },
    featureList: [
      "Live temperature, humidity, and air-quality curves",
      "Freeze and leak alerts; custom rules for doors, power, energy, and motion",
      "ESP32 / Arduino or HTTPS JSON ingest",
      "Household sharing",
      "History charts and CSV export",
      "Pro claims evidence pack and guest share links",
      "Push notifications on every plan; SMS and webhook channels on Pro",
    ],
    screenshot: `${siteUrl}/og-dashboard.jpg`,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
    },
  };
}

export function getWebPageSchema(options: {
  siteUrl: string;
  pageUrl: string;
  name: string;
  description: string;
  /** CSS selectors for AEO / speakable content */
  speakableCssSelectors?: string[];
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: options.name,
    description: options.description,
    url: options.pageUrl,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: options.siteUrl,
    },
    about: {
      "@type": "Thing",
      name: "Environmental probe monitoring",
    },
  };

  if (options.speakableCssSelectors?.length) {
    schema.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: options.speakableCssSelectors,
    };
  }

  return schema;
}

/** Stable Article dates when a page omits explicit published/modified values. */
export const DEFAULT_ARTICLE_PUBLISHED = "2025-01-15";
/** Bump when about / story article corpus is meaningfully reviewed. */
export const DEFAULT_ARTICLE_MODIFIED = "2026-09-05";

export function getArticleSchema(options: {
  siteUrl: string;
  pageUrl: string;
  headline: string;
  description: string;
  imageUrl?: string;
  datePublished?: string;
  dateModified?: string;
  articleSection?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: options.headline,
    description: options.description,
    url: options.pageUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": options.pageUrl,
    },
    image: options.imageUrl ? [options.imageUrl] : [`${options.siteUrl}/og-dashboard.jpg`],
    datePublished: options.datePublished ?? DEFAULT_ARTICLE_PUBLISHED,
    dateModified:
      options.dateModified ?? options.datePublished ?? DEFAULT_ARTICLE_MODIFIED,
    articleSection: options.articleSection,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: options.siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${options.siteUrl}/logo.svg`,
      },
    },
  };
}

export function getBreadcrumbSchema(
  siteUrl: string,
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: resolvePageUrl(siteUrl, item.path),
    })),
  };
}

export function getFaqPageSchema(
  pageUrl: string,
  faqs: Array<{ question: string; answer: string }>,
) {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
    url: pageUrl,
  };
}

/** HowTo for multi-step kit / setup guides (e.g. ESP32 freeze kit). */
export function getHowToSchema(options: {
  name: string;
  description: string;
  pageUrl: string;
  steps: Array<{ name: string; text: string; url?: string }>;
  totalTime?: string;
}) {
  if (options.steps.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: options.name,
    description: options.description,
    url: options.pageUrl,
    ...(options.totalTime ? { totalTime: options.totalTime } : {}),
    step: options.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: step.url } : {}),
    })),
  };
}

/** ItemList for hub pages (guides categories, stories index). */
export function getItemListSchema(options: {
  pageUrl: string;
  name: string;
  description?: string;
  items: Array<{ name: string; url: string }>;
}) {
  if (options.items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    url: options.pageUrl,
    numberOfItems: options.items.length,
    itemListElement: options.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function getSiteSchemas(options: {
  siteUrl: string;
  pageUrl: string;
  pageName: string;
  pageDescription: string;
  extraSchemas?: Record<string, unknown>[];
  includeSoftwareApplication?: boolean;
  speakableCssSelectors?: string[];
}) {
  const schemas: Record<string, unknown>[] = [
    getOrganizationSchema(options.siteUrl),
    getWebSiteSchema(options.siteUrl),
    getWebPageSchema({
      siteUrl: options.siteUrl,
      pageUrl: options.pageUrl,
      name: options.pageName,
      description: options.pageDescription,
      speakableCssSelectors: options.speakableCssSelectors,
    }),
  ];

  if (options.includeSoftwareApplication) {
    schemas.push(getSoftwareApplicationSchema(options.siteUrl));
  }

  schemas.push(...(options.extraSchemas ?? []).filter(Boolean) as Record<string, unknown>[]);
  return schemas;
}

/** Short definition-style blurb for AEO (answer engines). */
export function getBrandDefinition(): string {
  return `${SITE_NAME} watches temperature and leak sensors in ${BRAND_SPACES}, with live charts, history, and freeze, leak, and heat alerts. Open source, with a free plan.`;
}
