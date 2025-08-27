# Backend Node.js Scripts

This directory contains utility scripts for the Node.js backend.

## update_allowed_routes.ts

This script extracts all routes from the Express.js application and updates the AWS WAF allowed routes file.

### Purpose
Similar to the Python backend's `update_allowed_routes.py`, this script:
- Reads all Express.js routes from the application
- Converts route parameters from Express format (`:param`) to WAF format (`{param}`)
- Updates `../aws-infrastructure/allowed-routes.txt` with the current routes
- Ensures WAF rules allow traffic to all valid endpoints

### Usage

```bash
# Run from the backend-node directory
npm run update-routes

# Or run directly with tsx
tsx scripts/update_allowed_routes.ts
```

### How it works
1. **Manual Route Definition**: Instead of trying to introspect the running Express app (which can be complex due to middleware and dynamic routing), the script uses a manually maintained list of all routes
2. **Route Transformation**: Converts Express.js route parameters (`:username`) to AWS WAF format (`{username}`)
3. **File Generation**: Writes all routes to the AWS infrastructure directory for deployment

### Maintenance
When adding new routes to the Express.js application:
1. Add the corresponding route pattern to the `getAllRoutes()` function in this script
2. Run `npm run update-routes` to update the allowed routes file
3. Deploy your AWS infrastructure to update the WAF rules

### Route Format
- Express routes: `/api/users/:username` 
- WAF routes: `/api/users/{username}`
- Static routes remain unchanged: `/api/users/all-users`

### Output
The script generates `../aws-infrastructure/allowed-routes.txt` with:
- Header comments indicating the file is auto-generated
- All routes in alphabetical order
- WAF-compatible parameter format