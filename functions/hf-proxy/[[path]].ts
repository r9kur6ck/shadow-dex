export const onRequest = async (context: any) => {
    const { request, params } = context;
    const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

    // Rewrite request to HuggingFace
    const url = new URL(request.url);
    const hfUrl = new URL(`https://huggingface.co/${path}${url.search}`);

    // Clone request headers, but omit host-specific ones
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('host');
    requestHeaders.delete('origin');
    requestHeaders.delete('referer');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Fetch from HuggingFace
    const proxyRequest = new Request(hfUrl.toString(), {
        method: request.method,
        headers: requestHeaders,
        body: request.body,
        redirect: 'follow', // Important: HuggingFace uses redirects for LFS and resolved files
    });

    try {
        const response = await fetch(proxyRequest);

        // Create new response with CORS headers
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');

        // Expose content-length for progress bars in Transformers.js
        newHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, X-Amz-Version-Id');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
        });
    } catch (error) {
        return new Response(`Proxy Error: ${error}`, { status: 500 });
    }
};
