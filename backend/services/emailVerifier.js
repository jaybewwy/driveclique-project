/**
 * Email address validation using the email-verifier service.
 * https://github.com/umuterturk/email-verifier
 *
 * Checks syntax, domain existence, MX records, and disposable-email detection.
 * Fails open (allows registration) when the service is unreachable so that
 * a third-party outage never blocks legitimate sign-ups.
 */

const VERIFIER_BASE =
  (process.env.EMAIL_VERIFIER_URL || 'https://rapid-email-verifier.fly.dev').replace(/\/$/, '');

/**
 * @typedef {{ valid: boolean, status?: string, reason?: string }} VerifyResult
 */

/**
 * Validates an email address before registration.
 * @param {string} email
 * @returns {Promise<VerifyResult>}
 */
const verifyEmailAddress = async (email) => {
  try {
    const url = `${VERIFIER_BASE}/api/validate?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      console.warn(`[EmailVerifier] Unexpected status ${response.status} — failing open`);
      return { valid: true };
    }

    const data = await response.json();

    switch (data.status) {
      case 'INVALID_FORMAT':
        return { valid: false, status: 'INVALID_FORMAT', reason: 'Invalid email format.' };
      case 'INVALID_DOMAIN':
        return { valid: false, status: 'INVALID_DOMAIN', reason: 'Email domain does not exist or has no mail server.' };
      case 'NO_MX_RECORDS':
        return { valid: false, status: 'NO_MX_RECORDS', reason: 'Email domain has no mail server configured and cannot receive email.' };
      case 'DISPOSABLE':
        return { valid: false, status: 'DISPOSABLE', reason: 'Disposable email addresses are not allowed. Please use a permanent email.' };
      default:
        // VALID, PROBABLY_VALID (role-based) — both accepted
        return { valid: true, status: data.status };
    }
  } catch (err) {
    // Timeout, network error, or JSON parse failure — fail open
    console.warn('[EmailVerifier] Service unavailable, skipping validation —', err.message);
    return { valid: true };
  }
};

module.exports = { verifyEmailAddress };
