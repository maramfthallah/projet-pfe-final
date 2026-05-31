# SmartCodeReview — Backend API

Backend API for SmartCodeReview, an AI-powered code analysis and conversation platform.

## Tech Stack

- **Runtime:** Node.js (>=18)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT (jsonwebtoken) + bcryptjs

## Project Structure

```
├── config/
│   └── db.js                 # MongoDB connection
├── controllers/
│   ├── analysisController.js # Code analysis CRUD
│   ├── authController.js     # Register, login, profile
│   └── conversationController.js # Conversation CRUD
├── middleware/
│   └── auth.js               # JWT protection & token generation
├── models/
│   ├── Analysis.js           # Analysis schema
│   ├── Conversation.js       # Conversation schema
│   └── User.js               # User schema
├── routes/
│   ├── analyses.js           # /api/analyses
│   ├── auth.js               # /api/auth
│   └── conversations.js      # /api/conversations
├── server.js                 # App entry point
├── .env.example              # Environment variables template
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB instance (local or Atlas)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd smart-code-review-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values
```

### Running

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint    | Auth | Description          |
|--------|-------------|------|----------------------|
| POST   | `/register` | No   | Create a new account |
| POST   | `/login`    | No   | Log in               |
| GET    | `/profile`  | Yes  | Get current profile  |
| PUT    | `/profile`  | Yes  | Update profile       |

### Analyses (`/api/analyses`)

| Method | Endpoint | Auth | Description          |
|--------|----------|------|----------------------|
| POST   | `/`      | Yes  | Create an analysis   |
| GET    | `/`      | Yes  | List analyses        |
| DELETE | `/:id`   | Yes  | Delete an analysis   |

### Conversations (`/api/conversations`)

| Method | Endpoint         | Auth | Description            |
|--------|------------------|------|------------------------|
| POST   | `/`              | Yes  | Create a conversation  |
| GET    | `/`              | Yes  | List conversations     |
| GET    | `/:id`           | Yes  | Get a conversation     |
| POST   | `/:id/messages`  | Yes  | Add a message          |
| PUT    | `/:id/rename`    | Yes  | Rename a conversation  |
| PATCH  | `/:id/pin`       | Yes  | Toggle pin status      |
| DELETE | `/:id`           | Yes  | Delete a conversation  |

## Environment Variables

| Variable      | Description               | Default                                  |
|---------------|---------------------------|------------------------------------------|
| `PORT`        | Server port               | `5000`                                   |
| `NODE_ENV`    | Environment               | `development`                            |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/smartcodereview` |
| `JWT_SECRET`  | JWT signing secret        | —                                        |

## License

ISC
