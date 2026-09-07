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
        ["Wheel of Fortune", "Trivia / Game Show"],
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

test("workout startup configuration is initialized before any initial data load", function () {
    const workoutSource = readProjectFile("workouts.js");
    const configurationIndex = workoutSource.indexOf(
        "const WORKOUT_FETCH_PAGE_SIZE = 500;"
    );
    const initialLoadIndexes = Array.from(
        workoutSource.matchAll(/loadWorkoutResults\(\);/g),
        function (match) {
            return match.index;
        }
    );

    assert.ok(configurationIndex >= 0, "fetch page size configuration exists");
    assert.ok(initialLoadIndexes.length > 0, "startup invokes the workout loader");
    initialLoadIndexes.forEach(function (loadIndex) {
        assert.ok(
            configurationIndex < loadIndex,
            "fetch page size is initialized before loadWorkoutResults runs"
        );
    });
});

test("workout dates expose an accessible expanded-detail dialog", function () {
    const workoutHtml = readProjectFile("workouts.html");
    const workoutSource = readProjectFile("workouts.js");
    const workoutStyles = readProjectFile("workouts.css");

    assert.match(
        workoutHtml,
        /<dialog id="workout-date-dialog"[^>]*aria-labelledby="workout-date-title"/
    );
    assert.match(workoutHtml, /id="workout-date-details"/);
    assert.match(workoutHtml, /id="close-workout-date-dialog"/);
    assert.match(workoutSource, /"Show workout details for " \+ formatWorkoutDateLong/);
    assert.match(workoutSource, /event\.target\.closest\("\.participant-marker"\)/);
    assert.match(workoutSource, /event\.stopPropagation\(\)/);
    assert.match(workoutSource, /event\.key === "Escape"/);
    assert.match(workoutSource, /text: completed \? "Workout completed" : "No workout recorded"/);
    assert.match(
        workoutStyles,
        /\.workout-date-dialog\[open\][\s\S]*animation: workout-date-dialog-in/
    );
    assert.match(
        workoutStyles,
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.workout-date-dialog\[open\]/
    );
});

test("workout completion audio is guarded by the successful today celebration", function () {
    const workoutSource = readProjectFile("workouts.js");
    const audioPath = path.join(projectRoot, "assets", "audio", "workout-complete.mp3");

    assert.match(
        workoutSource,
        /const WORKOUT_COMPLETE_AUDIO_SOURCE = "assets\/audio\/workout-complete\.mp3"/
    );
    assert.match(workoutSource, /new Audio\(WORKOUT_COMPLETE_AUDIO_SOURCE\)/);
    assert.match(workoutSource, /audio\.preload = "auto"/);
    assert.match(workoutSource, /audio\.volume = WORKOUT_COMPLETE_AUDIO_VOLUME/);
    assert.match(
        workoutSource,
        /if \(newWorkoutSaved && dateString === today\) \{\s*animateTodayWorkoutCompletion\(\);\s*playWorkoutCompletionSound\(\);\s*\}/
    );
    assert.match(
        workoutSource,
        /const playPromise = workoutCompletionAudio\.play\(\);[\s\S]*playPromise\.catch/
    );
    assert.equal(
        (workoutSource.match(/playWorkoutCompletionSound\(\);/g) || []).length,
        1,
        "the completion sound has one success-path call site"
    );
    assert.ok(fs.statSync(audioPath).size > 0, "workout completion audio asset is non-empty");
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
        "./gift-cards.js",
        "./assets/audio/workout-complete.mp3"
    ];

    requiredAssets.forEach(function (asset) {
        assert.ok(
            serviceWorkerSource.includes('"' + asset + '"'),
            "service worker includes " + asset
        );
    });

    assert.match(serviceWorkerSource, /family-game-night-dashboard-v3\.02/);
    assert.match(serviceWorkerSource, /endsWith\("\/workouts\.html"\)/);
});
