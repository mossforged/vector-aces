# Online play setup (≈10 minutes, free)

Same-screen play works with no setup. Online play needs two things: the game hosted at a URL
(GitHub Pages) and a small realtime database (Firebase) that relays moves.

## 1. Firebase (you can reuse your Istanbul project)
1. https://console.firebase.google.com → your project (or *Add project*).
2. **Build → Realtime Database → Create database** (any region, start in *locked mode*).
3. **Rules** tab → paste and publish:
   ```json
   { "rules": { "vectoraces": { ".read": true, ".write": true } } }
   ```
   (If the project already has rules for Istanbul, add the `"vectoraces"` key alongside them.)
4. **Project settings → General → Your apps → Web app** (create one if needed) → copy the config
   object into `src/net/firebaseConfig.js` as `FIREBASE_CONFIG`. Make sure it includes `databaseURL`.

## 2. GitHub Pages
1. Push this folder to a repo (e.g. `johniadarola/vector-aces`).
2. Repo **Settings → Pages → Deploy from branch → main / root**.
3. Open `https://johniadarola.github.io/vector-aces/`.

## 3. Play
Host: *Host online game* → pick faction + squad → *Create game* → copy the invite link.
Friend: opens the link, picks any faction (even the same one) and a squad, *Join battle*. No accounts needed.
Either player can refresh or reopen the link later — the game is rebuilt from the move log.
A third person opening a full game can watch as a spectator.

Data lives at `/vectoraces/games/<CODE>/log`. Old games can be deleted from the Firebase console.
