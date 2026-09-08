import { defineConfig } from "vitepress";

const site = "https://thermaltrace.dev";
const docs = "https://doodersrage.github.io/thermaltrace/";

export default defineConfig({
  title: "ThermalTrace Docs",
  description:
    "Developer documentation for ThermalTrace — ingest, API, sketches, local development, and deploy.",
  base: "/thermaltrace/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${site}/favicon.svg` }],
    ["meta", { name: "theme-color", content: "#090b0f" }],
    ["meta", { property: "og:title", content: "ThermalTrace Docs" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Ingest API, sensor sketches, webhooks, and local development for ThermalTrace.",
      },
    ],
    ["meta", { property: "og:url", content: docs }],
    ["meta", { property: "og:image", content: `${site}/og-dashboard.jpg` }],
  ],
  themeConfig: {
    logo: { src: `${site}/favicon.svg`, alt: "ThermalTrace" },
    siteTitle: "ThermalTrace",
    nav: [
      { text: "Guide", link: "/guide/architecture" },
      { text: "Ingest", link: "/ingest/" },
      { text: "API", link: "/api/" },
      {
        text: "Links",
        items: [
          { text: "Live app", link: site },
          { text: "About & guides", link: `${site}/about` },
          { text: "GitHub repo", link: "https://github.com/doodersrage/thermaltrace" },
          { text: "OpenAPI YAML", link: "/openapi.yaml" },
        ],
      },
    ],
    sidebar: {
      "/": [
        {
          text: "Introduction",
          items: [
            { text: "Overview", link: "/" },
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Local development", link: "/guide/local-dev" },
            { text: "Deploy & ops", link: "/guide/deploy" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
          ],
        },
        {
          text: "Hardware & ingest",
          items: [
            { text: "Push ingest", link: "/ingest/" },
            { text: "Pull feeds", link: "/ingest/pull-feeds" },
            { text: "Sensor sketches", link: "/sketches/" },
          ],
        },
        {
          text: "Integrations",
          items: [
            { text: "HTTP API", link: "/api/" },
            { text: "Alert webhooks", link: "/integrations/webhooks" },
            { text: "Home Assistant", link: "/integrations/home-assistant" },
            { text: "Matter / Apple Home", link: "/integrations/matter" },
            { text: "MQTT bridge", link: "/integrations/mqtt-bridge" },
            { text: "ESPHome & Shelly", link: "/integrations/esphome-shelly" },
            { text: "Personal weather stations", link: "/integrations/personal-weather-stations" },
            { text: "Grafana / Prometheus", link: "/integrations/grafana" },
          ],
        },
        {
          text: "On thermaltrace.dev",
          items: [
            { text: "Product About hub", link: `${site}/about` },
            { text: "In-app API page", link: `${site}/docs/api` },
            { text: "Pricing", link: `${site}/pricing` },
            { text: "System status", link: `${site}/system-status` },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/doodersrage/thermaltrace" },
    ],
    footer: {
      message:
        'App & product guides: <a href="https://thermaltrace.dev">thermaltrace.dev</a> · This site: developer reference',
      copyright: "Copyright © ThermalTrace",
    },
    search: { provider: "local" },
    editLink: {
      pattern:
        "https://github.com/doodersrage/thermaltrace/edit/main/docs/:path",
      text: "Edit on GitHub",
    },
    outline: { level: [2, 3] },
  },
});
