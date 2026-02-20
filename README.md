# Travel Window Backend API

Backend API for Travel Window application, deployed on Vercel as serverless functions.

## 🚀 Deployment

### Vercel Setup

1. Connect GitHub repo: `travel-window-backend`
2. Root Directory: (empty - root)
3. Framework Preset: Other
4. Build Command: (empty)
5. Output Directory: (empty)

### Environment Variables

Set in Vercel Dashboard:

```
MONGODB_URI = mongodb+srv://...
JWT_SECRET = your-secret-key
SEED_SECRET = your-seed-secret
```

### API Endpoints

- Base URL: `https://travel-window-backend.vercel.app/api`
- Health: `/api/health`
- Test: `/api/test`
- Auth: `/api/auth/login`
- Seed: `/api/seed?secret=YOUR_SEED_SECRET`

## 📁 Structure

```
backend/
├── api/
│   └── index.js          # Serverless function entry
├── routes/               # Express routes
├── models/               # MongoDB models
├── middleware/           # Auth middleware
├── scripts/              # Seed scripts
├── package.json
└── vercel.json
```

## 🔧 Local Development

```bash
npm install
npm run dev
```

## 📝 Notes

- Uses `serverless-http` for Vercel compatibility
- MongoDB connection optimized for serverless (3s timeout)
- CORS configured for frontend domain
