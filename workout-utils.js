(function (root, factory) {
    const workoutUtils = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = workoutUtils;
    }

    if (root) {
        root.WorkoutTrackerUtils = workoutUtils;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function padNumber(value) {
        return String(value).padStart(2, "0");
    }

    function formatDateParts(year, monthIndex, day) {
        return String(year) + "-" + padNumber(monthIndex + 1) + "-" + padNumber(day);
    }

    function parseDateOnly(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));

        if (!match) {
            return null;
        }

        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        const date = new Date(year, monthIndex, day, 12);

        if (
            year < 1000
            || date.getFullYear() !== year
            || date.getMonth() !== monthIndex
            || date.getDate() !== day
        ) {
            return null;
        }

        return {
            date,
            day,
            monthIndex,
            year
        };
    }

    function getTodayDateString(referenceDate) {
        const today = referenceDate instanceof Date ? referenceDate : new Date();
        return formatDateParts(today.getFullYear(), today.getMonth(), today.getDate());
    }

    function addDays(dateString, amount) {
        const parsed = parseDateOnly(dateString);

        if (!parsed || !Number.isInteger(amount)) {
            return "";
        }

        parsed.date.setDate(parsed.date.getDate() + amount);
        return formatDateParts(
            parsed.date.getFullYear(),
            parsed.date.getMonth(),
            parsed.date.getDate()
        );
    }

    function recordDate(record) {
        return String(record && (record.workout_date || record.date) || "");
    }

    function getWorkoutDateSet(results, person) {
        const dates = new Set();

        (Array.isArray(results) ? results : []).forEach(function (result) {
            const date = recordDate(result);

            if (result && result.person === person && parseDateOnly(date)) {
                dates.add(date);
            }
        });

        return dates;
    }

    function hasWorkoutForDate(results, person, dateString) {
        return getWorkoutDateSet(results, person).has(dateString);
    }

    function getMonthlyStandings(results, people, year, monthIndex) {
        const monthPrefix = String(year) + "-" + padNumber(monthIndex + 1) + "-";
        const configuredPeople = Array.isArray(people) ? people : [];
        const rows = configuredPeople.map(function (person, displayIndex) {
            const matchingDates = getWorkoutDateSet(results, person);
            let count = 0;

            matchingDates.forEach(function (date) {
                if (date.startsWith(monthPrefix)) {
                    count += 1;
                }
            });

            return {
                count,
                displayIndex,
                person
            };
        });

        rows.sort(function (first, second) {
            return second.count - first.count || first.displayIndex - second.displayIndex;
        });

        let previousCount = null;
        let previousRank = 0;

        return rows.map(function (row, index) {
            const rank = row.count === previousCount ? previousRank : index + 1;
            previousCount = row.count;
            previousRank = rank;

            return {
                count: row.count,
                person: row.person,
                rank
            };
        });
    }

    function calculateWorkoutStreak(results, person, todayDateString) {
        const workoutDates = getWorkoutDateSet(results, person);
        const today = parseDateOnly(todayDateString);

        if (!today) {
            return 0;
        }

        let cursor = workoutDates.has(todayDateString)
            ? todayDateString
            : addDays(todayDateString, -1);
        let streak = 0;

        while (cursor && workoutDates.has(cursor)) {
            streak += 1;
            cursor = addDays(cursor, -1);
        }

        return streak;
    }

    function getMonthLayout(year, monthIndex) {
        const firstDay = new Date(year, monthIndex, 1, 12);
        const lastDay = new Date(year, monthIndex + 1, 0, 12);

        return {
            daysInMonth: lastDay.getDate(),
            leadingBlankCount: firstDay.getDay()
        };
    }

    function isFutureDate(dateString, todayDateString) {
        return Boolean(parseDateOnly(dateString))
            && Boolean(parseDateOnly(todayDateString))
            && dateString > todayDateString;
    }

    return {
        addDays,
        calculateWorkoutStreak,
        formatDateParts,
        getMonthLayout,
        getMonthlyStandings,
        getTodayDateString,
        getWorkoutDateSet,
        hasWorkoutForDate,
        isFutureDate,
        parseDateOnly
    };
});
