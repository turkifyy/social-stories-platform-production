import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';

let firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let database: Database | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let firebaseWarningShown = false;
let initializationAttempted = false;

function isFirebaseConfigValid(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

async function fetchFirebaseConfigFromServer() {
  try {
    const response = await fetch('/api/firebase-config');
    if (response.ok) {
      const serverConfig = await response.json();
      firebaseConfig = {
        apiKey: serverConfig.apiKey || '',
        authDomain: serverConfig.authDomain || '',
        projectId: serverConfig.projectId || '',
        storageBucket: serverConfig.storageBucket || '',
        messagingSenderId: serverConfig.messagingSenderId || '',
        appId: serverConfig.appId || ''
      };
      return true;
    }
  } catch (error) {
    console.warn('Could not fetch Firebase config from server:', error);
  }
  return false;
}

export async function initializeFirebase() {
  if (initializationAttempted) return;
  initializationAttempted = true;

  try {
    // Fetch from server endpoint
    const success = await fetchFirebaseConfigFromServer();
    
    if (isFirebaseConfigValid()) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      firestore = getFirestore(app);
      database = getDatabase(app);
      googleProvider = new GoogleAuthProvider();
    } else if (!firebaseWarningShown) {
      firebaseWarningShown = true;
      console.warn('Firebase not configured. Check /api/firebase-config endpoint');
    }
  } catch (error) {
    if (!firebaseWarningShown) {
      firebaseWarningShown = true;
      console.error('Firebase initialization failed:', error);
    }
  }
}

// Lazy initialization - will be called by useAuth
let initPromise: Promise<void> | null = null;
function ensureFirebaseInitialized() {
  if (!initPromise) {
    initPromise = initializeFirebase();
  }
  return initPromise;
}

export { app, auth, firestore, database, googleProvider, ensureFirebaseInitialized };
