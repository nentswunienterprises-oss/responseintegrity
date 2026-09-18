// Runtime configuration for API URL
var PRODUCTION_API_URL = "https://api.responseintegrity.co.za";
export function getApiUrl() {
    if (typeof window !== "undefined") {
        var hostname = window.location.hostname.toLowerCase();
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return "http://localhost:5000";
        }
        if (hostname.endsWith(".vercel.app")) {
            return "";
        }
    }
    return PRODUCTION_API_URL;
}
export var API_URL = getApiUrl();
