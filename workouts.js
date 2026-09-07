"use strict";

const WORKOUT_IDENTITY_STORAGE_KEY = "workoutTrackerIdentity";
const WORKOUT_PARTICIPANTS = ["Evan", "Scarlet", "Mom"];
const WORKOUT_SUPABASE_REST_URL = "https://hjftnsaabyntyliwgjie.supabase.co/rest/v1";
const WORKOUT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WkyBjvODmxrICShiF_09qw_VNEg-ghY";
const WORKOUT_RESULTS_TABLE = "workout_results";
const workoutUtils = window.WorkoutTrackerUtils;

const workoutElements = {
    calendar: document.querySelector("#workout-calendar"),
    calendarHeading: document.querySelector("#calendar-heading"),
    changeIdentityButton: document.querySelector("#change-workout-identity"),
    content: document.querySelector("#workout-content"),
    feedback: document.querySelector("#workout-feedback"),
    identityCancelButton: document.querySelector("#workout-identity-cancel"),
    identityDialog: document.querySelector("#workout-identity-dialog"),
    identityForm: document.querySelector("#workout-identity-form"),
    identityName: document.querySelector("#workout-identity-name"),
    nextMonthButton: document.querySelector("#next-month"),
    previousMonthButton: document.querySelector("#previous-month"),
    showCurrentMonthButton: document.querySelector("#show-current-month"),
    standings: document.querySelector("#workout-standings"),
    standingsHeading: document.querySelector("#standings-heading"),
    status: document.querySelector("#workout-status"),
    streaks: document.querySelector("#workout-streaks"),
    todayButton: document.querySelector("#today-workout-button")
};

let selectedWorkoutIdentity = getSavedWorkoutIdentity();
let workoutResults = [];
let workoutLoadToken = 0;
let workoutMutationInProgress = false;
const initialMonth = new Date();
let displayedWorkoutYear = initialMonth.getFullYear();
let displayedWorkoutMonth = initialMonth.getMonth();

function createWorkoutElement(tagName, options, children) {
    const settings = options || {};
    const element = document.createElement(tagName);

    if (settings.className) {
        element.className = settings.className;
    }

    if (settings.text !== undefined) {
        element.textContent = String(settings.text);
    }

    Object.entries(settings.attributes || {}).forEach(function (entry) {
        element.setAttribute(entry[0], String(entry[1]));
    });

    (children || []).forEach(function (child) {
        element.appendChild(child);
    });

    return element;
}

function createWorkoutButton(text, className, onClick, attributes) {
    const button = createWorkoutElement("button", {
        className,
        text,
        attributes: Object.assign({ type: "button" }, attributes || {})
    });
    button.addEventListener("click", onClick);
    return button;
}

function getSavedWorkoutIdentity() {
    try {
        const savedIdentity = localStorage.getItem(WORKOUT_IDENTITY_STORAGE_KEY);
        return WORKOUT_PARTICIPANTS.includes(savedIdentity) ? savedIdentity : "";
    } catch (error) {
        console.warn("Could not read the saved Workout Tracker identity.", error);
        return "";
    }
}

function saveWorkoutIdentity(identity) {
    selectedWorkoutIdentity = identity;

    try {
        localStorage.setItem(WORKOUT_IDENTITY_STORAGE_KEY, identity);
    } catch (error) {
        console.warn("Could not remember the Workout Tracker identity on this device.", error);
    }
}

function setWorkoutStatus(message, isError) {
    workoutElements.status.replaceChildren();
    workoutElements.status.classList.toggle("error", Boolean(isError));

    if (message) {
        workoutElements.status.appendChild(createWorkoutElement("span", { text: message }));
    }
}

function setWorkoutFeedback(message, isError) {
    workoutElements.feedback.textContent = message || "";
    workoutElements.feedback.classList.toggle("error", Boolean(isError));
}

function showWorkoutLoadError(message) {
    workoutElements.content.classList.add("hidden");
    setWorkoutStatus(message, true);
    workoutElements.status.appendChild(
        createWorkoutButton("Try Again", "", loadWorkoutResults)
    );
}

function workoutSupabaseHeaders(extraHeaders) {
    return Object.assign({
        apikey: WORKOUT_SUPABASE_PUBLISHABLE_KEY
    }, extraHeaders || {});
}

function workoutQuery(values) {
    const query = new URLSearchParams();

    Object.entries(values).forEach(function (entry) {
        query.set(entry[0], entry[1]);
    });

    return query;
}

async function workoutSupabaseRequest(options) {
    const settings = options || {};
    const query = settings.query ? "?" + settings.query.toString() : "";
    const method = settings.method || "GET";
    const headers = settings.body
        ? workoutSupabaseHeaders({
            "Content-Type": "application/json",
            Prefer: settings.prefer || "return=minimal"
        })
        : workoutSupabaseHeaders();
    const response = await fetch(
        WORKOUT_SUPABASE_REST_URL + "/" + WORKOUT_RESULTS_TABLE + query,
        {
            body: settings.body ? JSON.stringify(settings.body) : undefined,
            headers,
            method
        }
    );

    if (!response.ok) {
        let errorDetails = {};

        try {
            errorDetails = await response.json();
        } catch (error) {
            errorDetails = { message: response.statusText };
        }

        const requestError = new Error(
            String(errorDetails.message || errorDetails.hint || "Supabase request failed")
        );
        requestError.code = errorDetails.code || "";
        requestError.status = response.status;
        throw requestError;
    }

    if (method === "GET" || settings.returnRepresentation) {
        return response.json();
    }

    return null;
}

function normalizeWorkoutResult(row) {
    return {
        created_at: row.created_at || "",
        id: row.id,
        person: row.person,
        workout_date: row.workout_date
    };
}

async function fetchWorkoutResults() {
    const rows = [];
    let offset = 0;
    let page = [];

    do {
        page = await workoutSupabaseRequest({
            query: workoutQuery({
                limit: String(WORKOUT_FETCH_PAGE_SIZE),
                offset: String(offset),
                order: "workout_date.asc,created_at.asc",
                select: "id,workout_date,person,created_at"
            })
        });
        rows.push.apply(rows, page);
        offset += page.length;
    } while (page.length === WORKOUT_FETCH_PAGE_SIZE);

    return rows
        .filter(function (row) {
            return row.id
                && WORKOUT_PARTICIPANTS.includes(row.person)
                && workoutUtils.parseDateOnly(row.workout_date);
        })
        .map(normalizeWorkoutResult);
}

async function insertWorkoutResult(person, workoutDate) {
    const rows = await workoutSupabaseRequest({
        body: {
            person,
            workout_date: workoutDate
        },
        method: "POST",
        prefer: "return=representation",
        returnRepresentation: true
    });

    return rows.length ? normalizeWorkoutResult(rows[0]) : null;
}

function deleteWorkoutResult(result, person) {
    return workoutSupabaseRequest({
        method: "DELETE",
        query: workoutQuery({
            id: "eq." + result.id,
            person: "eq." + person
        })
    });
}

async function loadWorkoutResults() {
    const loadToken = ++workoutLoadToken;
    workoutElements.content.classList.add("hidden");
    setWorkoutStatus("Loading the latest workout activity.");

    try {
        const latestResults = await fetchWorkoutResults();

        if (loadToken !== workoutLoadToken) {
            return;
        }

        workoutResults = latestResults;
        renderWorkoutTracker();
        setWorkoutStatus("");
        workoutElements.content.classList.remove("hidden");
    } catch (error) {
        if (loadToken !== workoutLoadToken) {
            return;
        }

        console.error("Could not load Workout Tracker data.", error);
        showWorkoutLoadError(
            "Workout activity could not be loaded. Check your connection and Supabase setup, then try again."
        );
    }
}

function setWorkoutIdentityUi() {
    workoutElements.identityName.textContent = selectedWorkoutIdentity;
}

function openWorkoutIdentityDialog(isSwitch) {
    workoutElements.identityCancelButton.classList.toggle("hidden", !isSwitch);
    workoutElements.identityDialog
        .querySelectorAll("input[name='identity']")
        .forEach(function (input) {
            input.checked = input.value === selectedWorkoutIdentity;
        });
    workoutElements.identityDialog.showModal();
}

function findWorkoutResult(person, dateString) {
    return workoutResults.find(function (result) {
        return result.person === person && result.workout_date === dateString;
    });
}

function formatWorkoutDate(dateString) {
    const parsed = workoutUtils.parseDateOnly(dateString);

    if (!parsed) {
        return dateString;
    }

    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(parsed.date);
}

function formatWorkoutMonth(year, monthIndex) {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric"
    }).format(new Date(year, monthIndex, 1, 12));
}

function renderTodayWorkout() {
    const today = workoutUtils.getTodayDateString();
    const completedToday = workoutUtils.hasWorkoutForDate(
        workoutResults,
        selectedWorkoutIdentity,
        today
    );

    workoutElements.todayButton.textContent = completedToday
        ? "\u2713 Workout complete! Tap to undo"
        : "\u25CB Complete today's workout";
    workoutElements.todayButton.classList.toggle("is-complete", completedToday);
    workoutElements.todayButton.disabled = workoutMutationInProgress;
    workoutElements.todayButton.setAttribute("aria-pressed", String(completedToday));
}

function renderWorkoutStandings() {
    const monthName = formatWorkoutMonth(displayedWorkoutYear, displayedWorkoutMonth);
    const standings = workoutUtils.getMonthlyStandings(
        workoutResults,
        WORKOUT_PARTICIPANTS,
        displayedWorkoutYear,
        displayedWorkoutMonth
    );

    workoutElements.standingsHeading.textContent = monthName + " Standings";
    workoutElements.standings.replaceChildren(
        createWorkoutElement(
            "div",
            { className: "standings-list" },
            standings.map(function (standing) {
                return createWorkoutElement("div", { className: "standing-row" }, [
                    createWorkoutElement("span", {
                        className: "standing-rank",
                        text: standing.rank
                    }),
                    createWorkoutElement("span", {
                        className: "standing-person",
                        text: standing.person
                    }),
                    createWorkoutElement("span", {
                        className: "standing-count",
                        text: standing.count + (standing.count === 1 ? " day" : " days")
                    })
                ]);
            })
        )
    );
}

function renderWorkoutStreaks() {
    const today = workoutUtils.getTodayDateString();
    const rows = WORKOUT_PARTICIPANTS.map(function (person) {
        const streak = workoutUtils.calculateWorkoutStreak(
            workoutResults,
            person,
            today
        );

        return createWorkoutElement("div", { className: "streak-row" }, [
            createWorkoutElement("span", {
                className: "streak-person",
                text: person
            }),
            createWorkoutElement("span", {
                className: "streak-count",
                text: "\u{1F525} " + streak + (streak === 1 ? " day" : " days")
            })
        ]);
    });

    workoutElements.streaks.replaceChildren(
        createWorkoutElement("div", { className: "streak-list" }, rows)
    );
}

function createParticipantMarker(person, dateString, isFuture) {
    const completed = workoutUtils.hasWorkoutForDate(workoutResults, person, dateString);
    const isSelectedPerson = person === selectedWorkoutIdentity;
    const statusText = completed ? "\u2713" : "\u25CB";
    const className = "participant-marker"
        + (completed ? " is-complete" : "")
        + (isSelectedPerson ? "" : " is-read-only");
    const label = person + (completed ? " completed a workout on " : " did not complete a workout on ")
        + formatWorkoutDate(dateString);
    const children = [
        createWorkoutElement("span", {
            className: "marker-person",
            text: person.charAt(0)
        }),
        createWorkoutElement("span", {
            className: "marker-status",
            text: statusText
        })
    ];

    if (!isSelectedPerson) {
        return createWorkoutElement("span", {
            className,
            attributes: {
                "aria-label": label,
                title: label
            }
        }, children);
    }

    const actionLabel = (completed ? "Remove" : "Add") + " " + person
        + "'s workout for " + formatWorkoutDate(dateString);
    const button = createWorkoutElement("button", {
        className,
        attributes: {
            "aria-label": actionLabel,
            title: actionLabel,
            type: "button"
        }
    }, children);
    button.disabled = isFuture || workoutMutationInProgress;
    button.addEventListener("click", function () {
        toggleWorkoutResult(dateString);
    });
    return button;
}

function renderWorkoutCalendar() {
    const monthLayout = workoutUtils.getMonthLayout(
        displayedWorkoutYear,
        displayedWorkoutMonth
    );
    const today = workoutUtils.getTodayDateString();
    const calendarItems = [];

    workoutElements.calendarHeading.textContent = formatWorkoutMonth(
        displayedWorkoutYear,
        displayedWorkoutMonth
    );

    for (let blankIndex = 0; blankIndex < monthLayout.leadingBlankCount; blankIndex += 1) {
        calendarItems.push(createWorkoutElement("div", {
            className: "calendar-blank",
            attributes: { "aria-hidden": "true" }
        }));
    }

    for (let day = 1; day <= monthLayout.daysInMonth; day += 1) {
        const dateString = workoutUtils.formatDateParts(
            displayedWorkoutYear,
            displayedWorkoutMonth,
            day
        );
        const isFuture = workoutUtils.isFutureDate(dateString, today);
        const className = "calendar-day"
            + (dateString === today ? " is-today" : "")
            + (isFuture ? " is-future" : "");
        const participants = createWorkoutElement(
            "div",
            { className: "participant-list" },
            WORKOUT_PARTICIPANTS.map(function (person) {
                return createParticipantMarker(person, dateString, isFuture);
            })
        );

        calendarItems.push(createWorkoutElement("article", {
            className,
            attributes: {
                "aria-label": formatWorkoutDate(dateString)
            }
        }, [
            createWorkoutElement("span", {
                className: "calendar-date",
                text: day
            }),
            participants
        ]));
    }

    workoutElements.calendar.replaceChildren.apply(
        workoutElements.calendar,
        calendarItems
    );
}

function renderWorkoutTracker() {
    setWorkoutIdentityUi();
    workoutElements.changeIdentityButton.disabled = workoutMutationInProgress;
    renderTodayWorkout();
    renderWorkoutStandings();
    renderWorkoutStreaks();
    renderWorkoutCalendar();
}

function animateTodayWorkoutCompletion() {
    workoutElements.todayButton.classList.remove("just-completed");
    void workoutElements.todayButton.offsetWidth;
    workoutElements.todayButton.classList.add("just-completed");

    window.setTimeout(function () {
        workoutElements.todayButton.classList.remove("just-completed");
    }, 650);
}

async function toggleWorkoutResult(dateString) {
    if (workoutMutationInProgress || !selectedWorkoutIdentity) {
        return;
    }

    const today = workoutUtils.getTodayDateString();

    if (!workoutUtils.parseDateOnly(dateString) || workoutUtils.isFutureDate(dateString, today)) {
        setWorkoutFeedback("Future workout dates cannot be marked complete.", true);
        return;
    }

    const identityAtStart = selectedWorkoutIdentity;
    const existingResult = findWorkoutResult(identityAtStart, dateString);
    let newWorkoutSaved = false;
    workoutMutationInProgress = true;
    setWorkoutFeedback("");
    renderWorkoutTracker();

    try {
        if (existingResult) {
            await deleteWorkoutResult(existingResult, identityAtStart);
            workoutResults = workoutResults.filter(function (result) {
                return result.id !== existingResult.id;
            });
            setWorkoutFeedback("Workout removed for " + formatWorkoutDate(dateString) + ".");
        } else {
            const savedResult = await insertWorkoutResult(identityAtStart, dateString);

            if (savedResult) {
                workoutResults.push(savedResult);
            } else {
                workoutResults = await fetchWorkoutResults();
            }
            newWorkoutSaved = true;

            if (selectedWorkoutIdentity !== identityAtStart) {
                await loadWorkoutResults();
                return;
            }

            const streak = workoutUtils.calculateWorkoutStreak(
                workoutResults,
                identityAtStart,
                today
            );
            const successMessage = dateString === today
                ? "Nice \u2014 " + streak + (streak === 1 ? " day streak!" : " day streak! \u{1F525}")
                : "Workout added for " + formatWorkoutDate(dateString) + ".";
            setWorkoutFeedback(successMessage);
        }

        workoutLoadToken += 1;
        setWorkoutStatus("");
    } catch (error) {
        console.error("Workout Tracker mutation failed.", error);

        if (!existingResult && error.code === "23505") {
            try {
                workoutResults = await fetchWorkoutResults();
                setWorkoutFeedback("That workout was already on the calendar.");
            } catch (reloadError) {
                console.error("Could not reload after duplicate workout.", reloadError);
                showWorkoutLoadError("The workout already exists, but the calendar could not be reloaded.");
            }
        } else {
            setWorkoutFeedback(
                "That change could not be saved. Check your connection and try again.",
                true
            );
        }
    } finally {
        workoutMutationInProgress = false;

        if (!workoutElements.content.classList.contains("hidden")) {
            renderWorkoutTracker();

            if (newWorkoutSaved && dateString === today) {
                animateTodayWorkoutCompletion();
            }
        }
    }
}

function changeDisplayedWorkoutMonth(amount) {
    const changedMonth = new Date(
        displayedWorkoutYear,
        displayedWorkoutMonth + amount,
        1,
        12
    );
    displayedWorkoutYear = changedMonth.getFullYear();
    displayedWorkoutMonth = changedMonth.getMonth();
    renderWorkoutStandings();
    renderWorkoutCalendar();
}

workoutElements.identityForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const identity = new FormData(workoutElements.identityForm).get("identity");

    if (!WORKOUT_PARTICIPANTS.includes(identity)) {
        return;
    }

    saveWorkoutIdentity(identity);
    setWorkoutIdentityUi();
    workoutElements.identityDialog.close();
    loadWorkoutResults();
});

workoutElements.identityCancelButton.addEventListener("click", function () {
    if (selectedWorkoutIdentity) {
        workoutElements.identityDialog.close();
    }
});

workoutElements.identityDialog.addEventListener("cancel", function (event) {
    if (!selectedWorkoutIdentity) {
        event.preventDefault();
    }
});

workoutElements.identityDialog.addEventListener("close", function () {
    if (!selectedWorkoutIdentity) {
        queueMicrotask(function () {
            openWorkoutIdentityDialog(false);
        });
    }
});

workoutElements.changeIdentityButton.addEventListener("click", function () {
    openWorkoutIdentityDialog(true);
});

workoutElements.todayButton.addEventListener("click", function () {
    toggleWorkoutResult(workoutUtils.getTodayDateString());
});

workoutElements.previousMonthButton.addEventListener("click", function () {
    changeDisplayedWorkoutMonth(-1);
});

workoutElements.nextMonthButton.addEventListener("click", function () {
    changeDisplayedWorkoutMonth(1);
});

workoutElements.showCurrentMonthButton.addEventListener("click", function () {
    const today = new Date();
    displayedWorkoutYear = today.getFullYear();
    displayedWorkoutMonth = today.getMonth();
    renderWorkoutStandings();
    renderWorkoutCalendar();
});

setWorkoutIdentityUi();

if (selectedWorkoutIdentity) {
    loadWorkoutResults();
} else {
    setWorkoutStatus("Choose your name to start tracking workouts.");
    openWorkoutIdentityDialog(false);
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function (error) {
            console.error("Service worker registration failed:", error);
        });
    });
}
const WORKOUT_FETCH_PAGE_SIZE = 500;
