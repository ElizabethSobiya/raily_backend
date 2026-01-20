# Railway Tracking App - Backend API

A high-performance backend for the Indian Railways tracking app built with **Bun/Node.js**, **Hono**, **PostgreSQL**, and **Redis**.

## Tech Stack

- **Runtime**: Node.js 22+ (Bun compatible)
- **Framework**: Hono (ultra-fast web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis
- **Authentication**: JWT
- **Real-time**: Socket.IO
- **Task Queue**: BullMQ

## Getting Started

### Prerequisites

- Node.js 22+ or Bun
- PostgreSQL 16+
- Redis 7+
- Docker (optional)

### Installation

```bash
# Clone the repository
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Database Setup

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d db redis

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### Development

```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
```

### Production

```bash
# Build
npm run build

# Start
npm run start
```

## API Endpoints

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login
- `POST /v1/auth/refresh` - Refresh token
- `GET /v1/auth/me` - Get current user

### Trains
- `GET /v1/trains/search` - Search trains
- `GET /v1/trains/:number` - Get train details
- `GET /v1/trains/:number/schedule` - Get train schedule
- `GET /v1/trains/:number/live` - Get live status
- `GET /v1/trains/between/stations` - Find trains between stations

### PNR
- `GET /v1/pnr/:pnr` - Get PNR status
- `POST /v1/pnr/check` - Batch check PNRs

### Stations
- `GET /v1/stations` - List stations
- `GET /v1/stations/search` - Search stations
- `GET /v1/stations/:code` - Get station details

### Trips
- `GET /v1/trips` - Get user's trips
- `POST /v1/trips` - Create trip
- `GET /v1/trips/:id` - Get trip details
- `PUT /v1/trips/:id` - Update trip
- `DELETE /v1/trips/:id` - Delete trip
- `GET /v1/trips/:id/live` - Live tracking

### Notifications
- `GET /v1/notifications` - Get notifications
- `PUT /v1/notifications/:id/read` - Mark as read

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── routes/         # API routes
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic
│   ├── middleware/     # Express middleware
│   ├── utils/          # Helper functions
│   └── index.ts        # App entry point
├── drizzle/
│   ├── schema.ts       # Database schema
│   └── migrations/     # SQL migrations
├── tests/              # Test files
├── scripts/            # CLI scripts
└── docker-compose.yml  # Docker setup
```

## Environment Variables

See `.env.example` for all available configuration options.

## Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
```

## License

MIT
