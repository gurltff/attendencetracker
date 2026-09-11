# Firebase setup

This app uses Firebase Authentication, Cloud Firestore, and Cloud Storage. Firebase configuration is embedded into the Vite build, so configure it before running `npm run build` or `npm run deploy`.

## 1. Create the Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select **Add project** and create a new project.
3. In **Build > Authentication > Sign-in method**, enable **Email/Password**.
4. In **Build > Firestore Database**, create a database.
5. In **Build > Storage**, create a storage bucket.
6. In **Project settings > Your apps**, add a Web app and copy its configuration values.

## 2. Configure the local app

Create `attendance_tracker_clean/.env` by copying `.env.example`, then fill in every value from the Firebase Web app configuration:

```dotenv
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_ALLOW_LOCATION_UNAVAILABLE=true
```

Do not commit `.env`. Restart Vite after changing it.

## 3. Publish the security rules

In the Firebase Console, open **Firestore Database > Rules** and replace the rules with the contents of `firestore.rules`, then publish them. Do the same in **Storage > Rules** with `storage.rules`.

The app creates a profile document at `users/<Firebase Auth UID>` immediately after registration. If Firestore is not created or the rules are not published, registration cannot finish even though Firebase Auth may already contain the email account.

## 4. Build and deploy

From `attendance_tracker_clean`:

```powershell
npm install
npm run build
npm run deploy
```

For GitHub Pages, add the deployed site URL under **Authentication > Settings > Authorized domains**. The default project domain is already authorized by Firebase.

The app now explicitly uses Firebase browser-local persistence, so a successful login survives refreshes on the same browser and deployed origin. It does not store or expose plaintext passwords.
