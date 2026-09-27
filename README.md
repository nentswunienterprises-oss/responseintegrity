# PodDigitizer

A mobile-first operational app that digitizes the 4-Seater Pod system for efficient team management and encounter tracking.

## Overview

PodDigitizer is a full-stack web application designed to streamline pod-based team operations with real-time updates, broadcast messaging, and comprehensive encounter tracking.

## Features

- **Mobile-First Design**: Responsive interface optimized for mobile and tablet devices
- **Pod Management**: Organize and manage 4-seater pod teams
- **Encounter Tracking**: Log and manage encounters with detailed forms and validation
- **Broadcast Messaging**: Real-time broadcast system for team communication
- **User Authentication**: Secure authentication via Supabase
- **Real-Time Updates**: Live data synchronization using React Query
- **Rich Text Editor**: Built-in support for rich text content

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component library
- **React Hook Form** - Form state management
- **React Query** - Server state management
- **Supabase JS** - Database and authentication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Drizzle ORM** - SQL query builder
- **Neon Database** - PostgreSQL hosting

### Database
- **PostgreSQL** (via Neon)
- **Drizzle ORM** for migrations and queries

## Prerequisites

- Node.js 18+ and npm
- Git
- Supabase account (for authentication and database)
- Neon database connection string

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nenterprises/tt-confi.hub.git
cd tt-confi.hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Environment Configuration](#environment-configuration))

4. Push database schema:
```bash
npm run db:push
```

## Environment Configuration

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Database
DATABASE_URL=your_neon_database_url

# Required when emergency DB mode handles Specialist onboarding file uploads
EMERGENCY_DOCUMENT_ENCRYPTION_KEY=your_32_byte_base64_key
```

Generate the onboarding encryption key once and keep it stable for that environment:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Changing this key after files have been uploaded will make previously encrypted emergency-mode onboarding files unreadable. Never commit the real key.

See `.env.example` for a complete template.

## Development

### Running the Development Server

Start both the client and server in development mode:

```bash
npm run dev
```

This runs:
- **Client**: Vite dev server on `http://localhost:5173`
- **Server**: Express server on configured port

### Development Commands

- `npm run dev:client` - Start only the Vite dev server
- `npm run dev:server` - Start only the Express server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes

## Building for Production

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

This creates an optimized build in the `dist/` directory.

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   └── index.html     # HTML entry point
│   └── public/            # Static assets
├── server/                 # Backend Express application
│   ├── index.ts           # Server entry point
│   └── db.ts              # Database configuration
├── shared/                 # Shared types and utilities
├── migrations/            # Database migrations
├── drizzle.config.ts      # Drizzle ORM configuration
└── vite.config.ts         # Vite configuration
```

## Database Migrations

Migrations are managed with Drizzle ORM and located in the `migrations/` directory.

To push schema changes:
```bash
npm run db:push
```

## Deployment

### Hosting Options

- **Frontend**: Vercel, Netlify, GitHub Pages
- **Backend**: Render, Railway, Heroku
- **Database**: Neon PostgreSQL

### Deployment Steps

1. Push all changes to the `main` branch
2. Connect your repository to your hosting platform
3. Set environment variables in your hosting platform's configuration
4. Deploy according to your hosting provider's instructions

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request with a clear description

## License

MIT - See LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Last Updated**: November 2025
