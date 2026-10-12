// Paste your Firebase web-app config here to enable online play.
// You can reuse the same Firebase project as your Istanbul game — this game stores
// everything under /vectoraces/ so they won't collide.
//
// Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration" (Config).
// Realtime Database rules for casual play (anyone with a game code can join):
//   { "rules": { "vectoraces": { ".read": true, ".write": true } } }

export const FIREBASE_CONFIG = null;
/* example:
export const FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: 'your-project.firebaseapp.com',
  databaseURL: 'https://your-project-default-rtdb.firebaseio.com',
  projectId: 'your-project',
  appId: '...',
};
*/
