// Manual verification script for Step 2's completion check: an
// unauthenticated call to a protected callable must be rejected.
//
// Prerequisites: functions built (npm run functions:build) and the
// functions emulator running (npm run emulators, or --only functions).
// Run from the repo root, where the `firebase` client SDK is installed:
//   npm run functions:test:manual-ping
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp({ projectId: 'demo-goalcalendly' });
const functions = getFunctions(app);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

const ping = httpsCallable(functions, 'ping');

try {
  const result = await ping({});
  console.log('UNEXPECTED SUCCESS', result.data);
  process.exit(1);
} catch (err) {
  console.log('Rejected as expected:', err.code, err.message);
  process.exit(err.code === 'functions/unauthenticated' ? 0 : 1);
}
