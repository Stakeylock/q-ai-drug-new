const fs = require('fs');

const replaces = [
  ['apiClient.get<any>(/projects//chemical-space)', 'getProjectChemicalSpace(projectId)'],
  ['apiClient.get(/projects//chemical-space)', 'getProjectChemicalSpace(projectId)'],
  ['apiClient.get<any>(/projects//docking/results)', 'getProjectDocking(projectId)'],
  ['apiClient.get<any>(/projects//gnina/results)', 'getProjectGninaResults(projectId)'],
  ['apiClient.get<any>(/projects//pipeline/summary)', 'getProjectPipelineSummary(projectId)'],
  ['apiClient.get<any>(/projects//molecules)', 'getProjectMolecules(projectId)'],
  ['apiClient.get<any>(/projects//similarity/matrix)', 'getProjectSimilarityMatrix(projectId)'],
  ['apiClient.get<any>(/projects//quantum/qml-scores)', 'getProjectQuantum(projectId)'],
  ['apiClient.get<any>(/projects//simulations/results)', 'getProjectSimulation(projectId)'],
  ['apiClient.get<any>(/projects//targets)', 'getProjectTargets(projectId)'],
  ['apiClient.get<any>(/projects//admet/results)', 'getProjectValidation(projectId)'],
  ['apiClient.get<any>(/projects//viewer/assets)', 'getProjectViewerAssets(projectId)'],
  ['apiClient.get<any>(/projects//viewer/pose/)', 'getProjectViewerPose(projectId, selectedPose.result_id)'],
  ['apiClient.get<any>(/projects//viewer/interaction-fingerprint/)', 'getProjectViewerFingerprint(projectId, selectedPose.result_id)']
];

const files = [
  'src/app/(dashboard)/chemical-space/page.tsx',
  'src/app/(dashboard)/docking/page.tsx',
  'src/app/(dashboard)/molecules/page.tsx',
  'src/app/(dashboard)/quantum/page.tsx',
  'src/app/(dashboard)/similarity/page.tsx',
  'src/app/(dashboard)/simulation/page.tsx',
  'src/app/(dashboard)/targets/page.tsx',
  'src/app/(dashboard)/validation/page.tsx',
  'src/app/(dashboard)/visualization/page.tsx'
];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  
  for (const [oldStr, newStr] of replaces) {
    if (text.includes(oldStr)) {
      text = text.replace(oldStr, newStr);
    }
  }

  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/services\/api['"];/;
  const match = importRegex.exec(text);
  if (match) {
    const importedMethods = new Set(match[1].split(',').map(s => s.trim()).filter(s => s));
    
    const newMethods = [
      'getProjectChemicalSpace', 'getProjectDocking', 'getProjectGninaResults', 
      'getProjectPipelineSummary', 'getProjectMolecules', 'getProjectSimilarityMatrix', 
      'getProjectQuantum', 'getProjectSimulation', 'getProjectTargets', 
      'getProjectValidation', 'getProjectViewerAssets', 'getProjectViewerPose', 'getProjectViewerFingerprint'
    ];
    
    for (const m of newMethods) {
      if (text.includes(m)) {
        importedMethods.add(m);
      }
    }
    
    const newImportStr = 'import { ' + Array.from(importedMethods).join(', ') + ' } from "@/services/api";';
    text = text.replace(importRegex, newImportStr);
  }

  fs.writeFileSync(file, text);
}
console.log('Refactoring complete.');
