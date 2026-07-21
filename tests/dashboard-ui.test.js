const test = require("node:test");
const assert = require("node:assert/strict");
const dashboardUI = require("../dashboard-ui.js");

test("win percentages are relative to the current leader", function () {
    assert.equal(dashboardUI.calculateWinPercentage(10, 10), 100);
    assert.equal(dashboardUI.calculateWinPercentage(1, 10), 10);
    assert.equal(dashboardUI.calculateWinPercentage(3, 4), 75);
});

test("tied leaders all receive a full bar", function () {
    const counts = { Evan: 7, Scarlet: 7, Ryan: 2 };
    const highestWins = dashboardUI.getHighestWinCount(counts);

    assert.equal(highestWins, 7);
    assert.equal(dashboardUI.calculateWinPercentage(counts.Evan, highestWins), 100);
    assert.equal(dashboardUI.calculateWinPercentage(counts.Scarlet, highestWins), 100);
});

test("zero-win and all-zero states remain safe", function () {
    const allZeroCounts = { Evan: 0, Scarlet: 0 };

    assert.equal(dashboardUI.getHighestWinCount(allZeroCounts), 0);
    assert.equal(dashboardUI.calculateWinPercentage(0, 0), 0);
    assert.equal(dashboardUI.calculateWinPercentage(0, 5), 0);
    assert.equal(dashboardUI.calculateWinPercentage(5, 0), 0);
});

test("win labels use the correct singular and plural forms", function () {
    assert.equal(dashboardUI.formatWinCount(0), "0 Wins");
    assert.equal(dashboardUI.formatWinCount(1), "1 Win");
    assert.equal(dashboardUI.formatWinCount(2), "2 Wins");
});

test("celebration triggers once for valid submissions and never for invalid submissions", function () {
    let celebrationCount = 0;
    const celebrate = function () {
        celebrationCount += 1;
    };

    assert.equal(dashboardUI.triggerCelebrationForSubmission(false, celebrate), false);
    assert.equal(celebrationCount, 0);
    assert.equal(dashboardUI.triggerCelebrationForSubmission(true, celebrate), true);
    assert.equal(celebrationCount, 1);
});

test("celebration failures do not block a valid submission", function () {
    assert.equal(
        dashboardUI.triggerCelebrationForSubmission(true, function () {
            throw new Error("animation unavailable");
        }),
        true
    );
});

test("Rules dismissal hides the section for the current page instance", function () {
    const rulesSection = { hidden: false };
    let clickHandler = null;
    const closeButton = {
        addEventListener: function (eventName, handler) {
            assert.equal(eventName, "click");
            clickHandler = handler;
        }
    };

    assert.equal(dashboardUI.setupRulesDismissal(rulesSection, closeButton), true);
    assert.equal(rulesSection.hidden, false);
    clickHandler();
    assert.equal(rulesSection.hidden, true);
});


test("repeated celebrations restart audio and replace the active confetti layer", function () {
    const canvases = [];
    const animationFrames = new Map();
    const timeouts = new Map();
    const audioInstances = [];
    let nextAnimationFrameId = 1;
    let nextTimeoutId = 1;

    class FakeAudio {
        constructor(source) {
            this.source = source;
            this.currentTime = 4;
            this.pauseCount = 0;
            this.playCount = 0;
            audioInstances.push(this);
        }

        pause() {
            this.pauseCount += 1;
        }

        play() {
            this.playCount += 1;
            return Promise.resolve();
        }
    }

    const fakeContext = {
        clearRect() {},
        fillRect() {},
        restore() {},
        rotate() {},
        save() {},
        setTransform() {},
        translate() {}
    };
    const fakeDocument = {
        body: {
            appendChild(canvas) {
                canvases.push(canvas);
            }
        },
        createElement(tagName) {
            assert.equal(tagName, "canvas");

            return {
                classList: {
                    add(className) {
                        this.lastAdded = className;
                    }
                },
                getContext() {
                    return fakeContext;
                },
                remove() {
                    this.removed = true;
                },
                setAttribute() {},
                style: {
                    setProperty() {}
                }
            };
        }
    };
    const fakeWindow = {
        Audio: FakeAudio,
        cancelAnimationFrame(id) {
            animationFrames.delete(id);
        },
        clearTimeout(id) {
            timeouts.delete(id);
        },
        devicePixelRatio: 1,
        innerHeight: 800,
        innerWidth: 390,
        matchMedia() {
            return { matches: false };
        },
        requestAnimationFrame(callback) {
            const id = nextAnimationFrameId;
            nextAnimationFrameId += 1;
            animationFrames.set(id, callback);
            return id;
        },
        setTimeout(callback) {
            const id = nextTimeoutId;
            nextTimeoutId += 1;
            timeouts.set(id, callback);
            return id;
        }
    };
    const controller = dashboardUI.createCelebrationController({
        Audio: FakeAudio,
        audioSource: "assets/audio/victory.mp3",
        document: fakeDocument,
        window: fakeWindow
    });

    controller.celebrate();
    assert.equal(audioInstances.length, 1);
    assert.equal(audioInstances[0].source, "assets/audio/victory.mp3");
    assert.equal(audioInstances[0].playCount, 1);
    assert.equal(audioInstances[0].currentTime, 0);
    assert.equal(canvases.length, 1);

    controller.celebrate();
    assert.equal(audioInstances.length, 1);
    assert.equal(audioInstances[0].playCount, 2);
    assert.equal(audioInstances[0].pauseCount, 2);
    assert.equal(canvases.length, 2);
    assert.equal(canvases[0].removed, true);
    assert.equal(animationFrames.size, 1);
    assert.equal(timeouts.size, 1);

    controller.cleanup();
    assert.equal(canvases[1].removed, true);
    assert.equal(animationFrames.size, 0);
    assert.equal(timeouts.size, 0);
});
