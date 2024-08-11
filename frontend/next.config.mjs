/** @type {import('next').NextConfig} */
import * as withPWA from "next-pwa";

const nextConfig = {};

export default withPWA({
  dest: "public",
})(nextConfig);
