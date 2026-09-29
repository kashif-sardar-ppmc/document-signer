import crypto from 'node:crypto';

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const secret = process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
// nonce -> expiry, so each captcha can be used only once
const usedNonces = new Map();

function sign(answer, exp, nonce) {
  return crypto.createHmac('sha256', secret).update(`${answer}:${exp}:${nonce}`).digest('hex');
}

function purgeExpired() {
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(nonce);
  }
}

export function generateCaptcha() {
  const ops = ['+', '-', '×'];
  const op = ops[crypto.randomInt(ops.length)];
  let a = crypto.randomInt(1, 10);
  let b = crypto.randomInt(1, 10);
  if (op === '-' && b > a) [a, b] = [b, a];
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const nonce = crypto.randomBytes(8).toString('hex');
  const token = `${exp}.${nonce}.${sign(answer, exp, nonce)}`;
  return { question: `${a} ${op} ${b}`, token };
}

export function verifyCaptcha(token, answer) {
  if (typeof token !== 'string' || answer === undefined || answer === null || answer === '') {
    return false;
  }
  const [exp, nonce, sig] = token.split('.');
  if (!exp || !nonce || !sig || Number(exp) < Date.now() || usedNonces.has(nonce)) {
    return false;
  }
  const expected = Buffer.from(sign(String(answer).trim(), exp, nonce));
  const given = Buffer.from(sig);
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (ok) {
    purgeExpired();
    usedNonces.set(nonce, Number(exp));
  }
  return ok;
}

export default async function getCaptcha() {
  return generateCaptcha();
}
