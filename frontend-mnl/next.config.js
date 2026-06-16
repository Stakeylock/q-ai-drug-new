/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	compress: true,
	poweredByHeader: false,
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
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: [
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=(), payment=()',
					},
					{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
				],
			},
		];
	},
};

module.exports = nextConfig;

