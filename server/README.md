# Auth Server

Node.js + Express + MongoDB authentication backend for user login/signup.

## Features

- User registration with immediate sign-in
- Login with JWT access token
- Forgot/reset password flow
- Role-based authorization (`user`, `admin`)
- Input validation with Zod
- Rate limiting and secure headers

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Run a local MongoDB instance and set `MONGODB_URI` in `.env`.

4. Start the server:

```bash
npm run dev
```

Server runs at `http://localhost:5000` by default.

## API Base

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/auth/admin/ping`
- `POST /api/questions/submissions`
- `GET /api/questions/submissions/me`
- `GET /api/admin/moderation/stats`
- `GET /api/admin/moderation/notifications`
- `GET /api/admin/moderation/pending`
- `POST /api/admin/moderation/submissions/:id/approve`
- `POST /api/admin/moderation/submissions/:id/reject`

## Notes

- If SMTP is not configured, password reset links are printed in server logs for local development.
- Admin role is never assigned during signup. Promote a trusted user manually in MongoDB by setting `role` to `admin`.
- AI practice evaluation supports Gemini when configured. Without Gemini key, the server falls back to built-in heuristic scoring.

## Gemini setup for answer evaluation

Set these in `.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
```

Then restart backend server. The endpoint `POST /api/questions/practice` will use Gemini to assess:

- answer relevance to the question (`isMatch`)
- whether answer needs improvement (`shouldImprove`)
- rubric scores, strengths, improvements, and summary feedback

## Which file to run

- Start the backend with `npm run dev` or `npm start` from the `server` folder.
- Entry file is `src/index.js`.
- `src/app.js` only defines the Express app and middleware, and is imported by `src/index.js`.

## Email delivery setup (required for real inbox delivery)

If you see `[DEV EMAIL]` in server logs, SMTP is not configured, so emails are not sent to your mailbox.

Set these in `.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=Resume AI <your-email@gmail.com>
```

For Gmail, you must use an App Password (normal account password will fail):

1. Enable 2-Step Verification on your Google account.
2. Generate an App Password from Google Account Security settings.
3. Put that App Password in `SMTP_PASS`.

After updating `.env`, restart the backend server.