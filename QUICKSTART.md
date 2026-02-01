# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication** → **Email/Password**
4. Create a **Firestore Database** (start in test mode for development)
5. Copy your Firebase config from Project Settings → General → Your apps

## 3. Configure Firebase

Edit `src/firebase/config.js` and replace the placeholder values with your Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",           // Your actual API key
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

## 4. Set Firestore Security Rules

In Firebase Console → Firestore Database → Rules, use:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated admins to read/write all data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow public read access to classes (for lesson submission)
    match /classes/{classId} {
      allow read: if true;
    }
    
    // Allow public write access to lessons (for teachers)
    match /lessons/{lessonId} {
      allow create: if true;
      allow read: if request.auth != null;
    }
    
    // Allow public read access to enrollments and students (for lesson submission)
    match /enrollments/{enrollmentId} {
      allow read: if true;
    }
    
    match /students/{studentId} {
      allow read: if true;
    }
  }
}
```

## 5. Create Admin User

1. Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Save these credentials for login

## 6. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your admin credentials.

## 7. Initial Setup Steps

1. **Create Classes**: Go to Classes page → Create New Class
   - Add subject, level, schedule, teacher name, and monthly fee

2. **Add Students**: Go to Students & Fees page → Add New Student
   - Enter student and parent information

3. **Enroll Students**: 
   - Click "View Details" on a student
   - Select a class and click "Enroll"

4. **Share Lesson Submission Links**:
   - Go to a Class page
   - Copy the "Lesson Submission Link"
   - Share with teachers (no login required)

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.
