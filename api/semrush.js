// Semrush Analytics API proxy — Vercel Serverless Function
// Set this in Vercel dashboard → Settings → Environment Variables:
//   SEMRUSH_API_KEY  (your Semrush API key)

// ── Vercel handler ─────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const apiKey = process.env.SEMRUSH_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'SEMRUSH_API_KEY environment variable is not set in Vercel.' });
    }

    const params = new URLSearchParams(req.query);
    params.set('key', apiKey);

    try {
        const resp = await fetch(`https://api.semrush.com/analytics/v1/?${params.toString()}`);
        const text = await resp.text();
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(text);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
