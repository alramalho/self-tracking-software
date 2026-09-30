// Verify the exact hosted installer, manifest identity, and complete IPA hash.
// Signed URLs remain in the local ignored distribution record and never print here.
const fs = require('node:fs');
const crypto = require('node:crypto');
(async () => {
  const record = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const installer = await fetch(record.installUrl);
  if (!installer.ok) throw Error(`Installer HTTP ${installer.status}`);
  const html = await installer.text();
  if (!html.includes(`Build ${record.buildNumber}`)) throw Error('Installer build differs');
  const itms = html.match(/href="(itms-services:[^"]+)"/);
  if (!itms) throw Error('Install link absent');
  const link = new URL(itms[1].replaceAll('&amp;', '&'));
  const manifestResponse = await fetch(link.searchParams.get('url'));
  if (!manifestResponse.ok) throw Error(`Manifest HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.text();
  if (!manifest.includes(`<string>${record.buildNumber}</string>`) || !manifest.includes('<string>so.tracking.app</string>')) throw Error('Manifest identity differs');
  const packageUrl = manifest.match(/<key>url<\/key><string>([^<]+)<\/string>/)?.[1].replaceAll('&amp;', '&');
  if (!packageUrl) throw Error('IPA URL absent');
  const ipa = await fetch(packageUrl);
  if (!ipa.ok) throw Error(`IPA HTTP ${ipa.status}`);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for await (const chunk of ipa.body) { hash.update(chunk); bytes += chunk.length; }
  const digest = hash.digest('hex');
  if (digest !== record.sha256) throw Error('Hosted IPA hash differs from verified local IPA');
  console.log(`Hosted build ${record.buildNumber}: installer, manifest, ${bytes} IPA bytes and SHA-256 verified.`);
})().catch(error => { console.error(error.message); process.exit(1); });
