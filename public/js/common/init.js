const contextElement = document.getElementById('app-context');

if (contextElement) {
    try {
        const contextData = JSON.parse(contextElement.textContent);
        window.APP_LANG = contextData.lang;
        window.DICT = contextData.dict;
        window.APP_CONFIG = contextData.config;
    } catch (err) {
        console.error("[Init] Application parsing error:", err);
    }
}
