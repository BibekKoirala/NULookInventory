# Nulook Inventory Manager

A Firebase-ready inventory dashboard for a women’s fashion store. It supports:

- Google sign-in for warehouse associates
- Product records with mandatory item numbers
- Multiple colors and sizes per item
- New location creation and assignment to items
- Item and location deletion
- Interactive item lookup and selection

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Open http://localhost:3000 to view it.

## Firebase setup

To connect the app to your Firebase project, add the following environment variables in a `.env.local` file:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Then enable:

- Authentication → Google sign-in
- Firestore Database

## Build verification

The app was verified with:

```bash
npm run build
```
