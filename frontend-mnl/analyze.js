const fs = require('fs');
const path = require('path');

const rootDir = 'e:/rskmn/Npersonal/quinfosys/drug_discovery_research/work/mnl/frontend-mnl/src';

const results = {
  pages: [],
  apiCalls: [],
  mocks: [],
  broken: [],
  types: []
};

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (filePath.endsWith('page.tsx')) {
    results.pages.push(filePath.replace(/\\/g, '/').replace('e:/rskmn/Npersonal/quinfosys/drug_discovery_research/work/mnl/frontend-mnl/src/app', ''));
  }
  
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('TODO') || line.includes('FIXME') || line.trim().startsWith('//') && line.includes('mock')) {
      results.broken.push(`${filePath}:${i+1} - ${line.trim()}`);
    }
    if (line.includes('fetch(') || line.includes('axios.')) {
      results.apiCalls.push(`${filePath}:${i+1} - ${line.trim()}`);
    }
    if (line.toLowerCase().includes('mock') || line.toLowerCase().includes('fake data') || line.toLowerCase().includes('demo data') || line.toLowerCase().includes('hardcoded')) {
      results.mocks.push(`${filePath}:${i+1} - ${line.trim()}`);
    }
  });

  if (filePath.includes('/types/')) {
    results.types.push(filePath.replace(/\\/g, '/').replace('e:/rskmn/Npersonal/quinfosys/drug_discovery_research/work/mnl/frontend-mnl/src/', ''));
  }
}

walkDir(rootDir);

fs.writeFileSync('e:/rskmn/Npersonal/quinfosys/drug_discovery_research/work/mnl/frontend-mnl/analysis_results.json', JSON.stringify(results, null, 2));
console.log('Analysis complete. Results in analysis_results.json');
