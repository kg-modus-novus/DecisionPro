import crypto from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const repoPath = process.cwd();
const appPath = path.join(repoPath, 'wireframe V1', 'app');
const artifactDir = process.env.SCRIPTORIUM_UI_ARTIFACT_DIR;
const desktopName = process.env.SCRIPTORIUM_UI_DESKTOP_NAME;
if (!artifactDir || !desktopName) throw new Error('Launch this scenario with HiddenDesktopRunner.');

const requireFromCentral = createRequire('C:\\Augen Studios Dropbox\\Ken Greenwood\\The Scriptorium\\Scriptorium Central\\app\\local repo\\package.json');
const { chromium } = requireFromCentral('playwright-core');
const browserPath = await firstExisting([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]);
const devPort = await allocatePort();
const productionPort = await allocatePort();
const logs = { consoleErrors: [], pageErrors: [], devServer: [] };
let devServer;
let staticServer;
let browserServer;
let browser;

try {
  devServer = spawn(
    process.execPath,
    [path.join(appPath, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'],
    { cwd: appPath, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  devServer.stdout.on('data', (chunk) => logs.devServer.push(String(chunk)));
  devServer.stderr.on('data', (chunk) => logs.devServer.push(String(chunk)));
  await waitForHttp(`http://127.0.0.1:${devPort}/`);

  browserServer = await chromium.launchServer({
    executablePath: browserPath,
    headless: false,
    args: ['--disable-gpu', '--disable-background-networking', '--no-first-run'],
  });
  browser = await chromium.connect(browserServer.wsEndpoint());
  const browserProcess = browserServer.process();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) logs.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => logs.pageErrors.push(error.message));

  const localRoute = `http://127.0.0.1:${devPort}/`;
  await page.goto(localRoute, { waitUntil: 'networkidle', timeout: 60_000 });
  await assertLoginDefaults(page, { expectPasswordPrefill: true });
  const autoLogin = page.getByRole('button', { name: 'AutoLogin', exact: true });
  if (await autoLogin.count() !== 1) throw new Error('Local development did not render exactly one AutoLogin button.');
  const localScreenshot = 'login-local-with-autologin.png';
  await page.locator('.demo-login-card').screenshot({ path: path.join(artifactDir, localScreenshot) });
  await autoLogin.click();
  await page.locator('.app-shell').waitFor();

  await stopChild(devServer);
  devServer = null;
  staticServer = await startStaticServer(path.join(appPath, 'dist'), productionPort);

  const productionRoute = `http://127.0.0.1:${productionPort}/`;
  await page.goto(productionRoute, { waitUntil: 'networkidle', timeout: 60_000 });
  await assertLoginDefaults(page, { expectPasswordPrefill: false });
  if (await page.getByRole('button', { name: 'AutoLogin', exact: true }).count() !== 0) {
    throw new Error('The production build rendered AutoLogin.');
  }

  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /incorrect/i }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill('Xeno123');
  const productionScreenshot = 'login-production-no-autologin.png';
  await page.locator('.demo-login-card').screenshot({ path: path.join(artifactDir, productionScreenshot) });
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.locator('.app-shell').waitFor();

  if (logs.consoleErrors.length || logs.pageErrors.length) {
    throw new Error(`Browser errors: ${[...logs.consoleErrors, ...logs.pageErrors].join(' | ')}`);
  }

  const sourceFiles = [
    'wireframe V1/app/src/components/DemoLoginGate.jsx',
    'wireframe V1/app/src/main.jsx',
    'wireframe V1/app/src/styles.css',
  ];
  const source = await Promise.all(sourceFiles.map(async (relativePath) => ({
    relativePath,
    sha256: crypto.createHash('sha256').update(await readFile(path.join(repoPath, relativePath))).digest('hex'),
  })));
  await writeJson('manifest.json', {
    schemaVersion: 1,
    evidenceClass: 'isolated-rendered',
    claim: 'DecisionPro gates dashboard access behind demo credentials, prefills the password and exposes AutoLogin only in local development, leaves the online password blank, rejects incorrect credentials, and opens the dashboard after valid authentication.',
    repoPath,
    routes: { local: localRoute, productionBuild: productionRoute },
    executablePath: browserPath,
    browserVersion: await browser.version(),
    viewport: { width: 1440, height: 960, deviceScaleFactor: 1, reducedMotion: 'reduce' },
    processProof: { desktopName, driverPid: process.pid, browserPid: browserProcess?.pid },
    assertions: [
      'User ID defaults to DemoUser. Local development prefills password Xeno123; production leaves password blank.',
      'Local development renders AutoLogin and it opens the dashboard.',
      'The production build does not render AutoLogin or prefill the password.',
      'The production login rejects an incorrect password and accepts the demo credentials.',
    ],
    screenshots: [localScreenshot, productionScreenshot],
    source,
  });
} catch (error) {
  await writeJson('failure.json', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  });
  throw error;
} finally {
  const cleanup = [];
  if (browser) await browser.close().catch((error) => cleanup.push({ target: 'browser', error: String(error) }));
  if (browserServer) await browserServer.close().catch((error) => cleanup.push({ target: 'browserServer', error: String(error) }));
  if (devServer) await stopChild(devServer).catch((error) => cleanup.push({ target: 'dev-server', error: String(error) }));
  if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
  cleanup.push({ target: 'servers', exited: true });
  await writeJson('cleanup-assertion.json', { passed: cleanup.every((item) => !item.error), results: cleanup });
  await writeJson('browser-console.json', logs);
}

console.log(JSON.stringify({ passed: true, evidenceClass: 'isolated-rendered', artifactDir }));

async function assertLoginDefaults(page, { expectPasswordPrefill }) {
  await page.getByRole('heading', { name: 'Sign in to DecisionPro', exact: true }).waitFor();
  if (await page.getByLabel('User ID', { exact: true }).inputValue() !== 'DemoUser') throw new Error('User ID did not default to DemoUser.');
  const password = page.getByLabel('Password', { exact: true });
  const expectedPassword = expectPasswordPrefill ? 'Xeno123' : '';
  if (await password.inputValue() !== expectedPassword) {
    throw new Error(expectPasswordPrefill
      ? 'Password did not default to Xeno123 in local development.'
      : 'Production password field was auto-populated.');
  }
  if (await password.getAttribute('type') !== 'password') throw new Error('Password field is not masked.');
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* continue */ }
  }
  throw new Error('No supported Chromium executable found.');
}

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function writeJson(name, value) {
  await writeFile(path.join(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function startStaticServer(root, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
      const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
      let target = path.join(root, relative);
      if (!path.extname(target)) target = path.join(root, 'index.html');
      const content = await readFile(target);
      response.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' });
      response.end(content);
    } catch {
      const content = await readFile(path.join(root, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(content);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}
