# Notes App Backend

Node.js backend cho Notes App, deploy trên Google Cloud Run với Firestore.

## Cấu trúc

```
backend/
├── src/
│   ├── index.js          # Entry point
│   ├── config/
│   │   ├── firebase.js   # Firestore config
│   │   └── google.js     # OAuth config
│   └── routes/
│       ├── auth.js       # Authentication endpoints
│       ├── users.js      # User management
│       └── ai.js         # AI features (placeholder)
├── Dockerfile
└── package.json
```

## API Endpoints

### Auth
- `POST /auth/google` - Exchange auth code for tokens
- `POST /auth/refresh` - Silent token refresh
- `POST /auth/logout` - Remove refresh token

### Users
- `GET /users/:id` - Get user profile
- `PATCH /users/:id` - Update user profile

### AI (Coming soon)
- `POST /ai/summarize` - Summarize note
- `POST /ai/suggest` - Suggest improvements
- `POST /ai/generate` - Generate content

## Local Development

```bash
cd backend
npm install

# Create .env from .env.example
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

npm run dev
```

## Deploy to Cloud Run

### 1. Setup Google Cloud

```bash
# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
```

### 2. Create Firestore Database

```bash
gcloud firestore databases create --location=asia-southeast1
```

### 3. Deploy

```bash
cd backend

# Build and deploy
gcloud run deploy notes-app-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLIENT_ID=xxx,GOOGLE_CLIENT_SECRET=xxx,ALLOWED_ORIGIN=https://your-app.com"
```

### 4. Update Frontend

Thêm vào `.env` của frontend:
```
VITE_API_URL=https://notes-app-backend-xxx.run.app
```

## Firestore Collections

### users
```json
{
  "id": "google_user_id",
  "email": "user@gmail.com",
  "name": "User Name",
  "avatar": "https://...",
  "lastLogin": 1703577600000
}
```

### refreshTokens
```json
{
  "refreshToken": "encrypted_token",
  "updatedAt": 1703577600000
}
```
