////////////////////////////// 1. Page Elements //////////////////////////////
const gameForm = document.querySelector("#game-form");
const gameLog = document.querySelector("#game-log");
const stats = document.querySelector("#stats");
const gameDateInput = document.querySelector("#game-date");
const gameNameSelect = document.querySelector("#game-name");
const winnerNameSelect = document.querySelector("#winner-name");
const exportJsonButton = document.querySelector("#export-json-button");
const importJsonInput = document.querySelector("#import-json-input");
const importJsonButton = document.querySelector("#import-json-button");
const resetDataButton = document.querySelector("#reset-data-button");
const customGameWrapper = document.querySelector("#custom-game-wrapper");
const customGameNameInput = document.querySelector("#custom-game-name");
const CUSTOM_GAME_VALUE = "__custom_game__";

/////////////////////////////// 2. App data //////////////////////////////////
const STORAGE_KEY = "gameResults";
const DATA_EXPORT_VERSION = 1;

const SUPABASE_REST_URL = "https://hjftnsaabyntyliwgjie.supabase.co/rest/v1";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WkyBjvODmxrICShiF_09qw_VNEg-ghY";
const SUPABASE_GAME_RESULTS_TABLE_URL = `${SUPABASE_REST_URL}/game_results`;

const DEFAULT_GAMES = [
    "Contract Whist (Heck No)",
    "Crazy Eights",
    "Farkle",
    "German Whist",
    "Go Fish",
    "Hearts",
    "Jik Jak",
    "Monopoly Board Game",
    "Monopoly Card Game",
    "Old Maid",
    "Scattergories",
    "Sorry!"
];

const DEFAULT_PLAYERS = [
    "Evan",
    "Mom",
    "Ryan",
    "Scarlet",
    "Brina"
];

//////////////////////////////////// 3. Helpers ///////////////////////////////

function getResolvedGameName(formValues) {
    if (formValues.gameName === CUSTOM_GAME_VALUE) {
        return formValues.customGameName;
    }

    return formValues.gameName;
}

function handleGameSelectionChange() {
    if (!gameNameSelect || !customGameWrapper || !customGameNameInput) {
        return;
    }

    const isCustomGame = gameNameSelect.value === CUSTOM_GAME_VALUE;

    customGameWrapper.classList.toggle("hidden", !isCustomGame);
    customGameNameInput.required = isCustomGame;

    if (!isCustomGame) {
        customGameNameInput.value = "";
    }
}

function buildGameResultsBackup() {
    return {
        app: "family-game-night-dashboard",
        version: DATA_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        results: gameResults,
    };
}

function downloadJSONFile(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    URL.revokeObjectURL(url);
}

function exportGameResultsBackup() {
    const backup = buildGameResultsBackup();
    const fileDate = getTodayDateString();

    downloadJSONFile(
        backup,
        `family-game-night-backup-${fileDate}.json`
    );
}

function getGameResultFormData() {
    const formData = new FormData(gameForm);

    return {
        gameDate: formData.get("gameDate"),
        gameName: formData.get("gameName"),
        customGameName: String(formData.get("customGameName") || "").trim(),
        winnerName: formData.get("winnerName"),
        gameNote: formData.get("gameNote").trim()
    };
}

function addGameResult(gameResult) {
    gameResults.push(gameResult);
}

function deleteGameResultById(idToDelete) {
    const indexToDelete = gameResults.findIndex(function (result) {
        return result.id === idToDelete;
    });

    if (indexToDelete === -1) {
        return false;
    }

    gameResults.splice(indexToDelete, 1);
    return true;
}

function replaceGameResults(importedResults) {
    gameResults.splice(
        0,
        gameResults.length,
        ...importedResults.map(normalizeGameResult)
    );
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderGameOptions() {
    if (!gameNameSelect) {
        return;
    }

    gameNameSelect.innerHTML = buildSelectOptionsHTML(DEFAULT_GAMES, "Select Game");

    const customOption = document.createElement("option");
    customOption.value = CUSTOM_GAME_VALUE;
    customOption.textContent = "Other / Custom Game";
    gameNameSelect.appendChild(customOption);
}

function renderWinnerOptions() {
    if (!winnerNameSelect) {
        return;
    }

    winnerNameSelect.innerHTML = buildSelectOptionsHTML(DEFAULT_PLAYERS, "Select Winner");
}

function renderDropdownOptions() {
    renderGameOptions();
    renderWinnerOptions();
}

function buildSelectOptionsHTML(options, placeholderText) {
    const placeholderOption = `<option value="">${escapeHTML(placeholderText)}</option>`;

    const optionsHTML = options
        .map(function (option) {
            return `<option value="${escapeHTML(option)}">${escapeHTML(option)}</option>`;
        })
        .join("");

    return placeholderOption + optionsHTML;
}

function buildStatCardHTML(title, value) {
    return `
        <article class="stat-card">
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(value)}</p>
        </article>
    `;
}

function buildGameResultHTML(result) {
    return `
        <article class="game-result">
            <div class="game-result-header">
                <h3>${escapeHTML(result.game)}</h3>
                <button type="button" class="delete-button" data-id="${escapeHTML(result.id)}">
                    Delete
                </button>
            </div>

            <div class="game-result-details">
                <p><strong>Date:</strong> ${escapeHTML(result.date)}</p>
                <p><strong>Winner:</strong> ${escapeHTML(result.winner)}</p>
                ${result.note ? `<p class="game-note"><strong>Note:</strong> ${escapeHTML(result.note)}</p>` : ""}
            </div>
        </article>
    `;
}

function getRecentWinner(results) {
    if (results.length === 0) {
        return "None yet";
    }

    return results[results.length - 1].winner;
}

function buildWinsByPlayerHTML(winnerCounts) {
    const winnerNames = Object.keys(winnerCounts);

    if (winnerNames.length === 0) {
        return "<p>No wins logged yet.</p>";
    }

    return winnerNames
        .map(function (winnerName) {
            return `<p>${escapeHTML(winnerName)}: ${escapeHTML(winnerCounts[winnerName])} wins</p>`;
        })
        .join("");
}

function findHighestCount(counts, fallbackLabel) {
    let highestLabel = fallbackLabel;
    let highestCount = 0;

    for (const label in counts) {
        if (counts[label] > highestCount) {
            highestLabel = label;
            highestCount = counts[label];
        }
    }

    return {
        label: highestLabel,
        count: highestCount
    };
}

function countByProperty(results, propertyName) {
    const counts = {};

    results.forEach(function (result) {
        const propertyValue = result[propertyName];

        if (counts[propertyValue]) {
            counts[propertyValue] += 1;
        } else {
            counts[propertyValue] = 1;
        }
    });

    return counts;
}

function saveGameResults() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameResults));
    } catch (error) {
        console.error("Dawg, The Game Results could not be saved.", error);
        alert("Dawg, Game result could not be saved. Your browser storage may be unavailable or full.");
    }
}

function generateGameResultId() {
    return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createGameResult(date, game, winner, note) {
    return {
        id: generateGameResultId(),
        date,
        game,
        winner,
        note,
        createdAt: new Date().toISOString()
    };
}

function normalizeGameResult(result, index = 0) {
    return {
        id: result.id || `game-migrated-${Date.now()}-${index}`,
        date: result.date,
        game: result.game,
        winner: result.winner,
        note: result.note || "",
        createdAt: result.createdAt || new Date().toISOString()
    };
}

function loadGameResults() {
    const savedGameResults = localStorage.getItem(STORAGE_KEY);

    if (!savedGameResults) {
        return [];
    }

    try {
        const parsedResults = JSON.parse(savedGameResults);

        if (!Array.isArray(parsedResults)) {
            return [];
        }

        return parsedResults.map(normalizeGameResult);
    } catch (error) {
        console.error("Could not load saved game results:", error);
        return [];
    }
}

function getSupabaseHeaders(extraHeaders = {}) {
    return {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        ...extraHeaders
    };
}

function mapSupabaseRowToGameResult(row) {
    return {
        id: row.id,
        date: row.played_date,
        game: row.game,
        winner: row.winner,
        note: row.note || "",
        createdAt: row.created_at,
        createdBy: row.created_by || ""
    };
}

function mapGameResultToSupabaseRow(result) {
    return {
        game: result.game,
        winner: result.winner,
        played_date: result.date,
        note: result.note || "",
        created_by: result.createdBy || ""
    };
}

async function getSupabaseErrorMessage(response) {
    try {
        const errorData = await response.json();
        return `${response.status} ${response.statusText}: ${JSON.stringify(errorData)}`;
    } catch (error) {
        return `${response.status} ${response.statusText}`;
    }
}

async function fetchSharedGameResults() {
    const selectedColumns = "id,game,winner,played_date,note,created_at,created_by";
    const url = `${SUPABASE_GAME_RESULTS_TABLE_URL}?select=${selectedColumns}&order=created_at.asc`;

    const response = await fetch(url, {
        headers: getSupabaseHeaders()
    });

    if (!response.ok) {
        throw new Error(await getSupabaseErrorMessage(response));
    }

    const rows = await response.json();
    return rows.map(mapSupabaseRowToGameResult);
}

async function loadSharedGameResults() {
    try {
        const sharedGameResults = await fetchSharedGameResults();

        replaceGameResults(sharedGameResults);
        saveGameResults();
        renderApp();
    } catch (error) {
        console.error("Could not load shared game results:", error);
        renderApp();
        alert("Shared game results could not be loaded. Showing this device's last saved copy if one exists.");
    }
}

async function insertSharedGameResult(gameResult) {
    const response = await fetch(SUPABASE_GAME_RESULTS_TABLE_URL, {
        method: "POST",
        headers: getSupabaseHeaders({
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        }),
        body: JSON.stringify(mapGameResultToSupabaseRow(gameResult))
    });

    if (!response.ok) {
        throw new Error(await getSupabaseErrorMessage(response));
    }
}

async function deleteSharedGameResultById(idToDelete) {
    const encodedId = encodeURIComponent(idToDelete);
    const response = await fetch(`${SUPABASE_GAME_RESULTS_TABLE_URL}?id=eq.${encodedId}`, {
        method: "DELETE",
        headers: getSupabaseHeaders({
            Prefer: "return=minimal"
        })
    });

    if (!response.ok) {
        throw new Error(await getSupabaseErrorMessage(response));
    }
}

async function deleteAllSharedGameResults() {
    const response = await fetch(`${SUPABASE_GAME_RESULTS_TABLE_URL}?id=not.is.null`, {
        method: "DELETE",
        headers: getSupabaseHeaders({
            Prefer: "return=minimal"
        })
    });

    if (!response.ok) {
        throw new Error(await getSupabaseErrorMessage(response));
    }
}

async function replaceSharedGameResults(importedResults) {
    const normalizedResults = importedResults.map(normalizeGameResult);
    const rows = normalizedResults.map(mapGameResultToSupabaseRow);

    await deleteAllSharedGameResults();

    if (rows.length === 0) {
        return;
    }

    const response = await fetch(SUPABASE_GAME_RESULTS_TABLE_URL, {
        method: "POST",
        headers: getSupabaseHeaders({
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        }),
        body: JSON.stringify(rows)
    });

    if (!response.ok) {
        throw new Error(await getSupabaseErrorMessage(response));
    }
}

const gameResults = loadGameResults();

function renderApp() {
    renderGameLog();
    renderStats();
}

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
}

function setDefaultGameDate() {
    if (!gameDateInput) {
        return;
    }

    gameDateInput.value = getTodayDateString();
}

function handleImportButtonClick() {
    const selectedFile = importJsonInput.files[0];

    if (!selectedFile) {
        alert("Please choose a JSON backup file first.");
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", async () => {
        let backupData;

        try {
            backupData = JSON.parse(reader.result);
        } catch (error) {
            console.error("Import parse error:", error);
            alert("That file could not be read as valid JSON.");
            return;
        }

        if (!isValidBackupData(backupData)) {
            alert("That JSON file does not look like a valid Family Game Night backup.");
            return;
        }

        const shouldImport = confirm(
            "Importing this backup will replace the shared game results for everyone. Continue?"
        );

        if (!shouldImport) {
            return;
        }

        try {
            await replaceSharedGameResults(backupData.results);
            await loadSharedGameResults();

            importJsonInput.value = "";

            alert("Backup imported successfully into the shared database.");
        } catch (error) {
            console.error("Import save error:", error);
            alert("That backup could not be imported into the shared database.");
        }
    });

    reader.addEventListener("error", () => {
        console.error("File read error:", reader.error);
        alert("There was a problem reading that file.");
    });

    reader.readAsText(selectedFile);
}

function isValidBackupData(backupData) {
    if (!backupData || typeof backupData !== "object") {
        return false;
    }

    if (backupData.app !== "family-game-night-dashboard") {
        return false;
    }

    if (backupData.version !== DATA_EXPORT_VERSION) {
        return false;
    }

    if (!Array.isArray(backupData.results)) {
        return false;
    }

    return true;
}

function resetGameResults() {
    gameResults.splice(0, gameResults.length);
}

async function handleResetDataButtonClick() {
    const confirmedReset = confirm(
        "This will permanently delete all shared game results for everyone. Export a backup first if you want to keep them. Continue?"
    );

    if (!confirmedReset) {
        return;
    }

    try {
        await deleteAllSharedGameResults();
        resetGameResults();
        saveGameResults();
        renderApp();

        alert("All shared game results have been reset.");
    } catch (error) {
        console.error("Reset shared data error:", error);
        alert("Shared game results could not be reset.");
    }
}

////////////////////////// 4. Render Functions ///////////////////////////////

function isValidGameResultFormData(formValues) {
    const resolvedGameName = getResolvedGameName(formValues);

    return (
        formValues.gameDate &&
        resolvedGameName &&
        formValues.winnerName
    );
}

function renderGameLog() {
    gameLog.innerHTML = "";

    if (gameResults.length === 0) {
        gameLog.innerHTML = "<p>No games logged yet.</p>";
        return;
    }

    const gameLogHTML = [...gameResults]
        .reverse()
        .map(function (result) {
            return buildGameResultHTML(result);
        })
        .join("");

    gameLog.innerHTML = gameLogHTML;
}

function renderStats() {
    const totalGames = gameResults.length;

    const recentWinner = getRecentWinner(gameResults);

    const gameCounts = countByProperty(gameResults, "game");

    const mostPlayed = findHighestCount(gameCounts, "None yet");

    const winnerCounts = countByProperty(gameResults, "winner");

    const topWinner = findHighestCount(winnerCounts, "None yet");

    const winsByPlayerHTML = buildWinsByPlayerHTML(winnerCounts);

    stats.innerHTML = `
    <div class="stats-grid">
        ${buildStatCardHTML("Total Games", totalGames)}
        ${buildStatCardHTML("Recent Winner", recentWinner)}
        ${buildStatCardHTML("Most Played Game", mostPlayed.label)}
        ${buildStatCardHTML("Most Wins", `${topWinner.label} (${topWinner.count})`)}
    </div>

    <div class="wins-by-player">
        <h3>Wins by Player</h3>
        ${winsByPlayerHTML}
    </div>
`;
}

//5. Initial Setup
renderDropdownOptions();

if (gameNameSelect) {
    gameNameSelect.value = "";
}

handleGameSelectionChange();

renderApp();
setDefaultGameDate();
loadSharedGameResults();


//6. Event Listeners
gameForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formValues = getGameResultFormData();

    if (!isValidGameResultFormData(formValues)) {
        alert("Please choose a date, game, and winner before adding a result.");
        return;
    }

    const resolvedGameName = getResolvedGameName(formValues);

    const gameResult = createGameResult(
        formValues.gameDate,
        resolvedGameName,
        formValues.winnerName,
        formValues.gameNote
    );

    try {
        await insertSharedGameResult(gameResult);
        await loadSharedGameResults();

        gameForm.reset();

        if (gameNameSelect) {
            gameNameSelect.value = "";
        }

        handleGameSelectionChange();
        setDefaultGameDate();
    } catch (error) {
        console.error("Could not add shared game result:", error);
        alert("Game result could not be added to the shared database.");
    }
});

gameLog.addEventListener("click", async function (event) {
    if (!event.target.classList.contains("delete-button")) {
        return;
    }

    const idToDelete = event.target.dataset.id;

    const confirmedDelete = confirm("ARE YOU FOR REAL GOING TO DELETE THIS FROM THE SHARED DATABASE?");

    if (!confirmedDelete) {
        return;
    }

    try {
        await deleteSharedGameResultById(idToDelete);
        await loadSharedGameResults();
    } catch (error) {
        console.error("Could not delete shared game result:", error);
        alert("Game result could not be deleted from the shared database.");
    }
});

exportJsonButton.addEventListener("click", exportGameResultsBackup);

importJsonButton.addEventListener("click", handleImportButtonClick);

resetDataButton.addEventListener("click", handleResetDataButtonClick);

//////////////////////// 7. Service Worker Registration ///////////////////////

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function (error) {
            console.error("Service worker registration failed:", error);
        });
    });
}

if (gameNameSelect) {
    gameNameSelect.addEventListener("change", handleGameSelectionChange);
}
