const fs = require("node:fs");
const path = require("node:path");

// Preserve the exact temporary PNG handed to iOS before share completion deletes it.
// Photos saving is not reliable on every simulator runtime.
exports.captureWorkoutExports = (container, output) => {
  const temp = path.join(container, "tmp", "ReactNative");
  fs.mkdirSync(output, { recursive: true });
  const files = new Map();
  const timer = setInterval(() => {
    if (!fs.existsSync(temp)) return;
    for (const name of fs.readdirSync(temp)) {
      if (!name.endsWith(".png") || files.has(name)) continue;
      const target = path.join(output, `${files.size + 1}.png`);
      try {
        // captureRef finishes writing before the native share sheet appears.
        const source = path.join(temp, name);
        if (!fs.statSync(source).size) continue;
        fs.copyFileSync(source, target);
        files.set(name, target);
      } catch { /* Capture may be released between listing and copying. */ }
    }
  }, 100);
  return { files, stop: () => clearInterval(timer) };
};
