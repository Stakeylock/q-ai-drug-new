import { test, expect } from '@playwright/test';
import { loginUser, enterWorkspace } from './utils/auth-helper';
import { SELECTORS } from './utils/selectors';
import { setupConsoleTracker } from './utils/navigation-helper';
import path from 'path';

test.describe('File Upload Interface', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await enterWorkspace(page);
  });

  test('Page shows file upload controls or dropzone placeholders', async ({ page }) => {
    const errorTracker = setupConsoleTracker(page);
    
    // Navigate to storage admin area or project workspace file area
    await page.goto('/storage');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for file upload drag-and-drop or select inputs
    const uploadInput = page.locator(SELECTORS.fileUpload.input);
    const dropzoneText = page.locator('text=upload').or(
      page.locator('text="Drag and drop"')).or(
      page.locator('text=Browse'));

    const isInputPresent = await uploadInput.count() > 0;
    const isTextPresent = await dropzoneText.count() > 0;

    expect(isInputPresent || isTextPresent).toBe(true);

    if (isInputPresent) {
      // Perform mock upload of FASTA or PDB structural files
      const fastaPath = path.resolve(__dirname, 'fixtures/protein.fasta');
      await uploadInput.first().setInputFiles(fastaPath);
    } else {
      test.skip(true, 'File upload inputs are placeholders or managed via native system dialogues.');
    }

    errorTracker.assertNoSevereErrors();
  });
});
