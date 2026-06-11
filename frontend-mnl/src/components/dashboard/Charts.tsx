"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import ChartCard from "./ChartCard";

const mwData = [
	{ range: "150-200", count: 24 },
	{ range: "200-250", count: 38 },
	{ range: "250-300", count: 56 },
	{ range: "300-350", count: 49 },
	{ range: "350-400", count: 31 },
	{ range: "400-450", count: 18 },
	{ range: "450+", count: 9 },
];

const logpData = [
	{ range: "<0", count: 11 },
	{ range: "0-1", count: 22 },
	{ range: "1-2", count: 44 },
	{ range: "2-3", count: 58 },
	{ range: "3-4", count: 36 },
	{ range: "4-5", count: 19 },
	{ range: "5+", count: 7 },
];

const velocityData = [
	{ date: "05/08", experiments: 12 },
	{ date: "05/09", experiments: 18 },
	{ date: "05/10", experiments: 15 },
	{ date: "05/11", experiments: 25 },
	{ date: "05/12", experiments: 22 },
	{ date: "05/13", experiments: 30 },
	{ date: "05/14", experiments: 28 },
];

const correlationData = [
	{ docking: -8.2, quantum: 0.82, id: "C1" },
	{ docking: -9.5, quantum: 0.88, id: "C2" },
	{ docking: -7.1, quantum: 0.75, id: "C3" },
	{ docking: -11.2, quantum: 0.94, id: "C4" },
	{ docking: -8.8, quantum: 0.81, id: "C5" },
	{ docking: -10.4, quantum: 0.91, id: "C6" },
];

const axisTick = { fontSize: 10, fill: "var(--muted-text)", fontWeight: 600 };

function ChartTooltip() {
	return {
		contentStyle: {
			backgroundColor: "var(--ui-surface)",
			border: "1px solid var(--border-color)",
			borderRadius: "12px",
			color: "var(--text)",
			fontSize: "11px",
			fontWeight: 600,
			boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
		},
		cursor: { fill: "var(--primary-light)", opacity: 0.1 },
	};
}

export default function ChartsSection() {
	const tooltip = ChartTooltip();

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<ChartCard title="Molecular Weight (MW) Distribution">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={mwData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
						<XAxis dataKey="range" axisLine={false} tickLine={false} tick={axisTick} />
						<YAxis axisLine={false} tickLine={false} tick={axisTick} />
						<Tooltip {...tooltip} />
						<Bar dataKey="count" name="Count" fill="var(--primary)" maxBarSize={32} radius={[4, 4, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</ChartCard>

			<ChartCard title="Research Pipeline Velocity">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={velocityData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
						<XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisTick} />
						<YAxis axisLine={false} tickLine={false} tick={axisTick} />
						<Tooltip {...tooltip} />
						<Bar dataKey="experiments" name="Experiments" fill="var(--accent)" maxBarSize={32} radius={[4, 4, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</ChartCard>

			<ChartCard title="LogP Distribution">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={logpData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
						<XAxis dataKey="range" axisLine={false} tickLine={false} tick={axisTick} />
						<YAxis axisLine={false} tickLine={false} tick={axisTick} />
						<Tooltip {...tooltip} />
						<Bar dataKey="count" name="Count" fill="var(--primary)" maxBarSize={32} radius={[4, 4, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</ChartCard>

			<ChartCard title="Docking vs Quantum Correlation">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={correlationData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
						<XAxis dataKey="id" axisLine={false} tickLine={false} tick={axisTick} />
						<YAxis axisLine={false} tickLine={false} tick={axisTick} />
						<Tooltip {...tooltip} />
						<Bar dataKey="docking" name="Docking (kcal/mol)" fill="var(--primary)" maxBarSize={16} radius={[4, 4, 0, 0]} />
						<Bar dataKey="quantum" name="Quantum Score" fill="var(--accent)" maxBarSize={16} radius={[4, 4, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</ChartCard>
		</div>
	);
}

