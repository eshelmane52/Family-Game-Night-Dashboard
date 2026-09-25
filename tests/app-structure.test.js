const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readPngDimensions(relativePath) {
    const png = fs.readFileSync(path.join(projectRoot, relativePath));

    assert.equal(
        png.subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a",
        relativePath + " is a valid PNG"
    );

    return {
        width: png.readUInt32BE(16),
        height: png.readUInt32BE(20)
    };
}

test("the game catalog is alphabetized without category groups", function () {
    const appSource = readProjectFile("app.js");
    const expectedGames = [
        "Blank Space",
        "Contract Whist (Heck No)",
        "Crazy Eights",
        "Farkle",
        "German Whist",
        "Gin Rummy",
        "Go Fish",
        "Hearts",
        "Jeopardy",
        "Jik Jak",
        "Monopoly Board Game",
        "Monopoly Card Game",
        "Old Maid",
        "Password",
        "Pickleball",
        "Scattergories",
        "Sorry!",
        "Supermallows!",
        "Wheel of Fortune",
        "Wordle!"
    ];
    const catalogMatch = appSource.match(
        /const DEFAULT_GAMES = \[([\s\S]*?)\];/
    );

    assert.ok(catalogMatch, "the game catalog is defined");

    const actualGames = Array.from(
        catalogMatch[1].matchAll(/"([^"]+)"/g),
        function (match) {
            return match[1];
        }
    );

    assert.deepEqual(actualGames, expectedGames);
    assert.deepEqual(
        actualGames,
        actualGames.slice().sort(function (firstGame, secondGame) {
            return firstGame.localeCompare(secondGame, undefined, { sensitivity: "base" });
        })
    );
    assert.doesNotMatch(appSource, /document\.createElement\("optgroup"\)/);
    assert.match(appSource, /alphabetizedGames\.forEach/);
});

test("the active install icons have the exact expected pixel dimensions", function () {
    const manifest = JSON.parse(readProjectFile("manifest.webmanifest"));
    const manifestIcons = new Map(
        manifest.icons.map(function (icon) {
            return [icon.src, icon.sizes];
        })
    );
    const expectedIcons = [
        { path: "icons/icon-192.png", size: 192 },
        { path: "icons/icon-512.png", size: 512 },
        { path: "icons/apple-touch-icon.png", size: 180 }
    ];

    expectedIcons.forEach(function (icon) {
        assert.deepEqual(
            readPngDimensions(icon.path),
            { width: icon.size, height: icon.size }
        );
    });

    assert.equal(manifestIcons.get("icons/icon-192.png"), "192x192");
    assert.equal(manifestIcons.get("icons/icon-512.png"), "512x512");
    assert.match(readProjectFile("index.html"), /href="icons\/apple-touch-icon\.png"/);
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
    assert.match(workoutSource, /const canEdit = person === selectedWorkoutIdentity && !isFuture/);
    assert.match(workoutSource, /completeOnly: !completed/);
    assert.match(workoutSource, /completionOrigin: "date-dialog"/);
    assert.match(workoutSource, /settings\.completeOnly && existingResult/);
    assert.match(workoutSource, /Date\.now\(\) - lastWorkoutMutationAt < WORKOUT_TOGGLE_GUARD_MS/);
    assert.match(workoutSource, /renderWorkoutDateDetails\(openWorkoutDateString\)/);
    assert.match(workoutStyles, /button\.workout-date-person\.is-actionable/);
    assert.match(workoutStyles, /\.workout-date-person\.just-completed/);
    assert.match(workoutStyles, /@media \(max-height: 680px\)/);

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
        /if \(newWorkoutSaved\) \{[\s\S]*if \(dateString === today\) \{\s*animateTodayWorkoutCompletion\(\);\s*playWorkoutCompletionSound\(\);\s*\}/
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

    assert.match(serviceWorkerSource, /family-game-night-dashboard-v3\.08/);
    assert.match(serviceWorkerSource, /endsWith\("\/workouts\.html"\)/);
});

test("Ryan is configured across the workout UI, persistence rules, and browser fixture", function () {
    const workoutHtml = readProjectFile("workouts.html");
    const workoutSource = readProjectFile("workouts.js");
    const workoutSchema = readProjectFile("supabase/workout-tracker.sql");
    const workoutFixture = readProjectFile("tests/workout-browser-fixture.html");

    assert.match(
        workoutSource,
        /const WORKOUT_PARTICIPANTS = \["Evan", "Scarlet", "Mom", "Ryan"\]/
    );
    assert.match(workoutHtml, /name="identity" value="Ryan" required> Ryan/);
    assert.match(workoutHtml, /<strong>R<\/strong> Ryan/);
    assert.ok(
        (workoutSchema.match(/'Evan', 'Scarlet', 'Mom', 'Ryan'/g) || []).length >= 3,
        "Ryan is allowed by the table constraint, migration, and insert policy"
    );
    assert.match(
        workoutSchema,
        /drop constraint if exists workout_results_person_check/
    );
    assert.match(workoutFixture, /person: "Ryan"/);
    assert.match(workoutFixture, /name="identity" value="Ryan" required> Ryan/);
    assert.match(workoutFixture, /dataset\.lastPostDate = body\.workout_date/);
    assert.match(workoutFixture, /dataset\.lastPostPerson = body\.person/);
});
