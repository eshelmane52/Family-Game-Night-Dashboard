const test = require("node:test");
const assert = require("node:assert/strict");
const workoutUtils = require("../workout-utils.js");

function result(person, workoutDate, id) {
    return {
        id: id || person + "-" + workoutDate,
        person,
        workout_date: workoutDate
    };
}

test("date-only helpers validate real calendar dates without UTC conversion", function () {
    assert.deepEqual(
        workoutUtils.parseDateOnly("2028-02-29").day,
        29
    );
    assert.equal(workoutUtils.parseDateOnly("2027-02-29"), null);
    assert.equal(workoutUtils.parseDateOnly("09/06/2026"), null);
    assert.equal(workoutUtils.addDays("2026-09-01", -1), "2026-08-31");
    assert.equal(workoutUtils.addDays("2028-02-28", 1), "2028-02-29");
});

test("today uses the supplied local date fields", function () {
    const localDate = new Date(2026, 8, 6, 23, 30);
    assert.equal(workoutUtils.getTodayDateString(localDate), "2026-09-06");
});

test("a workout completed today creates a one-day streak", function () {
    const results = [result("Evan", "2026-09-06")];
    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Evan", "2026-09-06"),
        1
    );
});

test("yesterday remains an active streak before today's workout", function () {
    const results = [
        result("Scarlet", "2026-09-03"),
        result("Scarlet", "2026-09-04"),
        result("Scarlet", "2026-09-05")
    ];

    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Scarlet", "2026-09-06"),
        3
    );
});

test("today extends a streak through yesterday", function () {
    const results = [
        result("Mom", "2026-09-03"),
        result("Mom", "2026-09-04"),
        result("Mom", "2026-09-05"),
        result("Mom", "2026-09-06")
    ];

    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Mom", "2026-09-06"),
        4
    );
});

test("a missing day breaks the current streak", function () {
    const results = [
        result("Evan", "2026-09-02"),
        result("Evan", "2026-09-03"),
        result("Evan", "2026-09-05")
    ];

    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Evan", "2026-09-06"),
        1
    );
    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Evan", "2026-09-07"),
        0
    );
});

test("streaks cross month and year boundaries", function () {
    const results = [
        result("Scarlet", "2026-12-30"),
        result("Scarlet", "2026-12-31"),
        result("Scarlet", "2027-01-01")
    ];

    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Scarlet", "2027-01-02"),
        3
    );
});

test("duplicate rows never inflate a streak", function () {
    const results = [
        result("Mom", "2026-09-05", "one"),
        result("Mom", "2026-09-05", "duplicate"),
        result("Mom", "2026-09-06", "two")
    ];

    assert.equal(
        workoutUtils.calculateWorkoutStreak(results, "Mom", "2026-09-06"),
        2
    );
});

test("monthly standings count unique dates only in the selected month", function () {
    const results = [
        result("Evan", "2026-08-31"),
        result("Evan", "2026-09-01", "evan-one"),
        result("Evan", "2026-09-01", "evan-duplicate"),
        result("Evan", "2026-09-02"),
        result("Scarlet", "2026-09-03"),
        result("Mom", "2026-10-01")
    ];

    assert.deepEqual(
        workoutUtils.getMonthlyStandings(
            results,
            ["Evan", "Scarlet", "Mom"],
            2026,
            8
        ),
        [
            { count: 2, person: "Evan", rank: 1 },
            { count: 1, person: "Scarlet", rank: 2 },
            { count: 0, person: "Mom", rank: 3 }
        ]
    );
});

test("tied monthly totals share a rank and keep configured order", function () {
    const results = [
        result("Evan", "2026-09-01"),
        result("Scarlet", "2026-09-02")
    ];

    assert.deepEqual(
        workoutUtils.getMonthlyStandings(
            results,
            ["Evan", "Scarlet", "Mom"],
            2026,
            8
        ),
        [
            { count: 1, person: "Evan", rank: 1 },
            { count: 1, person: "Scarlet", rank: 1 },
            { count: 0, person: "Mom", rank: 3 }
        ]
    );
});

test("month layout handles Sunday starts and leap years", function () {
    assert.deepEqual(
        workoutUtils.getMonthLayout(2026, 10),
        { daysInMonth: 30, leadingBlankCount: 0 }
    );
    assert.deepEqual(
        workoutUtils.getMonthLayout(2028, 1),
        { daysInMonth: 29, leadingBlankCount: 2 }
    );
});

test("future-date checks compare validated normalized dates", function () {
    assert.equal(workoutUtils.isFutureDate("2026-09-07", "2026-09-06"), true);
    assert.equal(workoutUtils.isFutureDate("2026-09-06", "2026-09-06"), false);
    assert.equal(workoutUtils.isFutureDate("invalid", "2026-09-06"), false);
});
