const extensionOrigin = chrome.runtime.getURL('').slice(0, -1);

const originalFetch = globalThis.fetch;

const fetchProxyHandler = {
    apply: (target, thisArg, argumentsList) => {
        return Reflect.apply(target, thisArg, argumentsList)
            .then(async (response) => {
                if (response.url.startsWith(extensionOrigin) && response.url.includes('voy_search_bg') && response.url.endsWith('.wasm')) {
                    console.log("Fetch response received:", response.status, response.url, response.headers.get('Content-Type'));
                    const newHeaders = new Headers(response.headers);

                    newHeaders.set('Content-Type', 'application/vnd.wasm');
                    newHeaders.set('content-security-policy', "script-src 'self' 'wasm-eval';")
                    const buffer = await response.arrayBuffer();

                    const newResponse = new Response(buffer, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,

                    });
                    return newResponse;
                }
                return response;
            });
    }
};

globalThis.fetch = new Proxy(originalFetch, fetchProxyHandler);