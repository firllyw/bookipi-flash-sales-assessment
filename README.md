# Flash Sale System

A high-concurrency flash sale system built with NestJS, Redis, BullMQ, and PostgreSQL. This system is designed to handle thousands of simultaneous purchase requests while ensuring data consistency and preventing overselling.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLASH SALE SYSTEM                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐    ┌─────────────────────────────────────────┐   │
│   │   Frontend  │───▶│         Flash Sale Backend              │   │
│   │   (React)   │    │            (NestJS)                     │   │
│   │   :5173     │    │             :3000                       │   │
│   └─────────────┘    └───────┬─────────────────────┬───────────┘   │
│                              │                     │               │
│                              ▼                     ▼               │
│                    ┌─────────────────┐   ┌─────────────────┐       │
│                    │     Redis       │   │   PostgreSQL    │       │
│                    │   (Stock/Lua)   │   │    (Orders)     │       │
│                    │     :6379       │   │      :5432      │       │
│                    └────────┬────────┘   └─────────────────┘       │
│                             │                     ▲               │
│                             ▼                     │               │
│                    ┌─────────────────┐            │               │
│                    │    BullMQ       │────────────┘               │
│                    │  (Job Queue)    │                            │
│                    └────────┬────────┘                            │
│                             │                                      │
│                             ▼                                      │
│                    ┌─────────────────┐                            │
│                    │    Consumer     │                            │
│                    │  (Order Worker) │                            │
│                    └─────────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 11.x | Backend framework providing modular architecture, dependency injection, and TypeScript support |
| **PostgreSQL** | 14+ | Primary database for persistent storage of flash sales and orders |
| **Prisma** | 6.x | Type-safe ORM for database operations with excellent TypeScript integration |
| **Redis** | 7.x | In-memory data store for atomic stock management using Lua scripts |
| **BullMQ** | 5.x | Robust job queue for async order processing with retry capabilities |
| **ioredis** | 5.x | High-performance Redis client for Node.js |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.x | UI library for building interactive user interfaces |
| **Vite** | 7.x | Fast build tool and development server |
| **TypeScript** | 5.x | Type safety and improved developer experience |
| **Tailwind CSS** | 4.x | Utility-first CSS framework for rapid UI development |
| **React Router** | 7.x | Client-side routing |
| **Axios** | 1.x | HTTP client for API requests |

### Redis with Lua Scripts
- **Atomic Operations**: Lua scripts ensure that checking stock and updating it happens in a single atomic operation, preventing race conditions
- **High Throughput**: Redis can handle 100,000+ operations per second, perfect for flash sale scenarios
- **No Overselling**: The Lua script checks stock, decrements it, and adds user to winners set in one atomic transaction

### BullMQ
- **Reliability**: Built-in retry mechanisms with exponential backoff ensure orders are eventually persisted
- **Durability**: Jobs are persisted in Redis, surviving service restarts

### PostgreSQL
- **ACID Compliance**: Ensures data integrity for order records
- **Unique Constraints**: Prevents duplicate orders at the database level (idempotency)

### NestJS
- **Modular Architecture**: Clean separation of concerns with modules
- **Dependency Injection**: Easy to test and mock dependencies
- **TypeScript First**: Full type safety across the application

## Project Structure

```
bookipi/
├── flash-sale-backend/          # NestJS Backend
│   ├── apps/
│   │   ├── flash-sale-backend/  # Main API application
│   │   └── consumer/            # Order processing worker
│   ├── libs/
│   │   └── shared/              # Shared modules (Prisma, Redis, Queue)
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   └── test/
│       └── load-test/           # Load testing scripts
│
├── flash-sale-frontend/         # React Frontend
│   ├── src/
│   │   ├── api/                 # API client
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   └── types/               # TypeScript types
│   └── ...
│
└── README.md                    # This file
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 7+
- npm or yarn

## Getting Started

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd bookipi

# Install backend dependencies
cd flash-sale-backend
npm install

# Install frontend dependencies
cd ../flash-sale-frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `flash-sale-backend` directory:

```env
# Database
DATABASE_URL="postgresql://postgres:secret@localhost:5432/flashsale?schema=public"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
```

### 3. Set Up the Database

```bash
cd flash-sale-backend

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push
```

### 4. Start the Services

You need to run three services: the backend API, the consumer worker, and the frontend.

**Terminal 1 - Backend API:**
```bash
cd flash-sale-backend
npm run start:dev
```
The API will be available at `http://localhost:3000`

**Terminal 2 - Consumer Worker:**
```bash
cd flash-sale-backend
npm run start:consumer:dev
```

**Terminal 3 - Frontend:**
```bash
cd flash-sale-frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/flash-sales` | Create a new flash sale |
| `GET` | `/flash-sales` | List all flash sales |
| `GET` | `/flash-sales/:id` | Get flash sale details |
| `POST` | `/flash-sales/:id/purchase` | Attempt to purchase an item |
| `GET` | `/flash-sales/:id/orders` | Get all orders (winners) for a sale |
| `GET` | `/flash-sales/:id/orders/:email` | Check order status for a user |

## Running Tests

### Unit Tests

```bash
cd flash-sale-backend
npm test
```

### Unit Tests with Coverage

```bash
cd flash-sale-backend
npm run test:cov
```

### Integration (E2E) Tests

**Note:** Integration tests require PostgreSQL and Redis to be running.

```bash
cd flash-sale-backend
npm run test:e2e
```

### Load Testing

The load test script allows you to simulate concurrent purchase attempts:

```bash
cd flash-sale-backend
npm run test:load
```

This will present an interactive menu where you can:
1. Run a configurable load test with X concurrent users
2. Run predefined edge case tests

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Customer view - browse and select flash sales |
| `/sale/:id` | Customer view - purchase a specific sale |
| `/admin` | Admin dashboard - list all sales with stats |
| `/admin/create` | Create a new flash sale |
| `/admin/sale/:id` | View sale details and winners |

## Key Features

### Customer Features
- Real-time stock updates (polling every 2 seconds)
- Countdown timer for sale duration
- Clear feedback messages (success, sold out, already purchased)
- Email-based user identification via URL params

### Admin Features
- View all flash sales with statistics
- Create new flash sales with date/time pickers
- View winners table for each sale
- Real-time order tracking

### System Features
- **Atomic Stock Management**: Redis Lua scripts prevent overselling
- **Idempotent Order Processing**: Duplicate orders are handled gracefully
- **Retry with Exponential Backoff**: Failed jobs are retried automatically
- **Time Window Validation**: Purchases only allowed during active sale period

## Testing Edge Cases

The system has been tested for the following edge cases:

1. **Duplicate Purchase Prevention**: Same user cannot buy twice
2. **Exact Stock Match**: N users can purchase exactly N items
3. **Overselling Prevention**: System never sells more than available stock
4. **Single Item Stock**: Boundary condition with stock = 1
5. **Time Window Validation**: Purchases rejected before start or after end
6. **Database Consistency**: Redis wins match database orders

