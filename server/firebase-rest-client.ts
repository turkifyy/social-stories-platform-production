const FIRESTORE_BASE_URL = 'https://firestore.googleapis.com/v1';

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, any>;
  createTime?: string;
  updateTime?: string;
}

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (token) {
    console.log('🔑 Auth token set for Firestore REST API (length:', token.length, ')');
  } else {
    console.log('🔑 Auth token cleared');
  }
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

function getProjectId(): string {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is not configured');
  }
  return projectId;
}

function getApiKey(): string {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_FIREBASE_API_KEY is not configured');
  }
  return apiKey;
}

function firestoreValueToJs(value: any): any {
  if (value === null || value === undefined) return null;
  
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(firestoreValueToJs);
  }
  if ('mapValue' in value) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      result[k] = firestoreValueToJs(v);
    }
    return result;
  }
  return null;
}

function jsToFirestoreValue(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(jsToFirestoreValue),
      },
    };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        fields[k] = jsToFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function documentToObject(doc: FirestoreDocument): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = firestoreValueToJs(value);
  }
  
  if (doc.name) {
    const parts = doc.name.split('/');
    result.id = parts[parts.length - 1];
  }
  
  return result;
}

function objectToDocument(data: Record<string, any>): { fields: Record<string, any> } {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && value !== undefined) {
      fields[key] = jsToFirestoreValue(value);
    }
  }
  return { fields };
}

async function firestoreRequest(path: string, options: RequestInit = {}): Promise<any> {
  const projectId = getProjectId();
  const apiKey = getApiKey();
  
  const url = `${FIRESTORE_BASE_URL}/projects/${projectId}/databases/(default)/documents${path}?key=${apiKey}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Firestore REST API error:', errorData);
    throw new Error(errorData.error?.message || `Firestore request failed: ${response.status}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const firestoreRest = {
  async getDocument(collection: string, docId: string): Promise<Record<string, any> | null> {
    try {
      const doc = await firestoreRequest(`/${collection}/${docId}`);
      return documentToObject(doc);
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  },

  async setDocument(collection: string, docId: string, data: Record<string, any>, merge = false): Promise<void> {
    const document = objectToDocument(data);
    
    if (merge) {
      const existing = await this.getDocument(collection, docId);
      if (existing) {
        const merged = { ...existing, ...data };
        delete merged.id;
        const mergedDoc = objectToDocument(merged);
        await firestoreRequest(`/${collection}/${docId}`, {
          method: 'PATCH',
          body: JSON.stringify(mergedDoc),
        });
        return;
      }
    }
    
    await firestoreRequest(`/${collection}/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify(document),
    });
  },

  async addDocument(collection: string, data: Record<string, any>): Promise<string> {
    const document = objectToDocument(data);
    const result = await firestoreRequest(`/${collection}`, {
      method: 'POST',
      body: JSON.stringify(document),
    });
    
    const parts = result.name.split('/');
    return parts[parts.length - 1];
  },

  async deleteDocument(collection: string, docId: string): Promise<void> {
    await firestoreRequest(`/${collection}/${docId}`, {
      method: 'DELETE',
    });
  },

  async getCollection(collection: string): Promise<Array<Record<string, any>>> {
    try {
      const result = await firestoreRequest(`/${collection}`);
      if (!result.documents) return [];
      
      return result.documents
        .map(documentToObject)
        .filter((doc: any): doc is Record<string, any> => doc !== null);
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('NOT_FOUND')) {
        return [];
      }
      throw error;
    }
  },

  async queryCollection(
    collection: string,
    filters: Array<{ field: string; op: string; value: any }> = [],
    orderBy?: { field: string; direction: 'ASCENDING' | 'DESCENDING' },
    limit?: number
  ): Promise<Array<Record<string, any>>> {
    const projectId = getProjectId();
    const apiKey = getApiKey();
    
    const structuredQuery: any = {
      from: [{ collectionId: collection }],
    };
    
    if (filters.length > 0) {
      const firestoreFilters = filters.map(f => ({
        fieldFilter: {
          field: { fieldPath: f.field },
          op: f.op,
          value: jsToFirestoreValue(f.value),
        },
      }));
      
      if (firestoreFilters.length === 1) {
        structuredQuery.where = firestoreFilters[0];
      } else {
        structuredQuery.where = {
          compositeFilter: {
            op: 'AND',
            filters: firestoreFilters,
          },
        };
      }
    }
    
    if (orderBy) {
      structuredQuery.orderBy = [{
        field: { fieldPath: orderBy.field },
        direction: orderBy.direction,
      }];
    }
    
    if (limit) {
      structuredQuery.limit = limit;
    }
    
    const url = `${FIRESTORE_BASE_URL}/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Firestore query error:', errorData);
      throw new Error(errorData.error?.message || `Query failed: ${response.status}`);
    }
    
    const results = await response.json();
    
    return results
      .filter((r: any) => r.document)
      .map((r: any) => documentToObject(r.document))
      .filter((doc: any): doc is Record<string, any> => doc !== null);
  },
};
