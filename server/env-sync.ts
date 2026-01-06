import { getFirestore } from './firebase-admin-setup';
import type { APIConfig } from '@shared/schema';

const API_CONFIGS_COLLECTION = 'api_configs';

function getFirestoreInstance() {
  try {
    return getFirestore();
  } catch {
    return null;
  }
}

type APIProvider = 'deepseek' | 'cloudflare_r2' | 'youtube' | 'huggingface' | 'gemini' | 'facebook' | 'instagram' | 'tiktok' | 'tmdb';

interface EnvKeyMapping {
  provider: APIProvider;
  envKeys: {
    apiKey?: string;
    appId?: string;
    appSecret?: string;
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
  };
}

const ENV_MAPPINGS: EnvKeyMapping[] = [
  {
    provider: 'deepseek',
    envKeys: {
      apiKey: 'DEEPSEEK_API_KEY',
    },
  },
  {
    provider: 'cloudflare_r2',
    envKeys: {
      accountId: 'R2_ACCOUNT_ID',
      accessKeyId: 'R2_ACCESS_KEY_ID',
      secretAccessKey: 'R2_SECRET_ACCESS_KEY',
      bucketName: 'R2_BUCKET_NAME',
    },
  },
  {
    provider: 'youtube',
    envKeys: {
      apiKey: 'YOUTUBE_API_KEY',
    },
  },
  {
    provider: 'huggingface',
    envKeys: {
      apiKey: 'HUGGINGFACE_API_KEY',
    },
  },
  {
    provider: 'gemini',
    envKeys: {
      apiKey: 'GEMINI_API_KEY',
    },
  },
  {
    provider: 'tmdb',
    envKeys: {
      apiKey: 'TMDB_API_KEY',
    },
  },
];

export async function syncEnvToFirestore(): Promise<void> {
  const firestore = getFirestoreInstance();
  if (!firestore) {
    console.log('⚠️  Firestore not available - skipping environment sync');
    return;
  }

  console.log('🔄 Syncing environment variables to Firestore...');

  for (const mapping of ENV_MAPPINGS) {
    try {
      const updates: Partial<APIConfig> = {
        provider: mapping.provider,
      };
      let hasUpdates = false;
      let allKeysPresent = true;

      if (mapping.envKeys.apiKey && process.env[mapping.envKeys.apiKey]) {
        updates.apiKey = process.env[mapping.envKeys.apiKey];
        hasUpdates = true;
      } else if (mapping.envKeys.apiKey) {
        allKeysPresent = false;
      }

      if (mapping.envKeys.appId && process.env[mapping.envKeys.appId]) {
        updates.appId = process.env[mapping.envKeys.appId];
        hasUpdates = true;
      } else if (mapping.envKeys.appId) {
        allKeysPresent = false;
      }

      if (mapping.envKeys.appSecret && process.env[mapping.envKeys.appSecret]) {
        updates.appSecret = process.env[mapping.envKeys.appSecret];
        hasUpdates = true;
      } else if (mapping.envKeys.appSecret) {
        allKeysPresent = false;
      }

      if (mapping.provider === 'cloudflare_r2') {
        const r2Config: any = {};
        let hasR2Config = false;

        if (mapping.envKeys.accountId && process.env[mapping.envKeys.accountId]) {
          r2Config.accountId = process.env[mapping.envKeys.accountId];
          hasR2Config = true;
        } else if (mapping.envKeys.accountId) {
          allKeysPresent = false;
        }

        if (mapping.envKeys.accessKeyId && process.env[mapping.envKeys.accessKeyId]) {
          r2Config.accessKeyId = process.env[mapping.envKeys.accessKeyId];
          hasR2Config = true;
        } else if (mapping.envKeys.accessKeyId) {
          allKeysPresent = false;
        }

        if (mapping.envKeys.secretAccessKey && process.env[mapping.envKeys.secretAccessKey]) {
          r2Config.secretAccessKey = process.env[mapping.envKeys.secretAccessKey];
          hasR2Config = true;
        } else if (mapping.envKeys.secretAccessKey) {
          allKeysPresent = false;
        }

        if (mapping.envKeys.bucketName && process.env[mapping.envKeys.bucketName]) {
          r2Config.bucketName = process.env[mapping.envKeys.bucketName];
          hasR2Config = true;
        } else if (mapping.envKeys.bucketName) {
          allKeysPresent = false;
        }

        if (hasR2Config) {
          updates.additionalConfig = r2Config;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        const docRef = firestore.collection(API_CONFIGS_COLLECTION).doc(mapping.provider);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
          await docRef.set({
            ...updates,
            isConnected: allKeysPresent,
          });
          console.log(`  ✅ Created ${mapping.provider} config from environment`);
        } else {
          const existingData = docSnap.data();
          const needsUpdate = 
            (updates.apiKey && existingData?.apiKey !== updates.apiKey) ||
            (updates.appId && existingData?.appId !== updates.appId) ||
            (updates.appSecret && existingData?.appSecret !== updates.appSecret) ||
            (updates.additionalConfig && JSON.stringify(existingData?.additionalConfig) !== JSON.stringify(updates.additionalConfig));

          if (needsUpdate || !existingData?.isConnected) {
            await docRef.set({
              ...existingData,
              ...updates,
              isConnected: allKeysPresent,
            }, { merge: true });
            console.log(`  ✅ Updated ${mapping.provider} config from environment`);
          }
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Failed to sync ${mapping.provider}:`, error.message);
    }
  }

  console.log('✅ Environment sync complete');
}

export async function getEnvConfigStatus(): Promise<Array<{ provider: string; configured: boolean }>> {
  const status: Array<{ provider: string; configured: boolean }> = [];

  for (const mapping of ENV_MAPPINGS) {
    let configured = true;

    for (const [key, envVar] of Object.entries(mapping.envKeys)) {
      if (envVar && !process.env[envVar]) {
        configured = false;
        break;
      }
    }

    status.push({ provider: mapping.provider, configured });
  }

  return status;
}
