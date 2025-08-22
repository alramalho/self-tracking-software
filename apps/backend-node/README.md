# Tracking.so Backend (Node.js)

This is the new Node.js backend for tracking.so, migrated from the FastAPI/MongoDB implementation to Express.js/Prisma/PostgreSQL.

## Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk (same as original)
- **Logging**: Winston
- **Error Handling**: Custom middleware with Telegram notifications
- **Security**: Helmet, CORS, Rate limiting

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Environment variables (see `.env.example`)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── routes/               # Express route handlers
├── middleware/           # Custom middleware
├── services/             # Business logic services
├── utils/                # Utility functions
└── types/                # TypeScript type definitions
```

## Migration Status

This backend is currently in migration from the FastAPI version. The following routes are implemented:

- [x] Basic Express.js setup with middleware
- [x] Prisma schema for PostgreSQL
- [x] Error handling and logging
- [x] Telegram notifications
- [ ] Users routes
- [ ] Activities routes
- [ ] Plans routes
- [ ] Metrics routes
- [ ] Messages routes
- [ ] Notifications routes
- [ ] Onboarding routes
- [ ] Admin routes
- [ ] Clerk integration
- [ ] AI routes (assistants to be implemented later)
- [ ] Stripe routes

## Environment Variables

See `.env.example` for all required environment variables.

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes:

- Users with authentication and preferences
- Activities and activity entries
- Plans with sessions and milestones
- Metrics and metric entries
- Messages and notifications
- Friend requests and recommendations
- Stripe integration for payments

## API Endpoints

All routes are prefixed with `/api/`:

- `/api/users` - User management
- `/api/activities` - Activity tracking
- `/api/plans` - Goal planning
- `/api/metrics` - Custom metrics
- `/api/messages` - User messaging
- `/api/notifications` - Notification system
- `/api/onboarding` - User onboarding
- `/api/admin` - Administrative functions
- `/api/clerk` - Authentication webhooks
- `/api/ai` - AI-powered features
- `/api/stripe` - Payment processing

## Development Notes

- All routes currently return placeholder responses
- The schema is designed to be compatible with the existing frontend
- Error handling includes automatic Telegram notifications
- Logging is structured using Winston
- Rate limiting is applied to all routes