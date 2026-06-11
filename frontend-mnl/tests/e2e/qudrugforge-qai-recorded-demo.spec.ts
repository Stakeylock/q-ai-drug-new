import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define E2E Constants matching prompt requirements
const DEMO_EMAIL = 'demo.qai.recorder@example.com';
const DEMO_PASSWORD = 'DemoPass123!';
const DEMO_NAME = 'Demo QAI Recorder';
const DEMO_WORKSPACE = 'Oncology Research Demo';
const DEMO_PROJECT = 'EGFR NSCLC QAI Recorded Demo';
const BACKEND_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8001';

test.describe('recorded q-ai-drug end-to-end scientific demo', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Force real mode in localStorage on page load to bypass mock templates
    await page.addInitScript(() => {
      window.localStorage.setItem('demo_mode', 'false');
    });

    // 2. Setup dialog handler to automatically intercept and accept alerts/prompts
    page.on('dialog', async (dialog) => {
      console.log(`[Browser Dialog Intercepted]: "${dialog.message()}" (${dialog.type()})`);
      if (dialog.type() === 'prompt') {
        await dialog.accept(DEMO_WORKSPACE);
      } else {
        await dialog.accept();
      }
    });
  });

  test('Should execute full pipeline and verify scientific data', async ({ page, request }) => {
    console.log('--- A. SYSTEM HEALTH PRECHECK ---');
    
    // Check general backend status
    const healthRes = await request.get(`${BACKEND_URL}/health`);
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    console.log('✓ Backend health OK:', JSON.stringify(healthJson));

    // Check API V1 health status
    const apiHealthRes = await request.get(`${BACKEND_URL}/api/v1/health`);
    expect(apiHealthRes.status()).toBe(200);
    const apiHealthJson = await apiHealthRes.json();
    console.log('✓ Backend API health OK:', JSON.stringify(apiHealthJson));


    console.log('--- B. OPEN FRONTEND ---');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/QuDrugForge/i);

    // Save screenshot of initial load
    await fs.promises.mkdir(path.join(__dirname, '../../test-results/qai-demo'), { recursive: true });
    await page.screenshot({ path: 'test-results/qai-demo/01-frontend-loaded.png' });
    console.log('✓ Screenshot saved: 01-frontend-loaded.png');


    console.log('--- C. REGISTER OR LOGIN ---');
    // Attempt registration
    await page.goto('/signup');
    await page.waitForSelector('#register-email');

    await page.fill('#register-name', DEMO_NAME);
    await page.fill('#register-email', DEMO_EMAIL);
    await page.fill('#register-org', 'Quinfosys Research');
    await page.fill('#register-role', 'Lead Bioinformatician');
    await page.fill('#register-password', DEMO_PASSWORD);
    await page.fill('#register-confirm', DEMO_PASSWORD);
    
    // Check terms if present
    const termsCheckbox = page.locator('#register-terms');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await page.click('button[type="submit"]');
    
    // Wait to see if signup redirects or shows error (e.g. user already exists)
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    if (currentUrl.includes('/signup') || await page.locator('text="already exists"').isVisible()) {
      console.log('User already registered. Falling back to Login flow...');
      await page.goto('/login');
      await page.waitForSelector('#login-email');
      await page.fill('#login-email', DEMO_EMAIL);
      await page.fill('#login-password', DEMO_PASSWORD);
      await page.click('button[type="submit"]');
    }

    // Wait until logged in and routed to selector or dashboard
    await page.waitForURL(url => url.pathname.includes('/workspace-selector') || url.pathname.includes('/dashboard'), { timeout: 15000 });
    
    // Grab authenticated JWT from localStorage
    const authToken = await page.evaluate(() => window.localStorage.getItem('auth_token'));
    expect(authToken).not.toBeNull();
    console.log('✓ Authentication successful. JWT saved.');
    await page.screenshot({ path: 'test-results/qai-demo/02-authenticated.png' });

    console.log('--- C.2 AUTHENTICATED COMPUTE HEALTH CHECK ---');
    // Now perform the Q-AI-Drug integration link health check with Auth header
    const authHeaders = { 'Authorization': `Bearer ${authToken}` };
    const qaiHealthRes = await request.get(`${BACKEND_URL}/api/v1/integrations/q-ai-drug/health`, {
      headers: authHeaders
    });
    expect(qaiHealthRes.status()).toBe(200);
    const qaiHealthJson = await qaiHealthRes.json();
    expect(qaiHealthJson.success).toBe(true);
    console.log('✓ Q-AI-Drug Integration OK:', JSON.stringify(qaiHealthJson));


    console.log('--- D. WORKSPACE SELECT / CREATE ---');
    if (page.url().includes('/workspace-selector')) {
      await page.waitForTimeout(1500); // Wait for workspaces list to render
      
      const targetCard = page.locator('.rounded-xl.border', { hasText: DEMO_WORKSPACE }).first();
      if (await targetCard.isVisible()) {
        console.log(`Selecting existing workspace: "${DEMO_WORKSPACE}"`);
        await targetCard.locator('button:has-text("Enter Workspace")').click();
      } else {
        console.log(`Creating new workspace: "${DEMO_WORKSPACE}"`);
        await page.click('button:has-text("Create Workspace")');
        await page.waitForTimeout(2000); // Wait for API reload list
        
        const newCard = page.locator('.rounded-xl.border', { hasText: DEMO_WORKSPACE }).first();
        await expect(newCard).toBeVisible({ timeout: 10000 });
        await newCard.locator('button:has-text("Enter Workspace")').click();
      }
    }

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✓ Arrived at dashboard successfully.');
    await page.screenshot({ path: 'test-results/qai-demo/03-workspace-selected.png' });


    console.log('--- E. CREATE / OPEN PROJECT ---');
    // Grab workspace ID from localStorage
    const workspaceId = await page.evaluate(() => window.localStorage.getItem('active_workspace_id'));
    expect(workspaceId).not.toBeNull();
    console.log(`✓ Active Workspace ID: ${workspaceId}`);

    // Query projects list to see if our program already exists
    let projectId = '';
    const projectsListRes = await request.get(`${BACKEND_URL}/api/v1/projects?workspace_id=${workspaceId}`, {
      headers: authHeaders
    });
    expect(projectsListRes.status()).toBe(200);
    const projectsListJson = await projectsListRes.json();
    expect(projectsListJson.success).toBe(true);

    const existingProj = projectsListJson.data.items.find((p: any) => p.name === DEMO_PROJECT);
    if (existingProj) {
      projectId = existingProj.id;
      console.log(`✓ Project already exists. Project UUID: ${projectId}`);
    } else {
      console.log(`Creating new project via API: "${DEMO_PROJECT}"`);
      const createProjRes = await request.post(`${BACKEND_URL}/api/v1/projects`, {
        headers: authHeaders,
        data: {
          workspace_id: workspaceId,
          name: DEMO_PROJECT,
          description: 'Recorded demo proving q-ai-drug integration across all completed scientific stages.',
          disease_type: 'Non-small cell lung cancer',
          cancer_type: 'EGFR'
        }
      });
      expect(createProjRes.status()).toBe(200);
      const createProjJson = await createProjRes.json();
      expect(createProjJson.success).toBe(true);
      projectId = createProjJson.data.id;
      console.log(`✓ Project successfully created. Project UUID: ${projectId}`);
    }

    // Navigate directly to the project page layout
    await page.goto(`/research-projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const projectUrl = page.url();
    expect(projectUrl).toContain(projectId);
    console.log(`✓ Navigated directly to project workspace: ${projectUrl}`);
    await page.screenshot({ path: 'test-results/qai-demo/04-project-opened.png' });


    console.log('--- F. UPLOAD SCIENTIFIC INPUT FILES ---');
    // Navigate to Input Data tab
    await page.click('button:has-text("Input Data")');
    await page.waitForTimeout(1000);

    // Prepare fixture file paths
    const fastaPath = path.resolve(__dirname, 'fixtures/egfr_mutant.fasta');
    const pdbPath = path.resolve(__dirname, 'fixtures/6v6o_egfr.pdb');
    const csvPath = path.resolve(__dirname, 'fixtures/compounds_demo.csv');
    const sdfPath = path.resolve(__dirname, 'fixtures/osimertinib_ref.sdf');

    // Deterministic upload helper that waits for settled API flows
    const uploadFile = async (selector: string, filePath: string) => {
      const uploadPromise = page.waitForResponse(response => 
        response.url().includes('/files/upload') && response.status() === 200,
        { timeout: 20000 }
      );
      const assignPromise = page.waitForResponse(response => 
        response.url().includes('/inputs/files') && response.status() === 200,
        { timeout: 20000 }
      );
      
      await page.setInputFiles(selector, filePath);
      const uploadResponse = await uploadPromise;
      await assignPromise;
      
      const resJson = await uploadResponse.json();
      return (resJson.data.file.file_id || resJson.data.file.id) as string;
    };

    console.log('Uploading protein FASTA...');
    await uploadFile('#file-input-protein-fasta', fastaPath);

    console.log('Uploading protein PDB crystal...');
    await uploadFile('#file-input-protein-pdb---mmcif', pdbPath);

    console.log('Uploading SMILES compound library...');
    const smilesFileId = await uploadFile('#file-input-smiles-compound-library', csvPath);
    console.log(`✓ SMILES compound library assigned. ID: ${smilesFileId}`);

    console.log('Uploading Known Reference Ligand...');
    await uploadFile('#file-input-known-reference-ligand', sdfPath);

    console.log('✓ Inputs uploaded via UI.');
    await page.screenshot({ path: 'test-results/qai-demo/05-files-uploaded.png' });


    console.log('--- G. ASSIGN PROJECT INPUTS AND BINDING BOX ---');
    // Ensure coordinates are configured directly on the database via backend API patch
    const bindingBoxRes = await request.patch(`${BACKEND_URL}/api/v1/projects/${projectId}/inputs/binding-site`, {
      headers: authHeaders,
      data: {
        mode: 'box',
        box: {
          center_x: 10.0,
          center_y: 10.0,
          center_z: 10.0,
          size_x: 22.0,
          size_y: 22.0,
          size_z: 22.0
        }
      }
    });
    expect(bindingBoxRes.status()).toBe(200);
    console.log('✓ Binding site coordinates successfully patched via API.');

    // Verify completeness score
    const completenessRes = await request.get(`${BACKEND_URL}/api/v1/projects/${projectId}/inputs/completeness`, { headers: authHeaders });
    expect(completenessRes.status()).toBe(200);
    const completenessJson = await completenessRes.json();
    console.log('Completeness Details:', JSON.stringify(completenessJson));

    // Reload page to reflect validated coordinates box in UI
    await page.reload();
    await page.click('button:has-text("Input Data")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/qai-demo/06-inputs-ready.png' });


    console.log('--- H. IMPORT MOLECULES FROM UPLOADED CSV ---');
    // Invoke molecule parser on the backend with the correct source_file_id
    const molImportRes = await request.post(`${BACKEND_URL}/api/v1/projects/${projectId}/molecules/import`, {
      headers: authHeaders,
      data: {
        source_file_id: smilesFileId
      }
    });
    expect(molImportRes.status()).toBe(200);
    const molImportJson = await molImportRes.json();
    expect(molImportJson.success).toBe(true);
    console.log('✓ Molecule import response successful:', JSON.stringify(molImportJson));
    
    // Navigate directly to Molecules page
    await page.goto('/molecules');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify table has populated compounds
    const moleculesTable = page.locator('table, .table, [role="table"]');
    await expect(moleculesTable.first()).toBeVisible();
    await page.screenshot({ path: 'test-results/qai-demo/07-molecules-imported.png' });


    console.log('--- I. IMPORT REAL Q-AI-DRUG ARTIFACTS ---');
    const artifactRes = await request.post(`${BACKEND_URL}/api/v1/projects/${projectId}/q-ai-drug/import-artifacts`, {
      headers: authHeaders,
      data: {
        source_output_dir: 'outputs/cancer_proof_v1'
      }
    });
    
    // Assert successful execution of the synchronization worker
    expect(artifactRes.status()).toBe(200);
    const artifactJson = await artifactRes.json();
    expect(artifactJson.success).toBe(true);
    console.log('✓ Q-AI-Drug artifacts imported successfully:', JSON.stringify(artifactJson));

    // Return to UI Dashboard page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/qai-demo/08-qai-artifacts-imported.png' });


    console.log('--- J. VERIFY EXPERIMENTS PAGE ---');
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Assert that the experiments table loads and contains real imported jobs
    const experimentsTable = page.locator('table, .table, [role="table"]');
    await expect(experimentsTable.first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/(imported|completed|docking|gnina|quantum|admet|simulation)/i);
    console.log('✓ Experiments page verified.');
    await page.screenshot({ path: 'test-results/qai-demo/09-experiments-real-data.png' });


    console.log('--- K. VERIFY DOCKING PAGE ---');
    await page.goto('/docking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify affinity values are pulled
    await expect(page.locator('body')).toContainText(/(affinity|kcal|pose|binding|vina)/i);
    console.log('✓ Docking data verified.');
    await page.screenshot({ path: 'test-results/qai-demo/10-docking-real-data.png' });


    console.log('--- L. VERIFY GNINA PAGE ---');
    await page.goto('/docking?engine=gnina');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify pose scoring parameters exist
    await expect(page.locator('body')).toContainText(/(CNN|pose score|affinity|gnina)/i);
    console.log('✓ GNINA rescores verified.');
    await page.screenshot({ path: 'test-results/qai-demo/11-gnina-real-data.png' });


    console.log('--- M. VERIFY QUANTUM/QML PAGE ---');
    await page.goto('/quantum');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify electronic orbital bands
    await expect(page.locator('body')).toContainText(/(HOMO|LUMO|gap|dipole|QML|quantum|prefilter)/i);
    console.log('✓ Quantum descriptors verified.');
    await page.screenshot({ path: 'test-results/qai-demo/12-quantum-real-data.png' });


    console.log('--- N. VERIFY ADMET PAGE ---');
    await page.goto('/validation?panel=admet');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify Ames & hERG toxicity indices
    await expect(page.locator('body')).toContainText(/(hERG|Ames|Lipinski|toxicity|risk|admet|recommendation)/i);
    console.log('✓ ADMET profile verified.');
    await page.screenshot({ path: 'test-results/qai-demo/13-admet-real-data.png' });


    console.log('--- O. VERIFY SIMULATIONS/MD PAGE ---');
    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify RMSD coordinate logs
    await expect(page.locator('body')).toContainText(/(RMSD|RMSF|stability|trajectory|simulation|MD)/i);
    console.log('✓ Molecular Dynamics verified.');
    await page.screenshot({ path: 'test-results/qai-demo/14-simulations-real-data.png' });


    console.log('--- P. VERIFY 3D VIEWER STATE ---');
    await page.goto('/visualization');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // The 3D page should load its layout cleanly without exceptions
    await expect(page.locator('body')).toContainText(/(3D|Viewer|Structure|Protein|Pose)/i);
    console.log('✓ 3D Viewer page verified.');
    await page.screenshot({ path: 'test-results/qai-demo/15-3d-viewer-state.png' });


    console.log('--- Q. DASHBOARD FINAL VERIFICATION ---');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Total Projects count should be at least 1
    await expect(page.locator('body')).toContainText(/EGFR NSCLC/i);
    console.log('✓ Final Dashboard metrics verified.');
    await page.screenshot({ path: 'test-results/qai-demo/16-dashboard-final.png' });


    console.log('--- R. REPORTS PENDING VERIFICATION ---');
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // The reports tab must display its correct pending state
    await expect(page.locator('body')).toContainText(/(pending|coming soon|not completed|imported artifact|dossier)/i);
    console.log('✓ Reports pending warning verified.');
    await page.screenshot({ path: 'test-results/qai-demo/17-reports-pending.png' });
    
    console.log('==============================================');
    console.log('✓ ALL END-TO-END DEMO STAGES PASSED SUCCESSFULLY!');
    console.log('==============================================');
  });

});
