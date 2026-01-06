import admin from 'firebase-admin';
import { firestoreRest } from './firebase-rest-client';

let firestoreInstance: FirebaseFirestore.Firestore | null = null;
let authInstance: admin.auth.Auth | null = null;
let initialized = false;
let initializationAttempted = false;
let usingRestApi = false;

function initializeApp() {
  if (initializationAttempted) return;
  initializationAttempted = true;
  
  try {
    if (!admin.apps || admin.apps.length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
      
      console.log('🔍 Checking Firebase credentials...');
      console.log('   - FIREBASE_SERVICE_ACCOUNT length:', serviceAccount?.length || 0);
      console.log('   - Project ID:', projectId || 'not set');
      
      if (serviceAccount && serviceAccount.length > 100) {
        try {
          const cleanedServiceAccount = serviceAccount.trim();
          const serviceAccountJson = JSON.parse(cleanedServiceAccount);
          
          console.log('📋 Service account parsed successfully');
          console.log('   - Type:', serviceAccountJson.type);
          console.log('   - Project ID:', serviceAccountJson.project_id);
          console.log('   - Client Email:', serviceAccountJson.client_email);
          
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccountJson),
            projectId: serviceAccountJson.project_id,
          });
          console.log('✅ Firebase Admin initialized with service account');
          
          firestoreInstance = admin.firestore();
          authInstance = admin.auth();
          initialized = true;
          usingRestApi = false;
          console.log('✅ Firestore and Auth initialized successfully (using Admin SDK)');
          return;
        } catch (parseError: any) {
          console.error('❌ Failed to parse Firebase service account JSON:', parseError.message);
          console.error('   First 200 chars of service account:', serviceAccount?.substring(0, 200));
        }
      }
      
      if (projectId && process.env.VITE_FIREBASE_API_KEY) {
        console.log('ℹ️  Using Firebase REST API for Firestore operations');
        usingRestApi = true;
        initialized = true;
        return;
      }
      
      console.error('❌ No Firebase credentials found. Please set FIREBASE_SERVICE_ACCOUNT or ensure VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_API_KEY are set.');
    }
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error.message);
  }
}

class FirestoreRestWrapper {
  collection(name: string) {
    return {
      doc: (id: string) => ({
        get: async () => {
          const data = await firestoreRest.getDocument(name, id);
          return {
            exists: data !== null,
            data: () => data,
            id,
          };
        },
        set: async (data: any, options?: { merge?: boolean }) => {
          await firestoreRest.setDocument(name, id, data, options?.merge);
        },
        update: async (data: any) => {
          await firestoreRest.setDocument(name, id, data, true);
        },
        delete: async () => {
          await firestoreRest.deleteDocument(name, id);
        },
      }),
      add: async (data: any) => {
        const id = await firestoreRest.addDocument(name, data);
        return { id };
      },
      get: async () => {
        const docs = await firestoreRest.getCollection(name);
        return {
          empty: docs.length === 0,
          docs: docs.map(doc => ({
            id: doc.id,
            exists: true,
            data: () => doc,
          })),
        };
      },
      where: (field: string, op: string, value: any) => {
        const filters = [{ field, op: convertOperator(op), value }];
        return createQueryBuilder(name, filters);
      },
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => {
        return createQueryBuilder(name, [], { field, direction: direction === 'asc' ? 'ASCENDING' : 'DESCENDING' });
      },
      limit: (count: number) => {
        return createQueryBuilder(name, [], undefined, count);
      },
    };
  }

  batch() {
    const operations: Array<() => Promise<void>> = [];
    return {
      set: (docRef: any, data: any, options?: { merge?: boolean }) => {
        operations.push(async () => {
          await docRef.set(data, options);
        });
      },
      update: (docRef: any, data: any) => {
        operations.push(async () => {
          await docRef.update(data);
        });
      },
      delete: (docRef: any) => {
        operations.push(async () => {
          await docRef.delete();
        });
      },
      commit: async () => {
        for (const op of operations) {
          await op();
        }
      },
    };
  }
}

function convertOperator(op: string): string {
  const opMap: Record<string, string> = {
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'array-contains': 'ARRAY_CONTAINS',
    'in': 'IN',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
    'not-in': 'NOT_IN',
  };
  return opMap[op] || 'EQUAL';
}

function createQueryBuilder(
  collection: string,
  filters: Array<{ field: string; op: string; value: any }> = [],
  orderBy?: { field: string; direction: 'ASCENDING' | 'DESCENDING' },
  limitCount?: number
) {
  return {
    where: (field: string, op: string, value: any) => {
      return createQueryBuilder(
        collection,
        [...filters, { field, op: convertOperator(op), value }],
        orderBy,
        limitCount
      );
    },
    orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => {
      return createQueryBuilder(
        collection,
        filters,
        { field, direction: direction === 'asc' ? 'ASCENDING' : 'DESCENDING' },
        limitCount
      );
    },
    limit: (count: number) => {
      return createQueryBuilder(collection, filters, orderBy, count);
    },
    get: async () => {
      const docs = await firestoreRest.queryCollection(collection, filters, orderBy, limitCount);
      return {
        empty: docs.length === 0,
        docs: docs.map(doc => ({
          id: doc.id,
          exists: true,
          data: () => doc,
        })),
      };
    },
  };
}

const restWrapper = new FirestoreRestWrapper();

export function getFirestore(): any {
  if (!initialized) {
    initializeApp();
  }
  
  if (usingRestApi) {
    return restWrapper;
  }
  
  if (!firestoreInstance) {
    if (process.env.VITE_FIREBASE_PROJECT_ID && process.env.VITE_FIREBASE_API_KEY) {
      usingRestApi = true;
      return restWrapper;
    }
    throw new Error('Firestore not initialized. Please check Firebase configuration.');
  }
  
  return firestoreInstance;
}

export function getAuth(): admin.auth.Auth | null {
  if (!initialized) {
    initializeApp();
  }
  return authInstance;
}

export function isUsingRestApi(): boolean {
  return usingRestApi;
}

export async function verifyTokenWithFirebaseAPI(token: string): Promise<any> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Firebase API key not configured');
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Token verification response:', { status: response.status, errorData });
      throw new Error(errorData.error?.message || `Token verification failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      return {
        uid: user.localId,
        email: user.email,
        name: user.displayName || '',
        email_verified: user.emailVerified || false,
      };
    }
    throw new Error('No user found in response');
  } catch (error: any) {
    console.error('Firebase token verification error:', error.message);
    throw error;
  }
}

export { getFirestore as firestore, getAuth as auth };
