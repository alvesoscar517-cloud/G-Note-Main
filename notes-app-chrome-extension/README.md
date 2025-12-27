# G-Note Chrome Extension

Chrome Extension version của G-Note - Ứng dụng ghi chú đơn giản và hiện đại với đồng bộ Google Drive.

## Tính năng

- ✅ Tất cả tính năng của web app
- ✅ Đăng nhập Google qua Chrome Identity API
- ✅ Đồng bộ với Google Drive
- ✅ Hoạt động offline với IndexedDB
- ✅ Rich text editor với TipTap
- ✅ Hỗ trợ dark mode
- ✅ Đa ngôn ngữ (19 ngôn ngữ)
- ✅ AI Chat integration
- ✅ Collaboration features
- ✅ Version history
- ✅ Collections & organization

## Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình Google OAuth

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Bật Google Drive API và Google+ API
4. Tạo OAuth 2.0 credentials:
   - Application type: Chrome Extension
   - Authorized JavaScript origins: `chrome-extension://[YOUR_EXTENSION_ID]`
5. Copy Client ID và cập nhật trong `manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.appdata",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  }
}
```

### 3. Build extension

```bash
npm run build
```

### 4. Load extension vào Chrome

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật "Developer mode" ở góc trên bên phải
3. Click "Load unpacked"
4. Chọn thư mục `dist` trong project
5. Extension sẽ được cài đặt và sẵn sàng sử dụng

## Development

### Chạy development mode

```bash
npm run dev
```

Extension sẽ tự động rebuild khi có thay đổi code.

## Cấu trúc thư mục

```
notes-app-chrome-extension/
├── public/              # Static assets (icons, images)
├── src/                 # Source code (GIỐNG web app)
│   ├── components/      # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries
│   │   ├── chromeAuth.ts    # Chrome Identity API wrapper (KHÁC web app)
│   │   ├── driveSync.ts     # Google Drive sync (GIỐNG)
│   │   ├── offlineDb.ts     # IndexedDB operations (GIỐNG)
│   │   ├── ai.ts           # AI features (GIỐNG, cần backend)
│   │   └── ...
│   ├── locales/        # i18n translations (GIỐNG)
│   ├── stores/         # Zustand state management (GIỐNG)
│   ├── types/          # TypeScript types (GIỐNG)
│   ├── App.tsx         # Main app component (KHÁC một chút)
│   └── main.tsx        # Entry point (GIỐNG)
├── icons/              # Extension icons
├── background.js       # Service worker (KHÁC web app)
├── manifest.json       # Extension manifest (KHÁC web app)
├── index.html          # Popup HTML (KHÁC web app)
└── vite.config.ts      # Vite configuration (KHÁC web app)

Backend (DÙNG CHUNG):
../notes-app/backend/   # Backend API (AI, auth, credits)
```

## Khác biệt với Web App

### 1. Authentication
- **Web App**: Sử dụng `@react-oauth/google` với implicit flow hoặc authorization code flow
- **Chrome Extension**: Sử dụng Chrome Identity API (`chrome.identity.getAuthToken`)

### 2. Build Configuration
- **Web App**: Vite với PWA plugin
- **Chrome Extension**: Vite với `@crxjs/vite-plugin`

### 3. Manifest
- **Web App**: `manifest.json` cho PWA
- **Chrome Extension**: `manifest.json` v3 với permissions và oauth2 config

### 4. Background Process
- **Web App**: Service Worker cho PWA
- **Chrome Extension**: Background Service Worker với message passing

### 5. OAuth Scopes
- **Cả 2 đều dùng 3 scopes**:
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/drive.file`

### 6. Backend
- **Cả 2 dùng CHUNG backend**: `notes-app/backend/`
- Backend cung cấp AI features, token refresh, credits management

## API Backend (Dùng chung với Web App)

Extension sử dụng **CHUNG backend** với web app. Backend nằm trong thư mục `../notes-app/backend`.

### Nếu web app đã có backend:

Chỉ cần cập nhật `VITE_API_URL` trong `.env`:

```env
VITE_API_URL=https://your-backend-url.com
```

### Nếu chưa có backend:

Xem hướng dẫn deploy backend trong `../notes-app/backend/README.md`

Backend cung cấp:
- AI features (summarize, continue, improve, translate, extract tasks, ask AI)
- Token refresh (OAuth)
- Credit management
- Webhook handling (Lemon Squeezy payments)

## Troubleshooting

### Extension không load được

1. Kiểm tra console trong `chrome://extensions/` để xem lỗi
2. Đảm bảo đã build extension: `npm run build`
3. Reload extension sau khi thay đổi code

### Không đăng nhập được

1. Kiểm tra Client ID trong `manifest.json`
2. Đảm bảo đã thêm extension ID vào Google Cloud Console
3. Kiểm tra permissions trong manifest

### Không đồng bộ được với Drive

1. Kiểm tra scopes trong manifest
2. Đảm bảo đã bật Google Drive API trong Google Cloud Console
3. Kiểm tra network tab để xem API calls

## License

MIT License - Xem file LICENSE để biết thêm chi tiết

## Credits

- Built with React, TypeScript, Vite
- UI: Tailwind CSS, Radix UI
- Editor: TipTap
- State: Zustand
- Storage: IndexedDB (idb)
- i18n: i18next
