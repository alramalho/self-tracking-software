const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, '.release/widgets-preview');
const screenshots = path.resolve(root, '../../docs/reviews/widgets/screens');
const app = path.join(output, 'WidgetPreview.app');
const env = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
delete env.SDKROOT;
const run = (tool, args) => execFileSync(tool, args, { env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
fs.mkdirSync(app, { recursive: true });
fs.mkdirSync(screenshots, { recursive: true });
const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
run('xcrun', ['swiftc', '-parse-as-library', '-target', 'arm64-apple-ios17.0-simulator', '-sdk', sdk,
  '-module-cache-path', path.join(output, 'swift-cache'),
  path.join(root, 'native/TrackingWidgets/TrackingWidgetModels.swift'), path.join(root, 'native/TrackingWidgets/TrackingWidgetViews.swift'),
  path.join(__dirname, 'widget-preview.swift'), '-o', path.join(app, 'WidgetPreview')]);
fs.writeFileSync(path.join(app, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>so.tracking.widgetpreview</string>
<key>CFBundleExecutable</key><string>WidgetPreview</string>
<key>CFBundleName</key><string>WidgetPreview</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>UILaunchScreen</key><dict/>
</dict></plist>`);
run('codesign', ['--force', '--sign', '-', app]);
const device = process.env.E2E_IOS_DEVICE;
if (!device) throw new Error('Set E2E_IOS_DEVICE to a dedicated, booted iOS simulator.');
run('xcrun', ['simctl', 'install', device, app]);
async function capture() {
  for (const theme of ['light', 'dark']) {
    try { run('xcrun', ['simctl', 'terminate', device, 'so.tracking.widgetpreview']); } catch {}
    const container = run('xcrun', ['simctl', 'get_app_container', device, 'so.tracking.widgetpreview', 'data']);
    const documents = path.join(container, 'Documents');
    fs.mkdirSync(documents, { recursive: true });
    for (const file of fs.readdirSync(documents).filter(file => file.endsWith(`-${theme}.png`))) fs.unlinkSync(path.join(documents, file));
    run('xcrun', ['simctl', 'launch', device, 'so.tracking.widgetpreview', theme]);
    for (let i = 0; i < 40; i++) {
      if (fs.existsSync(path.join(container, `Documents/stale-${theme}.png`))) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!fs.existsSync(path.join(documents, `stale-${theme}.png`))) throw new Error(`Native ${theme} renders did not finish.`);
    for (const file of fs.readdirSync(path.join(container, 'Documents')).filter(file => file.endsWith(`-${theme}.png`))) {
      fs.copyFileSync(path.join(container, 'Documents', file), path.join(screenshots, file));
    }
    run('xcrun', ['simctl', 'io', device, 'screenshot', path.join(screenshots, `simulator-${theme}.png`)]);
  }
  console.log(`Native widget view renders and simulator screenshots: ${screenshots}`);
}
capture().catch(error => { console.error(error.message); process.exitCode = 1; });
