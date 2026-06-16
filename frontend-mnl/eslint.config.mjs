import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
	...nextVitals,
	...nextTypescript,
	{
		rules: {
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-require-imports": "warn",
			"@typescript-eslint/ban-ts-comment": "warn",
			"@typescript-eslint/no-empty-object-type": "warn",
			"prefer-const": "warn",
			"react/no-unescaped-entities": "warn",
			"react-hooks/immutability": "warn",
			"react-hooks/set-state-in-effect": "warn",
		},
	},
	{
		ignores: [
			".next/**",
			"out/**",
			"build/**",
			"coverage/**",
			"playwright-report/**",
			"test-results/**",
		],
	},
];

export default eslintConfig;
