import assert from "node:assert/strict";

function toSameOriginUrl(url) {
    if (!url) {
        return url;
    }
    if (url.startsWith("/")) {
        return url;
    }
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname + parsed.search + parsed.hash;
}

function buildTafDownloadUrl(contentUrl, options = {}) {
    const relative = toSameOriginUrl(contentUrl);
    const parsed = new URL(relative, "http://localhost");
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

const whole = buildTafDownloadUrl("/content/library/story.taf?special=library", {
    filename: "story.ogg",
});
assert.equal(new URL(whole, "http://localhost").searchParams.get("ogg"), "true");
assert.equal(new URL(whole, "http://localhost").searchParams.get("tracks"), null);
assert.equal(new URL(whole, "http://localhost").searchParams.get("filename"), "story.ogg");

const one = buildTafDownloadUrl("/content/library/story.taf", {
    tracks: [3],
    filename: "03 Chapter.ogg",
    entries: ["03 Chapter.ogg"],
});
const oneParams = new URL(one, "http://localhost").searchParams;
assert.equal(oneParams.get("ogg"), "true");
assert.equal(oneParams.get("tracks"), "3");
assert.equal(oneParams.getAll("entry").length, 1);

const many = buildTafDownloadUrl("/content/library/story.taf", {
    tracks: [1, 2, 5],
    filename: "story.zip",
    entries: ["01 a.ogg", "02 b.ogg", "05 c.ogg"],
});
const manyParams = new URL(many, "http://localhost").searchParams;
assert.equal(manyParams.get("ogg"), "true");
assert.equal(manyParams.get("tracks"), "1,2,5");
assert.equal(manyParams.get("filename"), "story.zip");
assert.deepEqual(manyParams.getAll("entry"), ["01 a.ogg", "02 b.ogg", "05 c.ogg"]);

console.log("taf download URL contract ok");
