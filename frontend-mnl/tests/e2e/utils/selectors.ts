export const SELECTORS = {
  auth: {
    loginEmail: '#login-email',
    loginPassword: '#login-password',
    loginSubmit: 'button[type="submit"]',
    
    registerName: '#register-name',
    registerEmail: '#register-email',
    registerOrg: '#register-org',
    registerRole: '#register-role',
    registerPassword: '#register-password',
    registerConfirm: '#register-confirm',
    registerTerms: '#register-terms',
    registerSubmit: 'button[type="submit"]',
  },
  
  workspace: {
    card: '.rounded-xl.border.p-4\\.5', // matches cards
    selectButton: 'text="Enter Workspace"',
    continueDashboard: 'text="Continue to Dashboard"',
  },
  
  dashboard: {
    container: 'main',
    metrics: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4',
  },
  
  projects: {
    createButton: 'button:has-text("Create Project"), button:has-text("New Project")',
    nameInput: 'input[placeholder*="project name"], input[name="name"], #project-name',
    submitButton: 'button[type="submit"], button:has-text("Create"), button:has-text("Confirm")',
    card: '.rounded-xl.border',
    activePill: '.rounded-full.px-2\\.5',
  },
  
  projectWorkspace: {
    diseaseInput: 'input[name="disease_type"], input[placeholder*="Disease"], #disease-type',
    targetInput: 'input[name="target_gene"], input[placeholder*="Target"], #target-gene',
    uniprotInput: 'input[name="uniprot_id"], input[placeholder*="UniProt"], #uniprot-id',
    saveButton: 'button:has-text("Save"), button:has-text("Update")',
  },
  
  research: {
    targetsTable: 'table, .table, [role="table"]',
    moleculesTable: 'table, .table, [role="table"]',
    dockingPanel: '.border.p-4, .rounded-xl',
    dockingRunButton: 'button:has-text("Run Docking"), button:has-text("Start")',
    gninaLogs: 'pre, .log-viewer, .font-mono',
    quantumSection: '.grid, .border',
    simulationsSection: '.grid, .border',
    admetTable: 'table, .table, [role="table"]',
  },
  
  visualization: {
    container3D: '#mol3d-container, .viewer-3d, canvas, .viewerContainer',
    chemSpaceContainer: 'canvas, .plotly, .chart',
    similarityContainer: 'canvas, .plotly, .chart',
  },
  
  ai: {
    modelCards: '.grid, table',
    chatInput: 'input[placeholder*="Ask Pharma Copilot"], textarea[placeholder*="Ask Pharma Copilot"], input[placeholder*="chat"], textarea[placeholder*="chat"]',
    chatSubmit: 'button:has-text("Send"), button[type="submit"]',
  },
  
  infrastructure: {
    computeSection: '.grid, table',
    storageSection: '.grid, table',
    apiKeysSection: '.grid, table',
    integrationsSection: '.grid, table',
  },
  
  organization: {
    teamSection: '.grid, table',
    billingSection: '.grid, table',
    auditSection: '.grid, table',
    settingsSection: 'form, .grid',
  },
  
  experiments: {
    table: 'table, .table, [role="table"]',
    reportsTable: 'table, .table, [role="table"]',
  },
  
  fileUpload: {
    input: 'input[type="file"]',
  }
};
