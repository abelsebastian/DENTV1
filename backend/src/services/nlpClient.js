/**
 * NLP microservice client.
 * Falls back to keyword-based sentiment if the Python service is unavailable.
 */
const { analyzeSentiment: keywordSentiment } = require('./intelligence');

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8001';

/**
 * Map DistilBERT binary label → our three-way sentiment.
 * The model only returns POSITIVE / NEGATIVE, so we use the score
 * to distinguish confident positives from neutral-ish ones.
 */
function mapLabel(label, score) {
  if (label === 'POSITIVE') return score >= 0.85 ? 'POSITIVE' : 'NEUTRAL';
  return 'NEGATIVE';
}

/**
 * Analyze sentiment via the NLP microservice.
 * @param {string} text
 * @returns {Promise<string>} 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
 */
async function getSentiment(text) {
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/nlp/sentiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (!res.ok) throw new Error(`NLP service responded ${res.status}`);
    const data = await res.json();
    return mapLabel(data.label, data.score);
  } catch {
    // Fallback to keyword-based
    return keywordSentiment(text);
  }
}

module.exports = { getSentiment };
