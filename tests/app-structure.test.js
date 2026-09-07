const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("the game catalog preserves every existing game and adds categorized new games", function () {
    const appSource = readProjectFile("app.js");
    const expectedGames = new Map([
        ["Monopoly Board Game", "Board Games"],
        ["Sorry!", "Board Games"],
        ["Contract Whist (Heck No)", "Card Games"],
        ["Crazy Eights", "Card Games"],
        ["German Whist", "Card Games"],
        ["Gin Rummy", "Card Games"],
        ["Go Fish", "Card Games"],
        ["Hearts", "Card Games"],
        ["Jik Jak", "Card Games"],
        ["Monopoly Card Game", "Card Games"],
        ["Old Maid", "Card Games"],
        ["Farkle", "Dice Games"],
        ["Jeopardy", "Trivia / Game Show"],
        ["Blank Space", "Word / Party Games"],
        ["Password", "Word / Party Games"],
        ["Scattergories", "Word / Party Games"],
        ["Wheel of Fortune", "Word / Party Games"],
        ["Pickleball", "Sports / Physical Games"]
    ]);
    const catalogMatches = appSource.matchAll(
        /\{ name: "([^"]+)", category: "([^"]+)" \}/g
    );
    const actualGames = new Map(
        Array.from(catalogMatches, function (match) {
            return [match[1], match[2]];
        })
    );

    assert.deepEqual(actualGames, expectedGames);
    assert.match(appSource, /document\.createElement\("optgroup"\)/);
});

test("all three modules share a three-link bottom navigation with one active item", function () {
    const pages = [
        { activeHref: "./index.html", file: "index.html" },
        { activeHref: "./workouts.html", file: "workouts.html" },
        { activeHref: "./gift-cards.html", file: "gift-cards.html" }
    ];

    pages.forEach(function (page) {
        const html = readProjectFile(page.file);
        const navMatch = html.match(
            /<nav class="bottom-nav"[\s\S]*?<\/nav>/
        );

        assert.ok(navMatch, page.file + " includes the bottom navigation");
        assert.equal((navMatch[0].match(/<a /g) || []).length, 3);
        assert.equal((navMatch[0].match(/aria-current="page"/g) || []).length, 1);
        assert.match(
            navMatch[0],
            new RegExp(
                '<a href="' + page.activeHref.replace(".", "\\.") + '" aria-current="page">'
            )
        );
    });
});

test("the service worker caches every production module shell asset", function () {
    const serviceWorkerSource = readProjectFile("service-worker.js");
    const requiredAssets = [
        "./index.html",
        "./workouts.html",
        "./gift-cards.html",
        "./styles.css",
        "./workouts.css",
        "./gift-cards.css",
        "./dashboard-ui.js",
        "./workout-utils.js",
        "./app.js",
        "./workouts.js",
        "./gift-cards.js"
    ];

    requiredAssets.forEach(function (asset) {
        assert.ok(
            serviceWorkerSource.includes('"' + asset + '"'),
            "service worker includes " + asset
        );
    });

    assert.match(serviceWorkerSource, /family-game-night-dashboard-v3\.00/);
    assert.match(serviceWorkerSource, /endsWith\("\/workouts\.html"\)/);
});
