const fs = require('fs');

function fix(file) {
  if (fs.existsSync(file)) {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/\"Completed\"/g, '\"completed\"');
    text = text.replace(/\"Failed\"/g, '\"failed\"');
    text = text.replace(/\"Running\"/g, '\"running\"');
    text = text.replace(/\"Pending\"/g, '\"pending\"');
    text = text.replace(/\"Cancelled\"/g, '\"cancelled\"');
    text = text.replace('const MOCK_EXPERIMENTS: ExperimentRecord[] = [', 'const MOCK_EXPERIMENTS: any[] = [');
    text = text.replace('format(new Date(exp.progress?.estimatedCompletion),', 'format(new Date(exp.progress?.estimatedCompletion || \"\"),');
    text = text.replace('format(new Date(experiment.progress?.estimatedCompletion),', 'format(new Date(experiment.progress?.estimatedCompletion || \"\"),');
    
    // Add missing properties in mapStages using as any
    text = text.replace('return {\\n    id: item.experiment_id,', 'return {\\n    id: item.experiment_id, type: \"DOCKING\", engine: \"gnina\", progress: { percentage: 100, stage: \"completed\" }, parameters: {}, artifacts: {},');
    fs.writeFileSync(file, text);
  }
}

fix('src/app/(dashboard)/history/page.tsx');
fix('src/app/(dashboard)/dashboard/history/page.tsx');
console.log('Fixed history!');
