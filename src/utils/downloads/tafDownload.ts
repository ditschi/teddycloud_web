export function triggerBrowserDownload(url: string, filename?: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    if (filename) {
        link.download = filename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function toSameOriginUrl(url: string): string {
    if (!url) {
        return url;
    }
    if (url.startsWith("/")) {
        return url;
    }
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return url;
    }
}

export function buildTafDownloadUrl(
    contentUrl: string,
    options: {
        tracks?: number[];
        filename?: string;
        entries?: string[];
    } = {},
): string {
    const relative = toSameOriginUrl(contentUrl);
    const parsed = new URL(relative, window.location.origin);
    parsed.searchParams.set("ogg", "true");
    parsed.searchParams.delete("tracks");
    parsed.searchParams.delete("filename");
    parsed.searchParams.delete("entry");

    if (options.tracks && options.tracks.length > 0) {
        parsed.searchParams.set("tracks", options.tracks.join(","));
    }
    if (options.filename) {
        parsed.searchParams.set("filename", options.filename);
    }
    (options.entries || []).forEach((entry) => {
        parsed.searchParams.append("entry", entry);
    });

    return parsed.pathname + parsed.search;
}
