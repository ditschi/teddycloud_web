import { Configuration } from "../api";

/**
 * Use empty basePath in browser so API requests are same-origin (relative URLs).
 * This fixes FetchError when the app is accessed via port forwarding (e.g. devcontainer).
 */
const getBasePath = (): string => {
    const envUrl = import.meta.env.VITE_APP_TEDDYCLOUD_API_URL;
    if (envUrl && String(envUrl).trim()) {
        return String(envUrl).trim();
    }
    if (typeof window !== "undefined") {
        return "";
    }
    return "http://localhost";
};

export const defaultAPIConfig = () =>
    new Configuration({
        basePath: getBasePath(),
        credentials: "include",
        fetchApi: async (url, init) => {
            const headers = new Headers(init?.headers);
            try {
                const token = sessionStorage.getItem("teddycloud_web_token");
                if (token && !headers.has("Authorization")) {
                    headers.set("Authorization", `Bearer ${token}`);
                }
            } catch {
                /* ignore */
            }
            const response = await fetch(url, { ...init, headers, credentials: "include" });
            if (response.status === 401) {
                const path = typeof url === "string" ? url : url.toString();
                if (!path.includes("/api/auth/")) {
                    window.dispatchEvent(new Event("teddycloud-auth-required"));
                }
            }
            return response;
        },
    });
