import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "sharp", "page-flip"]
};

export default nextConfig;
