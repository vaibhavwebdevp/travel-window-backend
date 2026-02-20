/**
 * POST/GET /api/seed – run DB seed (users + suppliers). Idempotent.
 * Only runs if query/body secret matches SEED_SECRET (set in Vercel / .env).
 */
const express = require('express');
const { runSeed } = require('../scripts/seedLogic');

const router = express.Router();

router.all('/seed', async (req, res) => {
  const secret = req.query.secret || req.body?.secret;
  const expected = process.env.SEED_SECRET;

  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: 'Seed not configured (SEED_SECRET not set)',
    });
  }
  if (secret !== expected) {
    return res.status(403).json({ ok: false, error: 'Invalid secret' });
  }

  try {
    const created = await runSeed();
    return res.json({
      ok: true,
      message: 'Seed completed (idempotent)',
      created,
    });
  } catch (err) {
    console.error('Seed route error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
