# 🧾 App Store Submission Checklist (Capacitor + Vite Social Habit Tracker)

## 🧱 Project Setup
- [x] **Apple Developer Account** — required to sign and distribute your app through the App Store.  
- [x] **App Name, Bundle ID, and SKU** — uniquely identify your app in Apple’s ecosystem and can’t be changed later.  
- [ ] **App Icons (1024×1024)** — mandatory for App Store listing and device home screens.  
- [ ] **Version & Build Numbers set** — Apple requires each uploaded build to have a unique version/build combo.  
- [x] **`capacitor.config.*` cleaned (no `server.url`)** — ensures the app runs offline with bundled assets in production.  
- [ ] **Run `npm run build` → `npx cap sync ios`** — updates iOS project with the latest production web code.  

---

## 🔒 Permissions & Info.plist
- [x] **`NSCameraUsageDescription`** — required by Apple when the app triggers any camera-related permission prompt.  
- [x] **`NSPhotoLibraryUsageDescription`** — allows users to pick photos from their library; needed for image inputs.  
- [x] **`NSPhotoLibraryAddUsageDescription`** *(if saving photos)* — required if your app can write to the user’s library.  
- [ ] **All text strings are human and feature-specific** — vague permission prompts lead to review rejection.  
- [ ] **All network calls use HTTPS (ATS compliant)** — Apple rejects apps that make unsecured HTTP requests.  

---

## 🧾 Privacy & Legal
- [x] **In-app Account Deletion flow** — mandatory for any app that lets users create an account.  
- [ ] **Privacy Policy URL added in App Store Connect** — Apple requires a visible link for all apps with user accounts.  
- [ ] **App Privacy “Nutrition Label” completed** — informs users how their data is collected and used.  
- [ ] **`PrivacyInfo.xcprivacy` Manifest included** — lists API and data usage for your app and SDKs; required since 2024.  

---

## 🔑 Authentication
- [ ] **Social login tested in release build** — ensures OAuth callbacks work in production and avoid runtime failures.  
- [x] **“Sign in with Apple” added** *(if using other 3P logins)* — Apple requires an equivalent privacy-friendly login option.  

---

## 🧪 Testing & Stability
- [ ] **Tested on physical devices (release mode)** — simulators don’t catch camera or login permission flows accurately.  
- [ ] **No console logs or dev warnings** — excessive debug output can flag a build as non-production.  
- [ ] **App works offline or gracefully handles connectivity loss** — stability is a key review criterion.  

---

## 🏁 App Store Connect Submission
- [ ] **App record created (name, bundle ID, category)** — registers your app metadata for upload.  
- [ ] **Description, keywords, screenshots, and age rating completed** — required for product page approval.  
- [ ] **Build uploaded via Xcode (Archive → Distribute → App Store Connect)** — official way to deliver binaries to Apple.  
- [ ] **Wait for build “Processing” to complete** — build must be processed before you can attach it to a version.  
- [ ] **Select build in version page and Submit for Review** — final step; Apple will test and approve the release.


--- 

## App refactorings

- AI notifications
- joint plan working
- [] dark mode + new icon
- proper analytics page (needs design)