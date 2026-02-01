# G-Note AI - Modern Note-Taking App with Google Drive Sync

[![Version](https://img.shields.io/badge/version-1.1.7-blue.svg)](https://github.com/alvesoscar517-cloud/G-Note AI-Main)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178c6.svg)](https://www.typescriptlang.org/)

> A free, modern, offline-first note-taking application with Google Drive synchronization, real-time collaboration, and AI-powered features. Available as both a Progressive Web App (PWA) and Chrome Extension.

**Live Demo**: [https://gnoteai.com](https://gnoteai.com)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Technical Highlights](#-technical-highlights)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

G-Note AI is a comprehensive note-taking solution designed to work seamlessly across platforms with a focus on privacy, offline capability, and modern user experience. The project demonstrates advanced full-stack development skills including:

- **Offline-First Architecture**: Full functionality without internet connection
- **Real-Time Collaboration**: WebRTC-based peer-to-peer editing using CRDT
- **AI Integration**: Gemini 2.5 Flash Lite for content assistance
- **Cross-Platform**: Web app (PWA) + Chrome Extension with shared codebase
- **Cloud Sync**: Google Drive integration for data synchronization
- **Internationalization**: Support for 19 languages

### Problem Statement

Users need a reliable, free note-taking app that:
- Works offline without limitations
- Syncs securely without storing data on third-party servers
- Supports real-time collaboration
- Provides AI assistance for content creation
- Respects user privacy (data stored in user's own Google Drive)

### Target Audience

- Students and professionals needing quick note-taking
- Teams requiring real-time collaboration
- Privacy-conscious users wanting data ownership
- Users needing offline-first functionality

---

## ✨ Key Features

### 📝 Rich Text Editor
- **TipTap-based editor** with ProseMirror foundation
- Full formatting support: Bold, Italic, Underline, Strikethrough
- Headings (H1-H3), Lists (Bullet, Numbered, Task lists)
- Code blocks with syntax highlighting (50+ languages via Lowlight)
- Resizable images with drag & drop
- Hyperlinks, Text alignment, Highlight
- Subscript/Superscript support
- Drawing/Handwriting capability
- Markdown import/export

### ☁️ Google Drive Sync
- **Offline-first architecture** with automatic sync
- Conflict resolution using version comparison
- Tombstone-based deletion tracking
- Stale device handling (>30 days offline)
- Batch upload/download with concurrency control
- File ID caching for performance optimization
- Data stored in user's Google Drive (appDataFolder)

### 🤝 Real-Time Collaboration
- **WebRTC P2P connection** for direct peer communication
- **Yjs CRDT** for conflict-free collaborative editing
- 6-digit room codes for easy sharing
- Custom signaling server for peer discovery
- TURN/STUN servers for NAT traversal (Metered.ca)
- Cross-network support (WiFi ↔ 4G)

### 🤖 AI Features (Powered by Gemini 2.5 Flash Lite)
- **Summarize**: Generate concise summaries
- **Continue Writing**: AI-powered content continuation
- **Improve**: Fix grammar, spelling, and clarity
- **Translate**: Support for 30+ languages
- **Extract Tasks**: Auto-generate task lists from content
- **Ask AI**: Question answering about note content
- **Credit System**: Pay-per-use model via Lemon Squeezy
  - Starter: $2.99 → 500 credits (~100 requests)
  - Popular: $7.99 → 1500 credits (~300 requests)
  - Pro: $14.99 → 3500 credits (~700 requests)

### 📁 Organization & Search
- **Collections**: Organize notes with 8 color options
- **Drag & Drop**: Reorder notes and collections
- **Pin Notes**: Keep important notes at the top
- **Fuzzy Search**: Fast search using Fuse.js
- **Global Search**: Search across all notes
- **Drive Search**: Search notes in Google Drive

### 🌐 Offline Support
- **PWA with Service Worker** (Workbox)
- **IndexedDB storage** (Dexie.js)
- Sync queue for offline operations
- Automatic sync when back online
- Cache strategies for optimal performance

### 🌍 Internationalization (i18n)
**19 Languages Supported**:
- English, Tiếng Việt, 中文 (简体/繁體), 日本語, 한국어
- Français, Deutsch, Español, Português, Italiano
- Nederlands, Polski, Türkçe, العربية, हिन्दी
- ไทย, Bahasa Indonesia

### 🔌 Chrome Extension Features
- Side Panel mode or Fullscreen tab
- Context menu "Add to G-Note AI"
- Capture selected text with HTML formatting
- Chrome Identity API authentication
- Background service worker

---

## 🛠 Tech Stack

### Frontend (Web App & Chrome Extension)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI framework with concurrent features |
| **TypeScript** | 5.9.3 | Type safety and developer experience |
| **Vite** | 7.2.4 | Build tool with HMR and optimized builds |
| **Tailwind CSS** | 4.1.18 | Utility-first CSS framework |
| **Zustand** | 5.0.9 | Lightweight state management |
| **TipTap** | 3.14.0 | Extensible rich text editor |
| **Framer Motion** | 12.23.26 | Animation library |
| **Yjs** | 13.6.28 | CRDT for real-time collaboration |
| **y-webrtc** | 10.3.0 | WebRTC provider for Yjs |
| **Dexie** | 4.2.1 | IndexedDB wrapper |
| **i18next** | 25.7.3 | Internationalization framework |
| **Fuse.js** | 7.1.0 | Fuzzy search library |
| **Radix UI** | Latest | Accessible UI primitives |
| **Lucide React** | 0.562.0 | Icon library |
| **@dnd-kit** | 6.3.1 | Drag and drop functionality |
| **@tanstack/react-virtual** | 3.13.14 | Virtualized list rendering |
| **perfect-freehand** | 1.2.2 | Drawing/handwriting support |
| **Vanta.js** | 0.5.24 | 3D animated backgrounds |

### Backend (Node.js)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ≥20 | Runtime environment |
| **Express** | 4.21.2 | Web framework for REST API |
| **Google Cloud Firestore** | 7.11.0 | NoSQL database for user data |
| **Google Vertex AI** | 1.10.0 | Gemini 2.5 Flash Lite integration |
| **google-auth-library** | 9.15.1 | OAuth token management |
| **ws** | 8.18.3 | WebSocket for signaling server |
| **cors** | 2.8.5 | CORS middleware |
| **nodemailer** | 6.9.0 | Email notifications |

### Infrastructure & DevOps

| Technology | Purpose |
|------------|---------|
| **Firebase Hosting** | Static hosting for web app |
| **Google Cloud Run** | Serverless backend deployment |
| **Docker** | Container for backend |
| **Lemon Squeezy** | Payment processing for AI credits |
| **Metered.ca** | TURN servers for WebRTC |

---

## 🏗 Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────┐         ┌──────────────────────┐      │
│  │   Web App (PWA)      │         │  Chrome Extension    │      │
│  │   - React 19         │         │  - Manifest V3       │      │
│  │   - Service Worker   │         │  - Chrome APIs       │      │
│  │   - IndexedDB        │         │  - Side Panel        │      │
│  └──────────┬───────────┘         └──────────┬───────────┘      │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Google Drive │  │   Backend    │  │   WebRTC     │          │
│  │   API        │  │   API        │  │  Signaling   │          │
│  │ (User Data)  │  │ (Cloud Run)  │  │   Server     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │             │                              │
│              ┌─────▼─────┐ ┌────▼────┐                         │
│              │ Firestore │ │Vertex AI│                         │
│              │ (Credits) │ │(Gemini) │                         │
│              └───────────┘ └─────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow - Sync Engine

```
┌─────────────────────────────────────────────────────────────┐
│                      SYNC ENGINE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Local Changes                    Remote Changes             │
│       ↓                                ↓                     │
│  IndexedDB ←──────────────────→ Google Drive                │
│       ↓                                ↓                     │
│  Sync Queue                      Index Files                 │
│       ↓                                ↓                     │
│  ┌─────────────────────────────────────────┐                │
│  │         CONFLICT RESOLVER               │                │
│  │  - Version comparison                   │                │
│  │  - Timestamp comparison                 │                │
│  │  - Tombstone handling                   │                │
│  │  - Stale device detection (30 days)     │                │
│  └─────────────────────────────────────────┘                │
│                      ↓                                       │
│              Merged Result                                   │
│                      ↓                                       │
│         Update Local + Remote                                │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

**Web App**:
```
User → Google OAuth (Authorization Code) → Backend validates 
→ Backend stores refresh token (Firestore) → Returns access token 
→ Frontend stores in Zustand + localStorage
```

**Chrome Extension**:
```
User → chrome.identity.getAuthToken() → Validate Drive scope 
→ Fetch user info → Return to extension → Store in chrome.storage
```

---

## 📂 Project Structure

```
g-note/
├── src/                          # Web App source
│   ├── components/               # React components
│   │   ├── auth/                 # Login, Permission dialogs
│   │   ├── layout/               # Header, InstallPrompt
│   │   ├── notes/                # NoteCard, NoteEditor, NoteModal
│   │   ├── search/               # GlobalSearch, DriveSearch
│   │   ├── settings/             # Settings components
│   │   └── ui/                   # Reusable UI components
│   ├── hooks/                    # Custom React hooks (10+)
│   ├── lib/                      # Core libraries
│   │   ├── db/                   # IndexedDB repositories
│   │   ├── drive/                # Google Drive API integration
│   │   ├── sync/                 # Sync engine & conflict resolution
│   │   ├── ai.ts                 # AI service client
│   │   ├── collaboration.ts      # WebRTC collaboration
│   │   └── utils.ts              # Utility functions
│   ├── locales/                  # i18n translations (19 languages)
│   ├── stores/                   # Zustand stores (6 stores)
│   │   ├── authStore.ts          # Authentication state
│   │   ├── notesStore.ts         # Notes & collections state
│   │   ├── creditsStore.ts       # AI credits state
│   │   ├── themeStore.ts         # Theme preferences
│   │   ├── uiStore.ts            # UI state
│   │   └── networkStore.ts       # Network status
│   └── types/                    # TypeScript type definitions
│
├── notes-app-chrome-extension/   # Chrome Extension
│   ├── src/                      # Shared components (modified)
│   ├── background.js             # Service worker
│   ├── manifest.json             # Extension manifest v3
│   └── icons/                    # Extension icons
│
├── backend/                      # Node.js Backend
│   ├── src/
│   │   ├── config/               # Firebase, Google OAuth config
│   │   ├── routes/               # API routes
│   │   │   ├── ai.js             # AI endpoints
│   │   │   ├── auth.js           # OAuth endpoints
│   │   │   ├── users.js          # User management
│   │   │   ├── webhooks.js       # Payment webhooks
│   │   │   └── share.js          # Note sharing
│   │   ├── services/             # Business logic
│   │   │   └── credits.js        # Credit management
│   │   ├── index.js              # Express server
│   │   └── signaling.js          # WebRTC signaling
│   └── Dockerfile                # Container configuration
│
├── public/                       # Static assets
├── scripts/                      # Build scripts
├── firebase.json                 # Firebase hosting config
├── vite.config.ts                # Vite configuration
└── package.json                  # Dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥20
- npm or yarn
- Google Cloud Project with:
  - Google Drive API enabled
  - OAuth 2.0 credentials configured
  - Vertex AI API enabled (for AI features)
  - Firestore database created

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/alvesoscar517-cloud/G-Note AI-Main.git
cd G-Note AI-Main
```

#### 2. Install dependencies

**Web App**:
```bash
npm install
```

**Chrome Extension**:
```bash
cd notes-app-chrome-extension
npm install
```

**Backend**:
```bash
cd backend
npm install
```

#### 3. Configure environment variables

**Web App** (`.env`):
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_API_URL=http://localhost:8080
VITE_SIGNALING_URL=ws://localhost:8080/signaling
```

**Chrome Extension** (`.env`):
```env
VITE_API_URL=http://localhost:8080
VITE_SIGNALING_URL=ws://localhost:8080/signaling
```

Update `manifest.json` with your OAuth client ID:
```json
{
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
}
```

**Backend** (`.env`):
```env
PORT=8080
GOOGLE_CLOUD_PROJECT=your_project_id
ALLOWED_ORIGINS=http://localhost:5173,chrome-extension://*
LEMONSQUEEZY_STORE=your_store_id
LEMONSQUEEZY_VARIANT_STARTER=variant_id
LEMONSQUEEZY_VARIANT_POPULAR=variant_id
LEMONSQUEEZY_VARIANT_PRO=variant_id
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret
```

#### 4. Run development servers

**Web App**:
```bash
npm run dev
# Opens at http://localhost:5173
```

**Chrome Extension**:
```bash
cd notes-app-chrome-extension
npm run dev
# Load unpacked extension from dist/ folder
```

**Backend**:
```bash
cd backend
npm run dev
# Runs at http://localhost:8080
```

---

## 🚢 Deployment

### Web App (Firebase Hosting)

```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### Backend (Google Cloud Run)

```bash
cd backend

# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/notes-backend .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/notes-backend

# Deploy to Cloud Run
gcloud run deploy notes-backend \
  --image gcr.io/YOUR_PROJECT_ID/notes-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Chrome Extension (Chrome Web Store)

```bash
cd notes-app-chrome-extension

# Build
npm run build

# Create zip
cd dist
zip -r ../extension.zip *

# Upload to Chrome Web Store Developer Dashboard
```

---

## 💡 Technical Highlights

### 1. Offline-First Sync Engine

The sync engine implements a sophisticated conflict resolution strategy:

- **Version-based conflict resolution**: Each entity has a version number
- **Tombstone pattern**: Tracks deletions across devices
- **Stale device detection**: Handles devices offline >30 days
- **Batch operations**: Parallel uploads/downloads with concurrency limits
- **File ID caching**: Reduces API calls by caching Drive file IDs

```typescript
// Example: Conflict resolution
function resolveNoteConflict(local: Note, remote: Note) {
  // Compare versions first
  if (local.version > remote.version) return local
  if (remote.version > local.version) return remote
  
  // Same version, compare timestamps
  return local.updatedAt > remote.updatedAt ? local : remote
}
```

### 2. Real-Time Collaboration with CRDT

Uses Yjs (CRDT) for conflict-free collaborative editing:

- **Automatic conflict resolution**: No manual merge required
- **P2P connection**: Direct WebRTC connection between peers
- **Custom signaling server**: WebSocket-based peer discovery
- **Room-based collaboration**: 6-digit codes for easy sharing

```typescript
// Yjs integration with TipTap
const ydoc = new Y.Doc()
const provider = new WebrtcProvider(roomId, ydoc, {
  signaling: [SIGNALING_URL]
})

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({ document: ydoc })
  ]
})
```

### 3. Performance Optimizations

- **Virtualized lists**: Only render visible notes (@tanstack/react-virtual)
- **Debounced updates**: 300ms debounce for editor, 500ms for sync
- **Memoization**: Expensive computations cached with useMemo
- **Code splitting**: Automatic chunking by Vite
- **Image compression**: Client-side compression before upload
- **PWA caching**: Strategic caching with Workbox

### 4. Design Patterns

- **Repository Pattern**: Separates data access from business logic
- **Store Pattern**: Zustand with persist middleware
- **Debounce Pattern**: Prevents excessive updates
- **Queue Pattern**: Offline operation queue
- **Tombstone Pattern**: Soft delete tracking

### 5. Security

- **OAuth 2.0**: Secure authentication flow
- **Token refresh**: Automatic silent refresh
- **Data privacy**: Notes stored in user's own Google Drive
- **CORS**: Configured for specific origins
- **CSP**: Content Security Policy in Chrome Extension

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~25,000+ |
| **TypeScript Files** | ~100+ |
| **React Components** | ~50+ |
| **Custom Hooks** | 10 |
| **Zustand Stores** | 6 |
| **API Endpoints** | 15+ |
| **Supported Languages** | 19 |
| **TipTap Extensions** | 15+ |
| **Frontend Dependencies** | 55+ |
| **Backend Dependencies** | 7 |

---

## 📸 Screenshots

*(Add screenshots here)*

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Oscar Alves**

- GitHub: [@alvesoscar517-cloud](https://github.com/alvesoscar517-cloud)
- Project Link: [https://github.com/alvesoscar517-cloud/G-Note AI-Main](https://github.com/alvesoscar517-cloud/G-Note AI-Main)
- Live Demo: [https://gnoteai.com](https://gnoteai.com)

---

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI framework
- [TipTap](https://tiptap.dev/) - Rich text editor
- [Yjs](https://yjs.dev/) - CRDT for collaboration
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Radix UI](https://www.radix-ui.com/) - UI primitives
- [Google Cloud](https://cloud.google.com/) - Infrastructure
- [Lemon Squeezy](https://www.lemonsqueezy.com/) - Payment processing

---

**Built with ❤️ using React, TypeScript, and modern web technologies**
