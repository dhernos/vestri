import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";
const goOrigin = safeOrigin(GO_API_URL);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    const connectSrc = ["'self'"];
    if (goOrigin) {
      connectSrc.push(goOrigin);
    }
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src ${connectSrc.join(
              " "
            )}; img-src 'self' https://avatars.githubusercontent.com data:;`,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${GO_API_URL}/api/:path*`,
      },
    ];
  },
};

function safeOrigin(url: string | undefined) {
  if (!url) return "";
  try {
    const { protocol, host } = new URL(url);
    return `${protocol}//${host}`;
  } catch {
    return "";
  }
}

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
