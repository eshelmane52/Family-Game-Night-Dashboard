
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

/////////////////////////////// 2. App data //////////////////////////////////
const STORAGE_KEY = "gameResults";
const DATA_EXPORT_VERSION = 1;

const DEFAULT_GAMES = [
    "Hearts",
    "Farkle",
    "German Whist",
    "Contract Whist (Heck No)",
    "Monopoly Board Game",
    "Monopoly Card Game",
    "Sorry!",
    "Old Maid",
    "Jik Jak",
    "Crazy Eights",
    "Go Fish"
];

const DEFAULT_PLAYERS = [
    "Evan",
    "Mom",
    "Ryan",
    "Scarlet",
    "Brina"
];

//////////////////////////////////// 3. Helpers ///////////////////////////////

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

function normalizeGameResult(result, index) {
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

    reader.addEventListener("load", () => {
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
            "Importing this backup will replace your current game results. Continue?"
        );

        if (!shouldImport) {
            return;
        }

        replaceGameResults(backupData.results);
        saveGameResults();
        renderApp();

        importJsonInput.value = "";

        alert("Backup imported successfully.");
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

function handleResetDataButtonClick() {
    const confirmedReset = confirm(
        "This will permanently delete all saved game results from this browser. Export a backup first if you want to keep them. Continue?"
    );

    if (!confirmedReset) {
        return;
    }

    resetGameResults();
    saveGameResults();
    renderApp();

    alert("All game results have been reset.");
}

////////////////////////// 4. Render Functions ///////////////////////////////

function isValidGameResultFormData(formValues) {
    return (
        formValues.gameDate &&
        formValues.gameName &&
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
renderApp();
setDefaultGameDate();


//6. Event Listeners
gameForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const formValues = getGameResultFormData();

    if (!isValidGameResultFormData(formValues)) {
        alert("Please choose a date, game, and winner before adding a result.");
        return;
    }

    const gameResult = createGameResult(
        formValues.gameDate,
        formValues.gameName,
        formValues.winnerName,
        formValues.gameNote
    );

    addGameResult(gameResult);
    saveGameResults();
    renderApp();
    gameForm.reset();
    setDefaultGameDate();
});

gameLog.addEventListener("click", function (event) {
    if (!event.target.classList.contains("delete-button")) {
        return;
    }

    const idToDelete = event.target.dataset.id;

    const confirmedDelete = confirm("ARE YOU FOR REAL GOING TO DELETE THIS?");

    if (!confirmedDelete) {
        return;
    }

    const deleted = deleteGameResultById(idToDelete);

    if (!deleted) {
        return;
    }

    saveGameResults();
    renderApp();
});

exportJsonButton.addEventListener("click", exportGameResultsBackup);

importJsonButton.addEventListener("click", handleImportButtonClick);

resetDataButton.addEventListener("click", handleResetDataButtonClick);

