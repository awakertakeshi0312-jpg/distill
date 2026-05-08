import { expect, test } from '@playwright/test';

const VAULT_PASSPHRASE = 'correct horse battery staple';
const BROWSER_VAULT_DB_NAME = 'distill-browser-vault';
const BROWSER_VAULT_STORE_NAME = 'vaults';
const BROWSER_VAULT_KEY = 'distill.vault.v1';

async function clearBrowserVault(page: import('@playwright/test').Page) {
  await page.evaluate(
    ({ dbName }) =>
      new Promise<void>((resolve) => {
        window.localStorage.clear();
        const request = window.indexedDB.deleteDatabase(dbName);

        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      }),
    { dbName: BROWSER_VAULT_DB_NAME },
  );
}

async function readBrowserVault(page: import('@playwright/test').Page, key = BROWSER_VAULT_KEY) {
  return page.evaluate(
    ({ dbName, storeName, valueKey }) =>
      new Promise<string | null>((resolve, reject) => {
        const request = window.indexedDB.open(dbName, 1);

        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onerror = () => reject(request.error ?? new Error('Could not open test IndexedDB vault.'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, 'readonly');
          const readRequest = transaction.objectStore(storeName).get(valueKey);

          readRequest.onsuccess = () => resolve(typeof readRequest.result === 'string' ? readRequest.result : null);
          readRequest.onerror = () => reject(readRequest.error ?? new Error('Could not read test IndexedDB vault.'));
          transaction.oncomplete = () => database.close();
        };
      }),
    { dbName: BROWSER_VAULT_DB_NAME, storeName: BROWSER_VAULT_STORE_NAME, valueKey: key },
  );
}

async function waitForBrowserVaultWrite(page: import('@playwright/test').Page, previousVault?: string | null) {
  await page.waitForFunction(
    async ({ dbName, storeName, valueKey, previous }) => {
      const stored = await new Promise<string | null>((resolve, reject) => {
        const request = window.indexedDB.open(dbName, 1);

        request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB vault.'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, 'readonly');
          const readRequest = transaction.objectStore(storeName).get(valueKey);

          readRequest.onsuccess = () => resolve(typeof readRequest.result === 'string' ? readRequest.result : null);
          readRequest.onerror = () => reject(readRequest.error ?? new Error('Could not read IndexedDB vault.'));
          transaction.oncomplete = () => database.close();
        };
      });

      if (typeof stored !== 'string' || !stored.includes('distill.encrypted-vault')) {
        return false;
      }

      if (window.localStorage.getItem(valueKey) !== null) {
        return false;
      }

      return previous === undefined ? true : stored !== previous;
    },
    {
      dbName: BROWSER_VAULT_DB_NAME,
      storeName: BROWSER_VAULT_STORE_NAME,
      valueKey: BROWSER_VAULT_KEY,
      previous: previousVault,
    },
  );
}

async function openUnlockedVault(page: import('@playwright/test').Page, passphraseValue = VAULT_PASSPHRASE) {
  await page.goto('/');

  const passphrase = page.locator('input[aria-label="Vault passphrase"]');
  await expect(passphrase).toBeVisible();
  await passphrase.fill(passphraseValue);

  const confirmation = page.locator('input[aria-label="Confirm vault passphrase"]');

  if ((await confirmation.count()) > 0) {
    await confirmation.fill(passphraseValue);
    await page.locator('.vaultForm button[type="submit"]').click();
  } else {
    await page.locator('.vaultForm button[type="submit"]').click();
  }

  await expect(page.locator('.shell')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearBrowserVault(page);
});

test('Japanese UI is available by default', async ({ page }) => {
  await openUnlockedVault(page);

  const today = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full' }).format(new Date());
  await expect(page.getByText(today)).toBeVisible();
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('.localeToggle button.active')).toHaveCount(1);

  await page.locator('a[href="#graph"]').click();
  await expect(page.locator('#graph')).toBeVisible();
});

test('MVP browser smoke: capture, search, graph, project, archive', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();

  await expect(page.getByRole('heading', { name: 'Inbox triage' })).toBeVisible();

  const capture = page.getByLabel('Capture a thought');
  await capture.fill('Review [[Semantic Retrieval]] with @Aki #search');
  await page.getByRole('button', { name: 'Capture' }).click();

  await expect(page.locator('#inbox .thoughtBlock').filter({ hasText: 'Review [[Semantic Retrieval]] with @Aki #search' })).toBeVisible();
  await expect(page.getByText('search').first()).toBeVisible();

  await page.getByLabel('Daily journal').fill('Today I connected capture with a journal lane.');
  await page.getByRole('button', { name: 'Save diary' }).click();
  await expect(page.locator('#today')).toContainText('Today I connected capture with a journal lane.');
  await expect(page.locator('#today')).toContainText('journal');
  await page.locator('a[href="#inbox"]').click();

  await page.locator('a[href="#search"]').click();
  await page.locator('#search input').fill('Aki');
  await expect(page.locator('.resultRow').filter({ hasText: 'Review [[Semantic Retrieval]]' })).toBeVisible();

  await page.locator('#search input').fill('remembering');
  await expect(page.locator('.resultRow').filter({ hasText: 'resurfaced' })).toBeVisible();
  await expect(page.locator('.resultRow').filter({ hasText: 'Semantic overlap' }).first()).toBeVisible();

  await page.locator('a[href="#graph"]').click();
  await expect(page.locator('#graph')).toBeVisible();
  await page.locator('#graph .graphFilterGroup button').nth(2).click();
  await expect(page.locator('#graph .graphNeighborItem, #graph .emptyState').last()).toBeVisible();

  await page.locator('a[href="#projects"]').click();
  await page.locator('#projects input').first().fill('Launch Plan');
  await page.locator('#projects input').nth(1).fill('Ship MVP safely');
  await page.locator('#projects .projectFormGrid button').click();
  await expect(page.locator('#projects')).toContainText('Launch Plan');

  await page.locator('a[href="#inbox"]').click();
  await page
    .locator('#inbox .thoughtBlock')
    .filter({ hasText: 'Review [[Semantic Retrieval]]' })
    .locator('.inlineEditButton')
    .last()
    .click();
  await page.locator('a[href="#archive"]').click();
  await expect(page.locator('#archive')).toContainText('Review [[Semantic Retrieval]]');
});

test('JSON backup can be restored through the UI', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('a[href="#settings"]').click();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'distill-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        exportedAt: '2026-05-06T00:00:00.000Z',
        schemaVersion: 1,
        projects: [{ id: 'project-imported', name: 'Imported Project', signal: 'Restore test', status: 'Active' }],
        blocks: [
          {
            id: 'block-imported',
            content: 'Imported backup block [[Restore]] #backup',
            noteId: 'daily-2026-05-06',
            projectId: 'project-imported',
            capturedAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
            tags: ['backup'],
            links: ['Restore'],
            state: 'linked',
          },
        ],
      }),
    ),
  });

  await expect(page.getByText('Restore preview ready for 1 blocks and 1 projects.')).toBeVisible();
  await expect(page.locator('.restorePreviewBox')).toContainText('Added: 1');
  await expect(page.locator('.restorePreviewBox')).toContainText('Removed: 3');
  await page.getByRole('button', { name: 'Apply restore' }).click();
  await expect(page.getByText('Restored 1 blocks and 1 projects.')).toBeVisible();
  await page.locator('a[href="#search"]').click();
  await page.locator('#search input').fill('Imported');
  await expect(page.locator('.resultRow').filter({ hasText: 'Imported backup block' })).toBeVisible();
});

test('Markdown import appends blocks without replacing the store', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('a[href="#settings"]').click();

  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: 'notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Meeting Notes\n\n- Imported markdown item with @Mina #meeting [[Context]]'),
  });

  await expect(page.getByText('Imported 1 blocks and 1 projects.')).toBeVisible();
  await page.locator('a[href="#search"]').click();
  await page.locator('#search input').fill('markdown');
  await expect(page.locator('.resultRow').filter({ hasText: 'Imported markdown item' })).toBeVisible();
  await page.locator('a[href="#projects"]').click();
  await expect(page.locator('#projects')).toContainText('Meeting Notes');
  await expect(page.locator('#projects')).toContainText('Distill MVP');
});

test('Edit, archive, and restore keep a block usable', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();

  const capture = page.getByLabel('Capture a thought');
  await capture.fill('Archive workflow [[Restore Test]] #qa');
  await page.getByRole('button', { name: 'Capture' }).click();

  const block = page.locator('#inbox .thoughtBlock').filter({ hasText: 'Archive workflow' });
  await block.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Edit thought block').fill('Edited archive workflow [[Restore Test]] #qa #edited');
  await page.locator('.editBlockForm').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#inbox .thoughtBlock').filter({ hasText: 'Edited archive workflow' })).toBeVisible();
  await expect(page.getByText('edited').first()).toBeVisible();

  await page.locator('#inbox .thoughtBlock').filter({ hasText: 'Edited archive workflow' }).getByRole('button', { name: 'Archive' }).click();
  await page.locator('a[href="#archive"]').click();
  await expect(page.locator('#archive')).toContainText('Edited archive workflow');

  await page.locator('#archive .archiveRow').filter({ hasText: 'Edited archive workflow' }).getByRole('button', { name: 'Restore' }).click();
  await page.locator('a[href="#inbox"]').click();
  await expect(page.locator('#inbox .thoughtBlock').filter({ hasText: 'Edited archive workflow' })).toBeVisible();

  await page.locator('#inbox .thoughtBlock').filter({ hasText: 'Edited archive workflow' }).getByRole('button', { name: 'Archive' }).click();
  await page.locator('a[href="#archive"]').click();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Permanently delete this archived block');
    await dialog.accept();
  });
  await page.locator('#archive .archiveRow').filter({ hasText: 'Edited archive workflow' }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.locator('#archive')).not.toContainText('Edited archive workflow');
});

test('Markdown, JSON, and backup exports download files', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('a[href="#settings"]').click();

  const markdownDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Markdown' }).click();
  expect((await markdownDownload).suggestedFilename()).toBe('distill-export.md');

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^JSON$/ }).click();
  expect((await jsonDownload).suggestedFilename()).toBe('distill-export.json');

  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup JSON' }).click();
  expect((await backupDownload).suggestedFilename()).toMatch(/^distill-backup-.+\.json$/);

  await page.locator('.syncBox').scrollIntoViewIfNeeded();
  const syncDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export sync packet' }).click();
  expect((await syncDownload).suggestedFilename()).toMatch(/^distill-sync-.+\.distill-sync\.json$/);
});

test('Update section validates installer launch boundary in browser fallback', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('a[href="#settings"]').click();

  await page.getByPlaceholder('Paste path to Distill_0.1.0_x64-setup.exe').fill('C:\\Downloads\\Distill_0.1.0_x64-setup.exe');
  await page.getByRole('button', { name: 'Start manual update' }).click();
  await expect(page.getByText('Installer launch is available only in the desktop app.')).toBeVisible();
});

test('Mobile PWA readiness panel is available on a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();

  await expect(page.locator('.navList')).toBeVisible();
  await page.locator('a[href="#mobile"]').click();
  await expect(page.locator('.mobilePanel').getByRole('heading', { name: 'Mobile access' })).toBeVisible();
  const pwaPanel = page.locator('.mobilePanel');
  await expect(pwaPanel.getByText('Offline shell')).toBeVisible();
  await expect(pwaPanel.getByText('Network')).toBeVisible();
});

test('People index and graph neighbors respond to captured context', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();

  await page.getByLabel('Capture a thought').fill('Coordinate graph review with @Mina [[Graph Context]] #graph');
  await page.getByRole('button', { name: 'Capture' }).click();

  await page.locator('a[href="#search"]').click();
  await page.locator('#people').scrollIntoViewIfNeeded();
  await expect(page.locator('#people .personCard').filter({ hasText: '@Mina' })).toBeVisible();
  await page.locator('#people .personCard').filter({ hasText: '@Mina' }).getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('.resultRow').filter({ hasText: 'Coordinate graph review' })).toBeVisible();

  await page.locator('a[href="#graph"]').click();
  await page.locator('#graph .graphNode.person').first().click();
  await expect(page.locator('#graph .graphNeighborItem').filter({ hasText: 'Coordinate graph review' }).first()).toBeVisible();
});

test('Project assignment persists after reload in browser fallback', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();

  await page.locator('a[href="#projects"]').click();
  await page.locator('#projects input').first().fill('Persistence Project');
  await page.locator('#projects input').nth(1).fill('Reload verification');
  await page.locator('#projects .projectFormGrid button').click();
  await expect(page.locator('#projects')).toContainText('Persistence Project');

  await page.locator('a[href="#inbox"]').click();
  await page.getByLabel('Capture a thought').fill('Persist assignment [[Persistence]] #state');
  await page.getByRole('button', { name: 'Capture' }).click();
  await waitForBrowserVaultWrite(page);
  const vaultBeforeAssignment = await readBrowserVault(page);
  await page.locator('.inspectorControls select').first().selectOption({ label: 'Persistence Project' });
  await expect(page.locator('#inbox .thoughtBlock').filter({ hasText: 'Persistence Project' })).toBeVisible();
  await waitForBrowserVaultWrite(page, vaultBeforeAssignment);

  await page.locator('.vaultLockButton').click();
  await expect(page.locator('input[aria-label="Vault passphrase"]')).toBeVisible();
  await page.reload();
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('#inbox .thoughtBlock').filter({ hasText: 'Persist assignment' })).toContainText('Persistence Project');
});

test('Vault passphrase can be changed and old passphrase stops unlocking', async ({ page }) => {
  const nextPassphrase = 'new correct horse battery staple';
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('a[href="#settings"]').click();

  await page.locator('.vaultSecurityBox').scrollIntoViewIfNeeded();
  await expect(page.getByText('Before changing the passphrase')).toBeVisible();
  await page.getByLabel('Current vault passphrase').fill(VAULT_PASSPHRASE);
  await page.getByLabel('New vault passphrase', { exact: true }).fill(nextPassphrase);
  await page.getByLabel('Confirm new vault passphrase', { exact: true }).fill(nextPassphrase);
  await page.getByRole('button', { name: 'Change passphrase' }).click();
  await expect(page.getByText('Vault passphrase changed.')).toBeVisible();

  await page.locator('.vaultLockButton').click();
  await expect(page.locator('input[aria-label="Vault passphrase"]')).toBeVisible();

  await page.locator('input[aria-label="Vault passphrase"]').fill(VAULT_PASSPHRASE);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.getByText('Could not unlock the vault. Check the passphrase.')).toBeVisible();
  await expect(page.getByText('Unlock failed recovery checklist')).toBeVisible();
  await expect(page.getByText('NEW_VAULT_PASSPHRASE.txt')).toBeVisible();

  await page.locator('input[aria-label="Vault passphrase"]').fill(nextPassphrase);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.locator('.shell')).toBeVisible();
});

test('Existing vault unlock does not block short legacy passphrases at the form layer', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('.vaultLockButton').click();

  const passphrase = page.locator('input[aria-label="Vault passphrase"]');
  await expect(passphrase).toBeVisible();
  await expect(passphrase).not.toHaveAttribute('minlength');
});

test('Locked vault unlock accepts passphrase copied with outer whitespace', async ({ page }) => {
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('.vaultLockButton').click();

  const passphrase = page.locator('input[aria-label="Vault passphrase"]');
  await expect(passphrase).toBeVisible();
  await passphrase.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, `\n${VAULT_PASSPHRASE}\n`);
  await page.getByRole('button', { name: 'Unlock vault' }).click();

  await expect(page.locator('.shell')).toBeVisible();
});

test('Locked vault can be reset into a new passphrase setup flow', async ({ page }) => {
  const nextPassphrase = 'fresh reset vault passphrase';
  await openUnlockedVault(page);
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('.vaultLockButton').click();

  await page.getByText('Forgot the passphrase?').click();
  await page.getByLabel('Confirm vault reset').fill('RESET');
  await page.getByRole('button', { name: 'Back up and reset vault' }).click();

  await expect(page.getByRole('heading', { name: 'Create your encrypted vault' })).toBeVisible();
  await expect(page.getByText('Previous encrypted vault was backed up to')).toBeVisible();
  await expect(page.getByText('Save the passphrase before continuing')).toBeVisible();

  await page.getByLabel('Vault passphrase', { exact: true }).fill(nextPassphrase);
  await page.getByLabel('Confirm vault passphrase', { exact: true }).fill(nextPassphrase);
  await page.getByRole('button', { name: 'Create vault' }).click();
  await expect(page.locator('.shell')).toBeVisible();

  await page.locator('.vaultLockButton').click();
  await page.getByLabel('Vault passphrase', { exact: true }).fill(VAULT_PASSPHRASE);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.getByText('Could not unlock the vault. Check the passphrase.')).toBeVisible();

  await page.getByLabel('Vault passphrase', { exact: true }).fill(nextPassphrase);
  await page.getByRole('button', { name: 'Unlock vault' }).click();
  await expect(page.locator('.shell')).toBeVisible();
});
