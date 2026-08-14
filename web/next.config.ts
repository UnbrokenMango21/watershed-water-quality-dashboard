import path from 'node:path';
import type { NextConfig } from 'next';

// The already-tested review domain module (`review/reviewSubmission.mjs`) lives one
// level above `web/`, so both the bundler root and the output file tracing root have
// to be the repository root rather than this package directory.
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
