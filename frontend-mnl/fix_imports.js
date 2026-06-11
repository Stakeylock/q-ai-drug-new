const fs = require('fs');

function addImport(file, importItem, modulePath) {
  let content = fs.readFileSync(file, 'utf8');
  const importRegex = new RegExp('import\\\\s+\\\\{([^}]+)\\\\}\\\\s+from\\\\s+[\"\\']' + modulePath + '[\"\\'];');
  const match = importRegex.exec(content);
  if (match) {
    if (!match[1].includes(importItem)) {
      const newImport = 'import { ' + match[1].trim() + ', ' + importItem + ' } from \"' + modulePath + '\";';
      content = content.replace(importRegex, newImport);
      fs.writeFileSync(file, content);
      console.log('Added ' + importItem + ' to ' + file);
    }
  }
}

addImport('src/app/(dashboard)/simulation/page.tsx', 'Button', '@/components/ui');
addImport('src/app/(dashboard)/validation/page.tsx', 'Button', '@/components/ui');
