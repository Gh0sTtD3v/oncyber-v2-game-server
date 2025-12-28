# Colyseus Game Server

Modular Colyseus game server package for Fastify integration.

## Structure

```
├── lib/colyseus/       # Game logic (rooms, cyber engine)
├── plugins/            # Fastify plugins
│   └── colyseus.ts    # Colyseus server initialization
├── routes/             # Fastify routes
│   └── colyseus.ts    # Game endpoints
└── utils/colyseus/     # Utilities
    ├── auth.ts        # JWT verification
    ├── constants.ts   # Constants
    └── timeout.ts     # Timeout logic
```

## Usage

In your Fastify server:

```typescript
import colyseusPlugin from './plugins/colyseus';
import colyseusRoutes from './routes/colyseus';

// Register Colyseus plugin
await fastify.register(colyseusPlugin);

// Register game routes
await fastify.register(colyseusRoutes);
```

## Endpoints

- `GET /getRoom` - Get room by ID
- `GET /getRooms` - Get all rooms
- `POST /join` - Join or create a room
- `POST /create` - Create a new room

## Environment Variables

- `SECRET_JWT_KEY` - JWT secret for auth
- `SINGLE_ROOM` - Enable singleton room mode
- `ROOM_IDLE_TIMEOUT_SEC` - Idle timeout in seconds
