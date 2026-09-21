import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-to-img",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],

  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
