#!/usr/bin/env tsx
/**
 * Pre-commit hook script to check Next.js config file for forbidden export lines.
 * Exits with error code 1 if forbidden lines are found, 0 otherwise.
 */

import fs from 'fs';

interface ErrorFound {
    lineNumber: number;
    forbiddenLine: string;
}

function checkNextjsConfig(): number {
    const configPath = "apps/frontend/next.config.mjs";
    
    // Check if file exists
    if (!fs.existsSync(configPath)) {
        console.log(`Warning: ${configPath} not found. Skipping check.`);
        return 0;
    }
    
    // Forbidden lines to check for
    const forbiddenLines: string[] = [
        "// export default withSerwist(nextConfig);",
        "export default nextConfig;"
    ];
    
    try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const lines = fileContent.split('\n');
        
        const errorsFound: ErrorFound[] = [];
        
        lines.forEach((line, index) => {
            // Strip the line to check for exact matches
            const strippedLine = line.trim();
            
            forbiddenLines.forEach(forbiddenLine => {
                if (strippedLine === forbiddenLine) {
                    errorsFound.push({ lineNumber: index + 1, forbiddenLine });
                }
            });
        });
        
        if (errorsFound.length > 0) {
            console.log(`❌ ERROR: Forbidden lines found in ${configPath}:`);
            console.log();
            errorsFound.forEach(({ lineNumber, forbiddenLine }) => {
                console.log(`  Line ${lineNumber}: ${forbiddenLine}`);
            });
            console.log();
            console.log("These lines are not allowed to be committed.");
            console.log("Please remove or modify these lines before committing.");
            return 1;
        } else {
            console.log(`✅ ${configPath} check passed - no forbidden lines found.`);
            return 0;
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ ERROR: Failed to read ${configPath}: ${errorMessage}`);
        return 1;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const exitCode = checkNextjsConfig();
    process.exit(exitCode);
}

export { checkNextjsConfig };