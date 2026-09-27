/**
 * Trusted Firebase Admin initialization and common authentication helpers.
 *
 * All callable functions must go through requireAuth (and requireAdmin where
 * privileged) rather than trusting any client-supplied UID or role field.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

if (getApps().length === 0) {
  // Passing projectId explicitly (rather than relying on initializeApp()'s
  // ambient detection) fixes a real issue hit running scripts/setAdminClaim.ts
  // locally against a real project: the Auth SDK's identitytoolkit client
  // resolved an unrelated cached project ID via ADC and failed with
  // "quota project" / SERVICE_DISABLED errors even after GOOGLE_APPLICATION
  // credentials and the quota project were both correctly configured.
  // Deployed Cloud Functions also set GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT, so
  // this is safe there too — it isn't just a local-script workaround.
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  initializeApp(projectId ? { projectId } : undefined);
}

export const db = getFirestore();
export const auth = getAuth();

/**
 * Verifies the caller is authenticated and returns their UID.
 * Firebase Functions v2 callables already verify the ID token before
 * `request.auth` is populated, but we fail closed if it is somehow absent.
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return request.auth.uid;
}

/**
 * Verifies the caller carries the trusted admin custom claim.
 * Never derive admin status from email address or client-supplied fields —
 * see admin_subscriptions.md section 2/3 on removing the hard-coded
 * admin@admin.com check.
 */
export function requireAdmin(request: CallableRequest): string {
  const uid = requireAuth(request);
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin privileges required.');
  }
  return uid;
}
