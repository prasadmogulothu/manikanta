import type { NextConfig } from 'next';

// There's an unrelated lockfile in the parent folder, so name this folder as the root.
const config: NextConfig = { outputFileTracingRoot: import.meta.dirname };

export default config;
