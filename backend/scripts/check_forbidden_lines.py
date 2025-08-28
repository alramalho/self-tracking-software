#!/usr/bin/env python3
"""
Pre-commit hook script to check Next.js config file for forbidden export lines.
Exits with error code 1 if forbidden lines are found, 0 otherwise.
"""

import sys
import os

def check_nextjs_config():
    """Check the Next.js config file for forbidden export lines."""
    
    config_path = "apps/frontend/next.config.mjs"
    
    # Check if file exists
    if not os.path.exists(config_path):
        print(f"Warning: {config_path} not found. Skipping check.")
        return 0
    
    # Forbidden lines to check for
    forbidden_lines = [
        "// export default withSerwist(nextConfig);",
        "export default nextConfig;"
    ]
    
    try:
        with open(config_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        errors_found = []
        
        for line_number, line in enumerate(lines, 1):
            # Strip the line to check for exact matches
            stripped_line = line.strip()
            
            for forbidden_line in forbidden_lines:
                if stripped_line == forbidden_line:
                    errors_found.append((line_number, forbidden_line))
        
        if errors_found:
            print(f"❌ ERROR: Forbidden lines found in {config_path}:")
            print()
            for line_number, forbidden_line in errors_found:
                print(f"  Line {line_number}: {forbidden_line}")
            print()
            print("These lines are not allowed to be committed.")
            print("Please remove or modify these lines before committing.")
            return 1
        else:
            print(f"✅ {config_path} check passed - no forbidden lines found.")
            return 0
            
    except Exception as e:
        print(f"❌ ERROR: Failed to read {config_path}: {e}")
        return 1

if __name__ == "__main__":
    exit_code = check_nextjs_config()
    sys.exit(exit_code)