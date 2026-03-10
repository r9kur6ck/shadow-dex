export default {
    async fetch(request: Request, env: any): Promise<Response> {
        const url = new URL(request.url);

        // Handle /hf-proxy/* requests
        if (url.pathname.startsWith('/hf-proxy/')) {
            const path = url.pathname.replace(/^\/hf-proxy\//, '');
            const hfUrl = `https://huggingface.co/${path}${url.search}`;

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

            try {
                const proxyResponse = await fetch(hfUrl, {
                    method: request.method,
                    redirect: 'follow',
                });

                const newHeaders = new Headers(proxyResponse.headers);
                newHeaders.set('Access-Control-Allow-Origin', '*');
                newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                newHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

                return new Response(proxyResponse.body, {
                    status: proxyResponse.status,
                    statusText: proxyResponse.statusText,
                    headers: newHeaders,
                });
            } catch (error) {
                return new Response(`Proxy Error: ${error}`, { status: 502 });
            }
        }

        // For all other requests, pass through to static assets (handled by Cloudflare Assets with SPA fallback)
        return env.ASSETS.fetch(request);
    },
};
