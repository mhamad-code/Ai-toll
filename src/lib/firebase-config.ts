git add -A git commit -m "Add Firebase login and signup [skip 
ci]" git push sleep 8 gh workflow run add-firebase.yml --ref 
main sleep 10 gh run watch $(gh run list --workflow 
add-firebase.yml --limit 1 --json databaseId -q 
'.[0].databaseId') sleep 15 gh run watch $(gh run list 
--workflow deploy.yml --limit 1 --json databaseId -q 
'.[0].databaseId')/**
git pull * Paste your Firebase web app config here.
 *
 * Firebase console → Project settings → General → Your apps → Web app →
 * SDK setup and configuration → Config.
 *
 * These values only identify your project, they are not secrets. Who can sign
 * in is decided by the providers you enable and the authorized domains list.
 * Leave `apiKey` empty and the app opens without a login screen.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyABa7Ih5fyUvtzLKhivJvuMguu2WTc8M-M",
  authDomain: "ai-platform-204e3.firebaseapp.com",
  projectId: "ai-platform-204e3",
  storageBucket: "ai-platform-204e3.firebasestorage.app",
  messagingSenderId: "1089351203997",
  appId: "1:1089351203997:web:ba3998419970ae422c2874",
}
