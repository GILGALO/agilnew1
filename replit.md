# TradeBot.ai

## Overview

TradeBot.ai is an AI-powered forex/binary options trading signal generator. The application provides real-time trading signals with confidence scores, market session tracking, trade history, and configurable settings including Telegram integration. Users can generate AI-analyzed trading signals for currency pairs, view active and historical signals, and track their trading performance.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state with automatic polling (5s intervals for signals)
- **Styling**: Tailwind CSS with custom dark theme optimized for trading dashboards
- **UI Components**: shadcn/ui component library (New York style) with extensive Radix UI primitives
- **Animations**: Framer Motion for signal card transitions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints under /api prefix with Zod validation
- **AI Integration**: OpenAI API via Replit AI Integrations for signal generation and market analysis
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage

### Data Layer
- **Database**: PostgreSQL (provisioned via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` - contains signals, tradeHistory, and settings tables
- **Migrations**: Drizzle Kit with `db:push` command for schema sync

### Key Data Models
1. **Signals**: Trading signals with pair, action (BUY/SELL/CALL/PUT), confidence score, time window, and AI analysis
2. **Trade History**: Completed trades linked to signals with entry/exit prices and win/loss results
3. **Settings**: App configuration including Telegram integration tokens and auto-trading preferences

### Build System
- **Development**: `tsx server/index.ts` with Vite middleware for HMR
- **Production**: esbuild bundles server to `dist/index.cjs`, Vite builds client to `dist/public`
- **Type Checking**: Strict TypeScript with path aliases configured in tsconfig.json

## External Dependencies

### AI Services
- **OpenAI API**: Signal generation and market analysis via Replit AI Integrations
  - Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Used for generating trading signals with confidence scores and analysis text

### Database
- **PostgreSQL**: Primary data store
  - Connection via `DATABASE_URL` environment variable
  - Session storage via connect-pg-simple

### Planned Integrations (configured but may need setup)
- **Telegram**: Bot integration for signal notifications
  - Stores bot token and group ID in settings table
- **Auto-Trading**: Toggle in settings (implementation pending)

### Development Tools
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (development only)