import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Mondel",
  description: "Lightweight TypeScript ORM for MongoDB",
  head: [["link", { rel: "icon", href: "/logo.png" }]],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/logo.png",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/reference" },
      { text: "Examples", link: "/examples/serverless" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Why Mondel?", link: "/guide/core-concepts" },
        ],
      },
      {
        text: "Guide",
        items: [
          { text: "Schema Definition", link: "/guide/schema-definition" },
          { text: "Mondel CLI", link: "/guide/cli" },
          { text: "CRUD Operations", link: "/guide/queries" },
          { text: "Validation", link: "/guide/validation" },
          { text: "Transactions", link: "/guide/transactions" },
          { text: "Advanced Features", link: "/guide/advanced" },
          { text: "LLM Reference", link: "/guide/llm-reference" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Cloudflare Workers", link: "/examples/serverless" },
          { text: "Node.js / Express", link: "/examples/nodejs" },
          { text: "Geospatial Queries", link: "/examples/geospatial" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API Reference", link: "/api/reference" },
          { text: "Field Types", link: "/api/field-types" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/edjo/mondel" }],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present Edjo",
    },
  },
});
