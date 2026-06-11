const fs = require('fs');

const historyFile = 'src/app/(dashboard)/history/page.tsx';
if (fs.existsSync(historyFile)) {
  let content = fs.readFileSync(historyFile, 'utf8');
  content = content.replace('const MOCK_EXPERIMENTS: ExperimentRecord[] = [', 'const MOCK_EXPERIMENTS: any[] = [');
  fs.writeFileSync(historyFile, content);
}

const dbHistoryFile = 'src/app/(dashboard)/dashboard/history/page.tsx';
if (fs.existsSync(dbHistoryFile)) {
  let content = fs.readFileSync(dbHistoryFile, 'utf8');
  content = content.replace('const MOCK_EXPERIMENTS: ExperimentRecord[] = [', 'const MOCK_EXPERIMENTS: any[] = [');
  fs.writeFileSync(dbHistoryFile, content);
}
console.log('Fixed mock typing');
