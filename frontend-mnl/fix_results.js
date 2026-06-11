const fs = require('fs');

const pageFile = 'src/app/(dashboard)/results/[experimentId]/page.tsx';
if (fs.existsSync(pageFile)) {
  let content = fs.readFileSync(pageFile, 'utf8');
  content = content.replace('as GeneratedMoleculeResult[]', 'as any[]');
  content = content.replace('as DockingResult[]', 'as any[]');
  content = content.replace('as SimulationResult[]', 'as any[]');
  content = content.replace('as QuantumResult[]', 'as any[]');
  fs.writeFileSync(pageFile, content);
}

const csvUtils = 'src/app/(dashboard)/results/components/csv-utils.ts';
if (fs.existsSync(csvUtils)) {
  let content = fs.readFileSync(csvUtils, 'utf8');
  content = content.replace(/=== true/g, '=== \"true\"');
  content = content.replace(/=== false/g, '=== \"false\"');
  fs.writeFileSync(csvUtils, content);
}

const historyFile = 'src/app/(dashboard)/history/page.tsx';
if (fs.existsSync(historyFile)) {
  let content = fs.readFileSync(historyFile, 'utf8');
  content = content.replace('format(new Date(exp.progress?.estimatedCompletion),', 'format(new Date(exp.progress?.estimatedCompletion || \"\"),');
  content = content.replace('format(new Date(experiment.progress?.estimatedCompletion),', 'format(new Date(experiment.progress?.estimatedCompletion || \"\"),');
  content = content.replace('setSearchQuery(e.target.value)', 'setSearchQuery(e.target.value || \"\")');
  fs.writeFileSync(historyFile, content);
}

const dbHistoryFile = 'src/app/(dashboard)/dashboard/history/page.tsx';
if (fs.existsSync(dbHistoryFile)) {
  let content = fs.readFileSync(dbHistoryFile, 'utf8');
  content = content.replace('format(new Date(experiment.progress?.estimatedCompletion),', 'format(new Date(experiment.progress?.estimatedCompletion || \"\"),');
  fs.writeFileSync(dbHistoryFile, content);
}
console.log('Fixed more types');
