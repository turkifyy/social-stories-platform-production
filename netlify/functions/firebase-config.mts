import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  try {
    const config = {
      apiKey: Netlify.env.get('VITE_FIREBASE_API_KEY') || '',
      authDomain: Netlify.env.get('VITE_FIREBASE_AUTH_DOMAIN') || '',
      projectId: Netlify.env.get('VITE_FIREBASE_PROJECT_ID') || '',
      storageBucket: Netlify.env.get('VITE_FIREBASE_STORAGE_BUCKET') || '',
      messagingSenderId: Netlify.env.get('VITE_FIREBASE_MESSAGING_SENDER_ID') || '',
      appId: Netlify.env.get('VITE_FIREBASE_APP_ID') || ''
    };

    // Verify all required fields are present
    if (config.apiKey && config.authDomain && config.projectId && config.appId) {
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      console.warn('Firebase config incomplete:', {
        apiKey: !!config.apiKey,
        authDomain: !!config.authDomain,
        projectId: !!config.projectId,
        appId: !!config.appId
      });

      return new Response(JSON.stringify({
        error: 'Firebase is not configured',
        message: 'Please add Firebase credentials to Netlify environment variables',
        hint: 'Ensure environment variables contain VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to retrieve Firebase configuration',
      message: String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const config: Config = {
  path: "/api/firebase-config"
};
