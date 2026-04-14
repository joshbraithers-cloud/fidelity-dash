exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
    };

    // 1. Forcefully clean the API key of any accidental spaces
    const apiKey = (process.env.SEMRUSH_API_KEY || '').trim();
    if (!apiKey) {
        return { statusCode: 500, headers, body: 'Missing API Key' };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    params.set('key', apiKey);

    // 2. Decode the %2C back into real commas so Semrush doesn't crash
    let finalQuery = decodeURIComponent(params.toString());

    // 3. Intercept and destroy Claude's fake columns so the request passes
    finalQuery = finalQuery.replace(/,Td/g, '').replace(/,Bl/g, '');

    try {
        const resp = await fetch(`https://api.semrush.com/?${finalQuery}`);
        const text = await resp.text();
        return { statusCode: 200, headers, body: text };
    } catch (err) {
        return { statusCode: 500, headers, body: err.message };
    }
};