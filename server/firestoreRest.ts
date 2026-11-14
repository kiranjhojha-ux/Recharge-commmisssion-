import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
export const firebaseConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf8'),
) as FirebaseAppletConfig;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'kiranjhojha@gmail.com';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  idToken: string;
}

export async function verifyFirebaseIdToken(authHeader: string | undefined): Promise<VerifiedFirebaseUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED: लॉगिन टोकन अनुपस्थित है।');
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    throw new Error('UNAUTHENTICATED: अमान्य लॉगिन टोकन।');
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
    audience: firebaseConfig.projectId,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0] || 'उपयोगकर्ता';

  if (!uid || !email) {
    throw new Error('UNAUTHENTICATED: उपयोगकर्ता पहचान अमान्य है।');
  }
  if (!emailVerified) {
    throw new Error('FORBIDDEN: कृपया पहले अपना ईमेल सत्यापित करें।');
  }

  return { uid, email, emailVerified, name, idToken };
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

export function docResourceName(docPath: string): string {
  const clean = docPath.replace(/^\/+/, '');
  return `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${clean}`;
}

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function encodeFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => encodeFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

export function decodeFirestoreValue(val: FirestoreValue): unknown {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    return decodeFirestoreFields(val.mapValue.fields || {});
  }
  return null;
}

export function decodeFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!fields) return result;
  for (const [k, v] of Object.entries(fields)) {
    result[k] = decodeFirestoreValue(v);
  }
  return result;
}

export interface FirestoreDocResult<T = Record<string, unknown>> {
  exists: boolean;
  data: T | null;
  updateTime?: string;
  name?: string;
}

export async function getFirestoreDoc<T = Record<string, unknown>>(
  docPath: string,
  idToken: string,
): Promise<FirestoreDocResult<T>> {
  const clean = docPath.replace(/^\/+/, '');
  const res = await fetch(`${FIRESTORE_BASE}/${clean}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'x-goog-api-key': firebaseConfig.apiKey,
    },
  });

  if (res.status === 404) {
    return { exists: false, data: null };
  }

  const body = (await res.json()) as {
    name?: string;
    fields?: Record<string, FirestoreValue>;
    updateTime?: string;
    error?: { message?: string; status?: string };
  };

  if (!res.ok) {
    throw new Error(`FIRESTORE_READ_ERROR (${res.status}): ${body.error?.message || res.statusText}`);
  }

  return {
    exists: true,
    data: decodeFirestoreFields(body.fields) as T,
    updateTime: body.updateTime,
    name: body.name,
  };
}

export interface QueryFilter {
  field: string;
  op: 'EQUAL' | 'IN';
  value: unknown;
}

export async function queryFirestoreCollection<T = Record<string, unknown>>(
  collectionId: string,
  idToken: string,
  options?: {
    filters?: QueryFilter[];
    orderByField?: string;
    direction?: 'ASCENDING' | 'DESCENDING';
    limit?: number;
  },
): Promise<Array<{ data: T; updateTime?: string; id: string }>> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
  };

  if (options?.filters && options.filters.length > 0) {
    const fieldFilters = options.filters.map((f) => ({
      fieldFilter: {
        field: { fieldPath: f.field },
        op: f.op,
        value: encodeFirestoreValue(f.value),
      },
    }));
    structuredQuery.where =
      fieldFilters.length === 1
        ? fieldFilters[0]
        : {
            compositeFilter: {
              op: 'AND',
              filters: fieldFilters,
            },
          };
  }

  if (options?.orderByField) {
    structuredQuery.orderBy = [
      {
        field: { fieldPath: options.orderByField },
        direction: options.direction || 'DESCENDING',
      },
    ];
  }

  if (options?.limit) {
    structuredQuery.limit = options.limit;
  }

  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'x-goog-api-key': firebaseConfig.apiKey,
    },
    body: JSON.stringify({ structuredQuery }),
  });

  const body = (await res.json()) as
    | Array<{
        document?: {
          name: string;
          fields?: Record<string, FirestoreValue>;
          updateTime?: string;
        };
      }>
    | { error?: { message?: string } };

  if (!res.ok) {
    const errMsg = !Array.isArray(body) ? body.error?.message : res.statusText;
    throw new Error(`FIRESTORE_QUERY_ERROR (${res.status}): ${errMsg || res.statusText}`);
  }

  if (!Array.isArray(body)) return [];

  const items: Array<{ data: T; updateTime?: string; id: string }> = [];
  for (const row of body) {
    if (row.document) {
      const parts = row.document.name.split('/');
      items.push({
        id: parts[parts.length - 1],
        data: decodeFirestoreFields(row.document.fields) as T,
        updateTime: row.document.updateTime,
      });
    }
  }
  return items;
}

export interface CommitWriteOp {
  docPath: string;
  fields: Record<string, unknown>;
  updateMask?: string[];
  serverTimestampFields?: string[];
  precondition?: { exists?: boolean; updateTime?: string };
}

export async function commitFirestoreWrites(writes: CommitWriteOp[], idToken: string): Promise<void> {
  const formattedWrites = writes.map((w) => {
    const writeObj: Record<string, unknown> = {
      update: {
        name: docResourceName(w.docPath),
        fields: encodeFirestoreFields(w.fields),
      },
    };
    if (w.updateMask && w.updateMask.length > 0) {
      writeObj.updateMask = { fieldPaths: w.updateMask };
    }
    if (w.serverTimestampFields && w.serverTimestampFields.length > 0) {
      writeObj.updateTransforms = w.serverTimestampFields.map((fieldPath) => ({
        fieldPath,
        setToServerValue: 'REQUEST_TIME',
      }));
    }
    if (w.precondition) {
      writeObj.currentDocument = w.precondition;
    }
    return writeObj;
  });

  const res = await fetch(`${FIRESTORE_BASE}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'x-goog-api-key': firebaseConfig.apiKey,
    },
    body: JSON.stringify({ writes: formattedWrites }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new Error(`FIRESTORE_COMMIT_ERROR (${res.status}): ${body.error?.message || res.statusText}`);
  }
}

export async function isUserAdmin(user: VerifiedFirebaseUser): Promise<boolean> {
  if (user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() && user.emailVerified) {
    return true;
  }
  const adminDoc = await getFirestoreDoc(`admins/${user.uid}`, user.idToken);
  return adminDoc.exists;
}
