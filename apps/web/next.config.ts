import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@release-loop/domain', '@release-loop/spotify-client', '@release-loop/ui'],
};

export default nextConfig;
