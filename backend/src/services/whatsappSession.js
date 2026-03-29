/**
 * WhatsApp Booking Session Store
 * In-memory session state per phone number.
 * Sessions expire after 15 minutes of inactivity.
 */

const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

const sessions = new Map();

/**
 * Session shape:
 * {
 *   step: 'IDENTIFY' | 'PROCEDURE' | 'DATE' | 'TIME' | 'CONFIRM' | 'DONE',
 *   patientId: string,
 *   patientName: string,
 *   procedure: string,
 *   date: string,        // YYYY-MM-DD
 *   time: string,        // HH:MM
 *   providerId: string,
 *   providerName: string,
 *   lastActivity: number
 * }
 */

function get(phone) {
  const session = sessions.get(phone);
  if (!session) return null;
  if (Date.now() - session.lastActivity > EXPIRY_MS) {
    sessions.delete(phone);
    return null;
  }
  session.lastActivity = Date.now();
  return session;
}

function set(phone, data) {
  const existing = sessions.get(phone) || {};
  sessions.set(phone, { ...existing, ...data, lastActivity: Date.now() });
}

function clear(phone) {
  sessions.delete(phone);
}

module.exports = { get, set, clear };
