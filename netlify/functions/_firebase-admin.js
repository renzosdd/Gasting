import admin from 'firebase-admin';

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
};

export const getAdminApp = () => {
  if (admin.apps.length) return admin.app();

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT en Netlify.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
};

export const getAdminDb = () => getAdminApp().firestore();
export const getAdminAuth = () => getAdminApp().auth();

export const verifyAdminRequest = async (event) => {
  const scheduledHeader = event.headers?.['x-netlify-scheduled'] || event.headers?.['X-Netlify-Scheduled'];
  const eventHeader = event.headers?.['x-netlify-event'] || event.headers?.['X-Netlify-Event'];
  if (scheduledHeader === 'true' || eventHeader === 'schedule') return { scheduled: true };

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Falta token de autorización.');

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = decoded.email?.toLowerCase();
  const db = getAdminDb();
  const adminByUid = await db.collection('admins').doc(decoded.uid).get();
  const adminByEmail = email ? await db.collection('admins').doc(email).get() : null;
  const envAdmin = (process.env.VITE_ADMIN_EMAIL || 'renzodogliotti@gmail.com').toLowerCase();

  if (!adminByUid.exists && !adminByEmail?.exists && email !== envAdmin) {
    throw new Error('No tenés permisos de admin.');
  }

  return { uid: decoded.uid, email };
};
