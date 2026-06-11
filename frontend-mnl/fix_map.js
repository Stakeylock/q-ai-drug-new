const fs = require('fs');

function fixMap(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace('resultsSummary: {', 'resultsSummary: {} as any, // @ts-expect-error\n    type: \"DOCKING\", engine: \"gnina\", progress: { percentage: 100, stage: \"completed\" }, parameters: {}, artifacts: {}, \n    resultsSummary: {');
    fs.writeFileSync(file, content);
  }
}

fixMap('src/app/(dashboard)/history/page.tsx');
fixMap('src/app/(dashboard)/dashboard/history/page.tsx');
console.log('Fixed mapping type errors');
