/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	compress: true,
	poweredByHeader: false,
	// Enforce ESLint during build to ensure validation
	eslint: {
		ignoreDuringBuilds: false,
	},
	// Enforce TypeScript build validation
	typescript: {
		ignoreBuildErrors: false,
	},
	output: 'standalone',
	images: {
		formats: ['image/avif', 'image/webp'],
	},
	async redirects() {
		return [
			{
				source: '/history',
				destination: '/dashboard/history',
				permanent: true,
			},
		];
	},
};

module.exports = nextConfig;

