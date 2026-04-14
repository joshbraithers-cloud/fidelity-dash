// GA4 Data API proxy — Vercel Serverless Function
// Set these in Vercel dashboard → Settings → Environment Variables:
//   GA4_SERVICE_ACCOUNT  (full contents of the service account JSON file)
//   GA4_PROPERTY_ID      (e.g. 319624134)

const { createSign } = require('crypto');

function base64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(sa) {
    const now = Math.floor(Date.now() / 1000);
    const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }));
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = base64url(sign.sign(sa.private_key));
    const jwt = `${header}.${payload}.${sig}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
    return data.access_token;
}

function buildRequest(report, days) {
    const dateRange = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
    const reports = {
        overview: {
            dateRanges: dateRange,
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'newUsers' },
                { name: 'engagementRate' },
                { name: 'averageSessionDuration' },
                { name: 'screenPageViews' },
                { name: 'conversions' },
                { name: 'bounceRate' },
            ],
        },
        trend: {
            dateRanges: dateRange,
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
            orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
        channels: {
            dateRanges: dateRange,
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            metrics: [{ name: 'sessions' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 8,
        },
        pages: {
            dateRanges: dateRange,
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 10,
        },
        geo: {
            dateRanges: dateRange,
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 5,
        },
        devices: {
            dateRanges: dateRange,
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'sessions' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
    };
    return reports[report] || reports.overview;
}

// ── Vercel handler ─────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=1800');

    try {
        const saJson = process.env.GA4_SERVICE_ACCOUNT;
        if (!saJson) {
            return res.status(500).json({ error: 'GA4_SERVICE_ACCOUNT environment variable is not set in Vercel.' });
        }

        let sa;
        try {
            sa = JSON.parse(saJson);
        } catch (e) {
            return res.status(500).json({ error: 'GA4_SERVICE_ACCOUNT is not valid JSON. Re-paste the full contents of the service account key file.' });
        }

        const report  = req.query.report || 'overview';
        const days    = parseInt(req.query.days || '30', 10);
        const propId  = process.env.GA4_PROPERTY_ID || '319624134';

        const token   = await getAccessToken(sa);
        const body    = buildRequest(report, days);
        const url     = `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`;

        const resp = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await resp.json();

        if (!resp.ok) {
            const msg = data?.error?.message || `GA4 API error ${resp.status}`;
            return res.status(resp.status).json({ error: msg });
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
