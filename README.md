# 💰 Monthly Expenses Tracker

A beautiful, cloud-synced expense tracker that works across all your devices!

## ✨ Features

- 📊 Real-time sync across devices
- 💰 Track income & expenses
- 📅 Monthly filtering
- 🔍 Search transactions
- 📥 Export to CSV
- 🎨 Beautiful modern UI
- 📱 Mobile responsive

## 🚀 Setup Instructions

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"**
3. Name it: `expense-tracker`
4. Disable Google Analytics (optional)
5. Click **Create**

### Step 2: Enable Firestore Database

1. In Firebase Console, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"**
4. Select location (any)
5. Click **Enable**

### Step 3: Get Firebase Config

1. Go to **Project Settings** ⚙️
2. Scroll to **"Your apps"**
3. Click **Web** icon (</>)
4. Register app name: `Expense Tracker`
5. Copy the `firebaseConfig` object

### Step 4: Update firebase-config.js

Open `firebase-config.js` and replace:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};