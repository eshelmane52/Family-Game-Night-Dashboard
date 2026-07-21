(function (root, factory) {
    const dashboardUI = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = dashboardUI;
    }

    if (root) {
        root.FamilyGameNightUI = dashboardUI;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const CONFETTI_COLORS = [
        "#f4b400",
        "#e53935",
        "#238636",
        "#1e88e5",
        "#8e24aa",
        "#fb8c00"
    ];

    function normalizeWinCount(value) {
        const numericValue = Number(value);

        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return 0;
        }

        return numericValue;
    }

    function getHighestWinCount(winnerCounts) {
        const counts = winnerCounts && typeof winnerCounts === "object"
            ? Object.values(winnerCounts)
            : [];

        return counts.reduce(function (highestCount, count) {
            return Math.max(highestCount, normalizeWinCount(count));
        }, 0);
    }

    function calculateWinPercentage(wins, highestWins) {
        const safeWins = normalizeWinCount(wins);
        const safeHighestWins = normalizeWinCount(highestWins);

        if (safeHighestWins === 0) {
            return 0;
        }

        return Math.min(100, (safeWins / safeHighestWins) * 100);
    }

    function formatWinCount(wins) {
        const safeWins = normalizeWinCount(wins);
        return `${safeWins} ${safeWins === 1 ? "Win" : "Wins"}`;
    }

    function sortPlayersByWins(playerNames, winnerCounts) {
        const counts = winnerCounts && typeof winnerCounts === "object"
            ? winnerCounts
            : {};

        return [...playerNames]
            .map(function (playerName, displayIndex) {
                return {
                    displayIndex,
                    playerName,
                    wins: normalizeWinCount(counts[playerName])
                };
            })
            .sort(function (firstPlayer, secondPlayer) {
                return secondPlayer.wins - firstPlayer.wins
                    || firstPlayer.displayIndex - secondPlayer.displayIndex;
            })
            .map(function (player) {
                return player.playerName;
            });
    }

    function formatPlayerNameList(playerNames) {
        if (playerNames.length <= 1) {
            return playerNames[0] || "";
        }

        if (playerNames.length === 2) {
            return `${playerNames[0]} & ${playerNames[1]}`;
        }

        return `${playerNames.slice(0, -1).join(", ")} & ${playerNames[playerNames.length - 1]}`;
    }

    function buildMostWinsStatText(playerNames, winnerCounts, fallbackLabel = "None yet") {
        const counts = winnerCounts && typeof winnerCounts === "object"
            ? winnerCounts
            : {};
        const highestWins = getHighestWinCount(counts);

        if (highestWins === 0) {
            return `${fallbackLabel} (0)`;
        }

        const playerDisplayOrder = [...new Set([...playerNames, ...Object.keys(counts)])];
        const tiedLeaders = playerDisplayOrder.filter(function (playerName) {
            return normalizeWinCount(counts[playerName]) === highestWins;
        });

        if (tiedLeaders.length === 0) {
            return `${fallbackLabel} (0)`;
        }

        return `${formatPlayerNameList(tiedLeaders)} \u2014 ${formatWinCount(highestWins)}`;
    }

    function triggerCelebrationForSubmission(isValidSubmission, celebrate) {
        if (!isValidSubmission) {
            return false;
        }

        try {
            celebrate();
        } catch (error) {
            // Celebration is optional and must never interrupt result saving.
        }

        return true;
    }

    function dismissRules(rulesSection) {
        if (!rulesSection) {
            return false;
        }

        rulesSection.hidden = true;
        return true;
    }

    function setupRulesDismissal(rulesSection, closeButton) {
        if (!rulesSection || !closeButton) {
            return false;
        }

        closeButton.addEventListener("click", function () {
            dismissRules(rulesSection);
        });

        return true;
    }

    function createCelebrationController(options = {}) {
        const documentObject = options.document || (typeof document !== "undefined" ? document : null);
        const windowObject = options.window || (typeof window !== "undefined" ? window : null);
        const audioSource = options.audioSource || "assets/audio/victory.mp3";
        const AudioConstructor = options.Audio || (windowObject && windowObject.Audio);
        let audio = null;
        let canvas = null;
        let animationFrameId = null;
        let holdTimeoutId = null;
        let fadeTimeoutId = null;
        let lifecycleTimeoutId = null;

        if (AudioConstructor) {
            try {
                audio = new AudioConstructor(audioSource);
                audio.preload = "auto";
            } catch (error) {
                audio = null;
            }
        }

        function clearTimer(timerId) {
            if (timerId !== null && windowObject) {
                windowObject.clearTimeout(timerId);
            }
        }

        function removeConfetti() {
            if (animationFrameId !== null && windowObject) {
                windowObject.cancelAnimationFrame(animationFrameId);
            }

            clearTimer(holdTimeoutId);
            clearTimer(fadeTimeoutId);
            clearTimer(lifecycleTimeoutId);

            animationFrameId = null;
            holdTimeoutId = null;
            fadeTimeoutId = null;
            lifecycleTimeoutId = null;

            if (canvas) {
                canvas.remove();
                canvas = null;
            }
        }

        function playVictorySound() {
            if (!audio) {
                return;
            }

            try {
                audio.pause();
            } catch (error) {
                // Continue and still attempt playback.
            }

            try {
                audio.currentTime = 0;
            } catch (error) {
                // Some implementations do not allow seeking before metadata loads.
            }

            try {
                const playPromise = audio.play();

                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(function () {
                        // Some browsers may still block playback; saving continues normally.
                    });
                }
            } catch (error) {
                // Audio support and policies vary; saving continues normally.
            }
        }

        function createParticles(count, viewportWidth, viewportHeight) {
            return Array.from({ length: count }, function () {
                const size = 5 + Math.random() * 7;

                return {
                    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                    height: size * (0.45 + Math.random() * 0.45),
                    rotation: Math.random() * Math.PI,
                    rotationSpeed: -5 + Math.random() * 10,
                    settled: false,
                    settleY: viewportHeight - 3 - Math.random() * 24,
                    velocityX: -60 + Math.random() * 120,
                    velocityY: 170 + Math.random() * 260,
                    width: size,
                    x: Math.random() * viewportWidth,
                    y: -Math.random() * Math.max(80, viewportHeight * 0.35)
                };
            });
        }

        function drawParticles(context, particles) {
            particles.forEach(function (particle) {
                context.save();
                context.translate(particle.x, particle.y);
                context.rotate(particle.rotation);
                context.fillStyle = particle.color;
                context.fillRect(
                    -particle.width / 2,
                    -particle.height / 2,
                    particle.width,
                    particle.height
                );
                context.restore();
            });
        }

        function startConfetti() {
            removeConfetti();

            if (!documentObject || !documentObject.body || !windowObject) {
                return;
            }

            try {
                canvas = documentObject.createElement("canvas");
                canvas.className = "confetti-canvas";
                canvas.setAttribute("aria-hidden", "true");
                documentObject.body.appendChild(canvas);

                const context = canvas.getContext("2d");

                if (!context) {
                    removeConfetti();
                    return;
                }

                const viewportWidth = Math.max(1, windowObject.innerWidth);
                const viewportHeight = Math.max(1, windowObject.innerHeight);
                const pixelRatio = Math.min(windowObject.devicePixelRatio || 1, 2);
                const reducedMotion = typeof windowObject.matchMedia === "function"
                    && windowObject.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const isNarrowScreen = viewportWidth < 600;
                const particleCount = reducedMotion ? 20 : (isNarrowScreen ? 55 : 90);
                const fallingDuration = reducedMotion ? 450 : 1800;
                const settledDuration = reducedMotion ? 600 : 3500;
                const fadeDuration = reducedMotion ? 300 : 1000;
                const particles = createParticles(particleCount, viewportWidth, viewportHeight);
                let previousTimestamp = null;
                let startTimestamp = null;

                canvas.width = Math.floor(viewportWidth * pixelRatio);
                canvas.height = Math.floor(viewportHeight * pixelRatio);
                canvas.style.width = `${viewportWidth}px`;
                canvas.style.height = `${viewportHeight}px`;
                canvas.style.setProperty("--confetti-fade-duration", `${fadeDuration}ms`);
                context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

                lifecycleTimeoutId = windowObject.setTimeout(
                    removeConfetti,
                    fallingDuration + settledDuration + fadeDuration + 1000
                );

                function animate(timestamp) {
                    if (!canvas) {
                        return;
                    }

                    if (startTimestamp === null) {
                        startTimestamp = timestamp;
                        previousTimestamp = timestamp;
                    }

                    const elapsed = timestamp - startTimestamp;
                    const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.04);
                    previousTimestamp = timestamp;
                    context.clearRect(0, 0, viewportWidth, viewportHeight);

                    particles.forEach(function (particle) {
                        if (particle.settled) {
                            return;
                        }

                        particle.velocityY += 520 * deltaSeconds;
                        particle.x += particle.velocityX * deltaSeconds;
                        particle.y += particle.velocityY * deltaSeconds;
                        particle.rotation += particle.rotationSpeed * deltaSeconds;

                        if (particle.x < -particle.width) {
                            particle.x = viewportWidth + particle.width;
                        } else if (particle.x > viewportWidth + particle.width) {
                            particle.x = -particle.width;
                        }

                        if (particle.y >= particle.settleY) {
                            particle.y = particle.settleY;
                            particle.settled = true;
                        }
                    });

                    drawParticles(context, particles);

                    if (elapsed < fallingDuration) {
                        animationFrameId = windowObject.requestAnimationFrame(animate);
                        return;
                    }

                    particles.forEach(function (particle) {
                        if (!particle.settled) {
                            particle.y = particle.settleY;
                            particle.settled = true;
                        }
                    });
                    context.clearRect(0, 0, viewportWidth, viewportHeight);
                    drawParticles(context, particles);
                    animationFrameId = null;

                    holdTimeoutId = windowObject.setTimeout(function () {
                        if (!canvas) {
                            return;
                        }

                        canvas.classList.add("confetti-canvas--fading");
                        fadeTimeoutId = windowObject.setTimeout(removeConfetti, fadeDuration);
                    }, settledDuration);
                }

                animationFrameId = windowObject.requestAnimationFrame(animate);
            } catch (error) {
                removeConfetti();
            }
        }

        function celebrate() {
            playVictorySound();
            startConfetti();
        }

        function cleanup() {
            removeConfetti();

            if (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (error) {
                    // Cleanup remains best-effort across browser audio implementations.
                }
            }
        }

        return {
            celebrate,
            cleanup
        };
    }

    return {
        buildMostWinsStatText,
        calculateWinPercentage,
        createCelebrationController,
        dismissRules,
        formatWinCount,
        getHighestWinCount,
        setupRulesDismissal,
        sortPlayersByWins,
        triggerCelebrationForSubmission
    };
});
