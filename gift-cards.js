"use strict";

const IDENTITY_STORAGE_KEY = "giftCardTrackerIdentity";
const HOUSEHOLD_IDENTITIES = ["Evan/Scarlet", "Mom", "Brina/Ryan"];
const SUPABASE_REST_URL = "https://hjftnsaabyntyliwgjie.supabase.co/rest/v1";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WkyBjvODmxrICShiF_09qw_VNEg-ghY";

const TABLES = {
    cards: "gift_cards",
    purchases: "gift_card_purchases",
    corrections: "gift_card_balance_corrections"
};

const RPCS = {
    createPurchase: "create_gift_card_purchase",
    updatePurchase: "update_gift_card_purchase",
    deletePurchase: "delete_gift_card_purchase",
    correctBalance: "correct_gift_card_balance"
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
});

const elements = {
    identityBar: document.querySelector("#identity-bar"),
    activeIdentity: document.querySelector("#active-identity"),
    switchIdentityButton: document.querySelector("#switch-identity-button"),
    trackerStatus: document.querySelector("#tracker-status"),
    trackerContent: document.querySelector("#tracker-content"),
    combinedBalance: document.querySelector("#combined-balance"),
    activeCardCount: document.querySelector("#active-card-count"),
    activeCards: document.querySelector("#active-cards"),
    archivedCards: document.querySelector("#archived-cards"),
    archivedCount: document.querySelector("#archived-count"),
    recordPurchaseButton: document.querySelector("#record-purchase-button"),
    addCardButton: document.querySelector("#add-card-button"),
    identityDialog: document.querySelector("#identity-dialog"),
    identityForm: document.querySelector("#identity-form"),
    identityCancelButton: document.querySelector("#identity-cancel-button"),
    addCardDialog: document.querySelector("#add-card-dialog"),
    addCardForm: document.querySelector("#add-card-form"),
    addCardOwner: document.querySelector("#add-card-owner"),
    purchaseDialog: document.querySelector("#purchase-dialog"),
    purchaseForm: document.querySelector("#purchase-form"),
    purchaseCard: document.querySelector("#purchase-card"),
    purchaseDate: document.querySelector("#purchase-date"),
    correctBalanceDialog: document.querySelector("#correct-balance-dialog"),
    correctBalanceForm: document.querySelector("#correct-balance-form"),
    calculatedBalance: document.querySelector("#calculated-balance"),
    editCardDialog: document.querySelector("#edit-card-dialog"),
    editCardForm: document.querySelector("#edit-card-form"),
    editPurchaseDialog: document.querySelector("#edit-purchase-dialog"),
    editPurchaseForm: document.querySelector("#edit-purchase-form")
};

let selectedIdentity = getSavedIdentity();
let trackerData = { cards: [], purchases: [], corrections: [] };
let trackerLoadToken = 0;
let mutationInProgress = false;

function createElement(tagName, options = {}, children = []) {
    const element = document.createElement(tagName);

    if (options.className) {
        element.className = options.className;
    }

    if (options.text !== undefined) {
        element.textContent = String(options.text);
    }

    Object.entries(options.attributes || {}).forEach(([name, value]) => {
        element.setAttribute(name, String(value));
    });

    children.forEach((child) => element.append(child));
    return element;
}

function createButton(text, className, onClick, attributes = {}) {
    const button = createElement("button", {
        className,
        text,
        attributes: { type: "button", ...attributes }
    });
    button.addEventListener("click", onClick);
    return button;
}

function createPencilButton(card) {
    const button = createButton("", "icon-button", () => openCorrectionDialog(card), {
        "aria-label": `Correct balance for ${cardLabel(card)}`,
        title: "Correct balance"
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a.996.996 0 0 0 0-1.41l-2.5-2.5a.996.996 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-1.8z");
    svg.append(path);
    button.append(svg);
    return button;
}

function getSavedIdentity() {
    try {
        const saved = localStorage.getItem(IDENTITY_STORAGE_KEY);
        return HOUSEHOLD_IDENTITIES.includes(saved) ? saved : "";
    } catch (error) {
        console.warn("Could not read the saved Gift Card identity.", error);
        return "";
    }
}

function saveIdentity(identity) {
    selectedIdentity = identity;

    try {
        localStorage.setItem(IDENTITY_STORAGE_KEY, identity);
    } catch (error) {
        console.warn("Could not remember the Gift Card identity on this device.", error);
    }
}

function getTodayLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatMoney(cents) {
    return currencyFormatter.format(cents / 100);
}

function moneyInputValue(cents) {
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function parseMoneyToCents(value, options = {}) {
    const normalized = String(value).trim().replace(/^\$/, "").replaceAll(",", "");

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        throw new Error("Enter a valid dollar amount with no more than two decimal places.");
    }

    const [dollars, fraction = ""] = normalized.split(".");
    const cents = (Number(dollars) * 100) + Number(fraction.padEnd(2, "0"));

    if (!Number.isSafeInteger(cents)) {
        throw new Error("That amount is too large.");
    }

    if (options.allowZero ? cents < 0 : cents <= 0) {
        throw new Error(options.allowZero
            ? "The balance cannot be negative."
            : "The amount must be greater than zero.");
    }

    return cents;
}

function formatDateOnly(dateString) {
    const parts = String(dateString).split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return dateString;
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return "";
    }

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(timestamp));
}

function cardLabel(card) {
    return card.nickname ? `${card.merchant} - ${card.nickname}` : card.merchant;
}

function getHeaders(extraHeaders = {}) {
    return {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        ...extraHeaders
    };
}

async function supabaseRequest(table, options = {}) {
    const query = options.query ? `?${options.query.toString()}` : "";
    const response = await fetch(`${SUPABASE_REST_URL}/${table}${query}`, {
        method: options.method || "GET",
        headers: getHeaders(options.body ? {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        } : {}),
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        let detail = "";

        try {
            const data = await response.json();
            detail = data.message || data.hint || JSON.stringify(data);
        } catch (error) {
            detail = response.statusText;
        }

        throw new Error(`${response.status} ${detail || "Supabase request failed"}`);
    }

    if (options.method && options.method !== "GET") {
        return null;
    }

    return response.json();
}

function supabaseRpc(functionName, body) {
    return supabaseRequest(`rpc/${functionName}`, {
        method: "POST",
        body
    });
}

function makeQuery(values) {
    const query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => query.set(key, value));
    return query;
}

async function fetchTrackerData(identity) {
    if (!identity) {
        return { cards: [], purchases: [], corrections: [] };
    }

    const cards = await supabaseRequest(TABLES.cards, {
        query: makeQuery({
            select: "id,owner,merchant,nickname,initial_balance_cents,manually_archived,created_at,updated_at",
            owner: `eq.${identity}`,
            order: "created_at.desc"
        })
    });

    if (cards.length === 0) {
        return { cards, purchases: [], corrections: [] };
    }

    const cardFilter = `in.(${cards.map((card) => card.id).join(",")})`;

    const [purchases, corrections] = await Promise.all([
        supabaseRequest(TABLES.purchases, {
            query: makeQuery({
                select: "id,gift_card_id,amount_cents,purchased_on,location,note,created_at,updated_at",
                gift_card_id: cardFilter,
                order: "purchased_on.desc,created_at.desc"
            })
        }),
        supabaseRequest(TABLES.corrections, {
            query: makeQuery({
                select: "id,gift_card_id,previous_balance_cents,corrected_balance_cents,adjustment_cents,created_at",
                gift_card_id: cardFilter,
                order: "created_at.desc"
            })
        })
    ]);

    return { cards, purchases, corrections };
}

// Each correction is an immutable ledger adjustment. The balance is always
// initial cents minus purchase cents plus the sum of correction adjustments.
function calculateBalance(card, data = trackerData) {
    const purchaseTotal = data.purchases
        .filter((purchase) => purchase.gift_card_id === card.id)
        .reduce((sum, purchase) => sum + Number(purchase.amount_cents), 0);
    const correctionTotal = data.corrections
        .filter((correction) => correction.gift_card_id === card.id)
        .reduce((sum, correction) => sum + Number(correction.adjustment_cents), 0);

    return Number(card.initial_balance_cents) - purchaseTotal + correctionTotal;
}

function cardActivity(cardId, data = trackerData) {
    const purchases = data.purchases
        .filter((purchase) => purchase.gift_card_id === cardId)
        .map((purchase) => ({ type: "purchase", timestamp: purchase.created_at, value: purchase }));
    const corrections = data.corrections
        .filter((correction) => correction.gift_card_id === cardId)
        .map((correction) => ({ type: "correction", timestamp: correction.created_at, value: correction }));

    return [...purchases, ...corrections].sort((left, right) => {
        const leftSort = left.type === "purchase"
            ? `${left.value.purchased_on}T23:59:59|${left.timestamp}`
            : `${left.timestamp.slice(0, 10)}T23:59:59|${left.timestamp}`;
        const rightSort = right.type === "purchase"
            ? `${right.value.purchased_on}T23:59:59|${right.timestamp}`
            : `${right.timestamp.slice(0, 10)}T23:59:59|${right.timestamp}`;
        return rightSort.localeCompare(leftSort);
    });
}

function lastActivityTimestamp(card) {
    const activity = cardActivity(card.id);
    return activity.length ? activity[0].timestamp : (card.updated_at || card.created_at);
}

function sortCards(cards) {
    return [...cards].sort((left, right) =>
        String(lastActivityTimestamp(right)).localeCompare(String(lastActivityTimestamp(left))));
}

function isActiveCard(card, data = trackerData) {
    return !card.manually_archived && calculateBalance(card, data) > 0;
}

function setStatus(message, isError = false) {
    elements.trackerStatus.replaceChildren();
    elements.trackerStatus.classList.toggle("error", isError);

    if (message) {
        elements.trackerStatus.append(createElement("span", { text: message }));
    }
}

function showLoadError(message) {
    elements.trackerContent.classList.add("hidden");
    setStatus(message, true);
    elements.trackerStatus.append(createButton("Try Again", "", loadTrackerData));
}

async function loadTrackerData() {
    const identityAtStart = selectedIdentity;
    const loadToken = ++trackerLoadToken;

    elements.trackerContent.classList.add("hidden");
    setStatus("Loading the latest gift-card data.");

    try {
        const latest = await fetchTrackerData(identityAtStart);

        if (loadToken !== trackerLoadToken || selectedIdentity !== identityAtStart) {
            return;
        }

        trackerData = latest;
        renderTracker();
        setStatus("");
        elements.trackerContent.classList.remove("hidden");
    } catch (error) {
        if (loadToken !== trackerLoadToken || selectedIdentity !== identityAtStart) {
            return;
        }

        console.error("Could not load Gift Card Tracker data.", error);
        showLoadError("Gift-card data could not be loaded. Check your connection and Supabase setup, then try again.");
    }
}

function renderTracker() {
    const activeCards = sortCards(trackerData.cards.filter((card) => isActiveCard(card)));
    const archivedCards = sortCards(trackerData.cards.filter((card) => !isActiveCard(card)));
    const combinedCents = activeCards.reduce((sum, card) => sum + calculateBalance(card), 0);

    elements.combinedBalance.textContent = formatMoney(combinedCents);
    elements.activeCardCount.textContent = `${activeCards.length} active ${activeCards.length === 1 ? "card" : "cards"}`;
    elements.archivedCount.textContent = `(${archivedCards.length})`;
    elements.recordPurchaseButton.disabled = activeCards.length === 0;

    const activeEmptyMessage = trackerData.cards.length === 0
        ? "No cards yet. Add your first gift card to get started."
        : "No active cards. Add a card or correct a used card's balance.";
    renderCardList(elements.activeCards, activeCards, activeEmptyMessage);
    renderCardList(elements.archivedCards, archivedCards, "No used or archived cards.");
}

function renderCardList(container, cards, emptyMessage) {
    container.replaceChildren();

    if (cards.length === 0) {
        container.append(createElement("p", { className: "empty-state", text: emptyMessage }));
        return;
    }

    cards.forEach((card) => container.append(renderCard(card)));
}

function renderCard(card) {
    const activity = cardActivity(card.id);
    const balance = calculateBalance(card);
    const active = isActiveCard(card);
    const article = createElement("article", {
        className: `gift-card${active ? "" : " is-archived"}`
    });

    const heading = createElement("div", { className: "gift-card-heading" }, [
        createElement("h3", { text: cardLabel(card) })
    ]);

    if (card.manually_archived) {
        heading.append(createElement("span", { className: "card-secondary", text: "Archived" }));
    } else if (balance <= 0) {
        heading.append(createElement("span", { className: "card-secondary", text: "Used" }));
    }

    const balanceRow = createElement("div", { className: "balance-row" }, [
        createElement("span", { className: "remaining-balance", text: formatMoney(balance) }),
        createPencilButton(card)
    ]);

    const initial = createElement("p", {
        className: "card-secondary",
        text: `Initial balance: ${formatMoney(Number(card.initial_balance_cents))}`
    });
    const lastActivity = createElement("p", {
        className: "card-secondary",
        text: activity.length
            ? `Last activity: ${formatTimestamp(lastActivityTimestamp(card))}`
            : "No activity yet"
    });
    const actions = createElement("div", { className: "card-actions" });

    if (active) {
        actions.append(createButton("Use Card", "", () => openPurchaseDialog(card.id)));
    }

    actions.append(createButton("Edit Card", "secondary-button", () => openEditCardDialog(card)));

    if (activity.length === 0) {
        actions.append(createButton("Delete Card", "danger-button", (event) => deleteCard(card, event.currentTarget)));
    } else if (!card.manually_archived) {
        actions.append(createButton("Archive", "secondary-button", (event) =>
            updateArchiveStatus(card, true, event.currentTarget)));
    }

    if (card.manually_archived) {
        actions.append(createButton("Restore", "secondary-button", (event) =>
            updateArchiveStatus(card, false, event.currentTarget)));
    }

    article.append(heading, balanceRow, initial, lastActivity, actions, renderHistory(card, activity));
    return article;
}

function renderHistory(card, activity) {
    const details = createElement("details", { className: "card-history" });
    details.append(createElement("summary", {
        text: `Activity (${activity.length})`
    }));

    if (activity.length === 0) {
        details.append(createElement("p", {
            className: "empty-state",
            text: "No purchases yet."
        }));
        return details;
    }

    const list = createElement("ul", { className: "activity-list" });
    activity.forEach((entry) => list.append(renderActivity(card, entry)));
    details.append(list);
    return details;
}

function renderActivity(card, entry) {
    if (entry.type === "correction") {
        const correction = entry.value;
        return createElement("li", { className: "activity-item correction" }, [
            createElement("p", {
                className: "activity-title",
                text: `Balance corrected from ${formatMoney(Number(correction.previous_balance_cents))} to ${formatMoney(Number(correction.corrected_balance_cents))}`
            }),
            createElement("p", {
                className: "activity-meta",
                text: formatTimestamp(correction.created_at)
            })
        ]);
    }

    const purchase = entry.value;
    const item = createElement("li", { className: "activity-item" });
    item.append(
        createElement("p", {
            className: "activity-title",
            text: `Purchase: ${formatMoney(Number(purchase.amount_cents))}`
        }),
        createElement("p", {
            className: "activity-meta",
            text: formatDateOnly(purchase.purchased_on)
        })
    );

    if (purchase.location) {
        item.append(createElement("p", { text: `Location: ${purchase.location}` }));
    }

    if (purchase.note) {
        item.append(createElement("p", { text: `Note: ${purchase.note}` }));
    }

    item.append(createElement("div", { className: "activity-actions" }, [
        createButton("Edit", "secondary-button", () => openEditPurchaseDialog(purchase)),
        createButton("Delete", "danger-button", (event) =>
            deletePurchase(card, purchase, event.currentTarget))
    ]));
    return item;
}

function setIdentityUi() {
    elements.activeIdentity.textContent = selectedIdentity;
    elements.identityBar.classList.toggle("hidden", !selectedIdentity);
}

function openIdentityDialog(isSwitch = false) {
    elements.identityCancelButton.classList.toggle("hidden", !isSwitch);
    elements.identityDialog.querySelectorAll("input[name='identity']").forEach((input) => {
        input.checked = input.value === selectedIdentity;
    });
    elements.identityDialog.showModal();
}

function openAddCardDialog() {
    elements.addCardForm.reset();
    clearFormError(elements.addCardForm);
    elements.addCardOwner.value = selectedIdentity;
    elements.addCardDialog.showModal();
}

function activeCardsFrom(data = trackerData) {
    return sortCards(data.cards.filter((card) => isActiveCard(card, data)));
}

function openPurchaseDialog(preselectedCardId = "") {
    const cards = activeCardsFrom();
    elements.purchaseForm.reset();
    clearFormError(elements.purchaseForm);
    elements.purchaseCard.replaceChildren(
        createElement("option", {
            text: "Select a gift card",
            attributes: { value: "" }
        })
    );

    cards.forEach((card) => {
        elements.purchaseCard.append(createElement("option", {
            text: `${cardLabel(card)} (${formatMoney(calculateBalance(card))} remaining)`,
            attributes: { value: card.id }
        }));
    });

    elements.purchaseCard.value = preselectedCardId;
    elements.purchaseDate.value = getTodayLocalDate();
    elements.purchaseDialog.showModal();
}

function openCorrectionDialog(card) {
    const form = elements.correctBalanceForm;
    form.reset();
    clearFormError(form);
    form.elements.cardId.value = card.id;
    const balance = calculateBalance(card);
    elements.calculatedBalance.textContent = formatMoney(balance);
    form.elements.correctedBalance.value = moneyInputValue(Math.max(0, balance));
    elements.correctBalanceDialog.showModal();
}

function openEditCardDialog(card) {
    const form = elements.editCardForm;
    form.reset();
    clearFormError(form);
    form.elements.cardId.value = card.id;
    form.elements.merchant.value = card.merchant;
    form.elements.nickname.value = card.nickname || "";
    elements.editCardDialog.showModal();
}

function openEditPurchaseDialog(purchase) {
    const form = elements.editPurchaseForm;
    form.reset();
    clearFormError(form);
    form.elements.purchaseId.value = purchase.id;
    form.elements.cardId.value = purchase.gift_card_id;
    form.elements.amount.value = moneyInputValue(Number(purchase.amount_cents));
    form.elements.purchaseDate.value = purchase.purchased_on;
    form.elements.location.value = purchase.location || "";
    form.elements.note.value = purchase.note || "";
    elements.editPurchaseDialog.showModal();
}

function clearFormError(form) {
    form.querySelector(".form-error").textContent = "";
}

function setFormError(form, message) {
    form.querySelector(".form-error").textContent = message;
}

function setFormPending(form, pending) {
    form.querySelectorAll("button, input, select, textarea").forEach((control) => {
        control.disabled = pending;
    });
    form.setAttribute("aria-busy", String(pending));
}

function setMutationInProgress(pending) {
    mutationInProgress = pending;

    document.querySelectorAll("#tracker-content button, #switch-identity-button").forEach((button) => {
        if (pending) {
            button.dataset.wasDisabled = String(button.disabled);
            button.disabled = true;
        } else if (button.dataset.wasDisabled !== undefined) {
            button.disabled = button.dataset.wasDisabled === "true";
            delete button.dataset.wasDisabled;
        }
    });
}

async function submitMutation(form, dialog, mutation) {
    if (mutationInProgress) {
        setFormError(form, "Another change is still being saved. Please wait.");
        return;
    }

    const identityAtStart = selectedIdentity;
    clearFormError(form);
    setMutationInProgress(true);
    setFormPending(form, true);
    let mutationSaved = false;

    try {
        await mutation(identityAtStart);
        mutationSaved = true;
        const latest = await fetchTrackerData(identityAtStart);

        if (selectedIdentity !== identityAtStart) {
            dialog.close();
            loadTrackerData();
            return;
        }

        trackerLoadToken += 1;
        trackerData = latest;
        renderTracker();
        dialog.close();
        form.reset();
        setStatus("");
        elements.trackerContent.classList.remove("hidden");
    } catch (error) {
        console.error("Gift Card Tracker mutation failed.", error);

        if (mutationSaved) {
            dialog.close();
            showLoadError("Your change was saved, but the latest balances could not be reloaded. Try again before making another change.");
        } else {
            setFormError(form, error.message || "The change could not be saved. Check your connection and try again.");
        }
    } finally {
        setFormPending(form, false);
        setMutationInProgress(false);
    }
}

async function performInlineMutation(button, mutation) {
    if (mutationInProgress) {
        return;
    }

    const identityAtStart = selectedIdentity;
    setMutationInProgress(true);
    let mutationSaved = false;

    try {
        await mutation(identityAtStart);
        mutationSaved = true;
        const latest = await fetchTrackerData(identityAtStart);

        if (selectedIdentity !== identityAtStart) {
            loadTrackerData();
            return;
        }

        trackerLoadToken += 1;
        trackerData = latest;
        renderTracker();
        setStatus("");
    } catch (error) {
        console.error("Gift Card Tracker mutation failed.", error);

        if (mutationSaved) {
            showLoadError("Your change was saved, but the latest balances could not be reloaded. Try again before making another change.");
        } else {
            setStatus(error.message || "The change could not be saved. Check your connection and try again.", true);
        }
    } finally {
        setMutationInProgress(false);
    }
}

function findCard(data, cardId) {
    return data.cards.find((card) => card.id === cardId);
}

function ensureDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error("Choose a valid purchase date.");
    }
}

async function deleteCard(card, button) {
    if (!confirm(`Permanently delete ${cardLabel(card)}? This is only allowed because it has no activity history.`)) {
        return;
    }

    await performInlineMutation(button, async (identity) => {
        const latest = await fetchTrackerData(identity);
        const latestCard = findCard(latest, card.id);

        if (!latestCard) {
            throw new Error("This card no longer exists.");
        }

        if (cardActivity(card.id, latest).length > 0) {
            throw new Error("This card now has activity and cannot be deleted. Reload and archive it instead.");
        }

        await supabaseRequest(TABLES.cards, {
            method: "DELETE",
            query: makeQuery({
                id: `eq.${card.id}`,
                owner: `eq.${identity}`
            })
        });
    });
}

async function updateArchiveStatus(card, archived, button) {
    await performInlineMutation(button, async (identity) => {
        await supabaseRequest(TABLES.cards, {
            method: "PATCH",
            query: makeQuery({
                id: `eq.${card.id}`,
                owner: `eq.${identity}`
            }),
            body: { manually_archived: archived }
        });
    });
}

async function deletePurchase(card, purchase, button) {
    if (!confirm(`Delete the ${formatMoney(Number(purchase.amount_cents))} purchase from ${cardLabel(card)}?`)) {
        return;
    }

    await performInlineMutation(button, async () => {
        await supabaseRpc(RPCS.deletePurchase, {
            p_purchase_id: purchase.id
        });
    });
}

elements.identityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const identity = new FormData(elements.identityForm).get("identity");

    if (!HOUSEHOLD_IDENTITIES.includes(identity)) {
        return;
    }

    saveIdentity(identity);
    setIdentityUi();
    elements.identityDialog.close();
    loadTrackerData();
});

elements.identityCancelButton.addEventListener("click", () => {
    if (selectedIdentity) {
        elements.identityDialog.close();
    }
});

elements.identityDialog.addEventListener("cancel", (event) => {
    if (!selectedIdentity) {
        event.preventDefault();
    }
});

elements.identityDialog.addEventListener("close", () => {
    if (!selectedIdentity) {
        queueMicrotask(() => openIdentityDialog(false));
    }
});

elements.switchIdentityButton.addEventListener("click", () => openIdentityDialog(true));
elements.addCardButton.addEventListener("click", openAddCardDialog);
elements.recordPurchaseButton.addEventListener("click", () => openPurchaseDialog());

document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
        const form = dialog.querySelector("form");

        if (form && form.getAttribute("aria-busy") === "true") {
            event.preventDefault();
        }
    });
});

document.querySelectorAll(".dialog-cancel").forEach((button) => {
    button.addEventListener("click", () => {
        const dialog = button.closest("dialog");
        const form = dialog.querySelector("form");

        if (!form || form.getAttribute("aria-busy") !== "true") {
            dialog.close();
        }
    });
});

elements.addCardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.addCardForm;
    const merchant = form.elements.merchant.value.trim();
    const nickname = form.elements.nickname.value.trim();
    let initialBalance;

    try {
        if (!merchant) {
            throw new Error("Merchant or card type is required.");
        }
        initialBalance = parseMoneyToCents(form.elements.initialBalance.value);
    } catch (error) {
        setFormError(form, error.message);
        return;
    }

    submitMutation(form, elements.addCardDialog, (identity) =>
        supabaseRequest(TABLES.cards, {
            method: "POST",
            body: {
                owner: identity,
                merchant,
                nickname: nickname || null,
                initial_balance_cents: initialBalance
            }
        }));
});

elements.purchaseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.purchaseForm;
    const cardId = form.elements.cardId.value;
    const location = form.elements.location.value.trim();
    const note = form.elements.note.value.trim();
    let amount;

    try {
        amount = parseMoneyToCents(form.elements.amount.value);
        ensureDateOnly(form.elements.purchaseDate.value);
    } catch (error) {
        setFormError(form, error.message);
        return;
    }

    submitMutation(form, elements.purchaseDialog, async (identity) => {
        const latest = await fetchTrackerData(identity);
        const card = findCard(latest, cardId);

        if (!card || !isActiveCard(card, latest)) {
            throw new Error("That card is unavailable. Reload and choose an active card.");
        }

        const available = calculateBalance(card, latest);

        if (amount > available) {
            throw new Error(`This purchase exceeds the latest remaining balance of ${formatMoney(available)}.`);
        }

        await supabaseRpc(RPCS.createPurchase, {
            p_gift_card_id: cardId,
            p_amount_cents: amount,
            p_purchased_on: form.elements.purchaseDate.value,
            p_location: location || null,
            p_note: note || null
        });
    });
});

elements.correctBalanceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.correctBalanceForm;
    const cardId = form.elements.cardId.value;
    let correctedBalance;

    try {
        correctedBalance = parseMoneyToCents(form.elements.correctedBalance.value, { allowZero: true });
    } catch (error) {
        setFormError(form, error.message);
        return;
    }

    submitMutation(form, elements.correctBalanceDialog, async (identity) => {
        const latest = await fetchTrackerData(identity);
        const card = findCard(latest, cardId);

        if (!card) {
            throw new Error("That card no longer exists.");
        }

        const previousBalance = calculateBalance(card, latest);

        if (correctedBalance === previousBalance) {
            throw new Error("The balance already matches that amount.");
        }

        await supabaseRpc(RPCS.correctBalance, {
            p_gift_card_id: cardId,
            p_corrected_balance_cents: correctedBalance
        });
    });
});

elements.editCardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.editCardForm;
    const merchant = form.elements.merchant.value.trim();
    const nickname = form.elements.nickname.value.trim();

    if (!merchant) {
        setFormError(form, "Merchant or card type is required.");
        return;
    }

    submitMutation(form, elements.editCardDialog, (identity) =>
        supabaseRequest(TABLES.cards, {
            method: "PATCH",
            query: makeQuery({
                id: `eq.${form.elements.cardId.value}`,
                owner: `eq.${identity}`
            }),
            body: { merchant, nickname: nickname || null }
        }));
});

elements.editPurchaseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = elements.editPurchaseForm;
    const purchaseId = form.elements.purchaseId.value;
    const cardId = form.elements.cardId.value;
    const location = form.elements.location.value.trim();
    const note = form.elements.note.value.trim();
    let amount;

    try {
        amount = parseMoneyToCents(form.elements.amount.value);
        ensureDateOnly(form.elements.purchaseDate.value);
    } catch (error) {
        setFormError(form, error.message);
        return;
    }

    submitMutation(form, elements.editPurchaseDialog, async (identity) => {
        const latest = await fetchTrackerData(identity);
        const card = findCard(latest, cardId);
        const purchase = latest.purchases.find((item) => item.id === purchaseId);

        if (!card || !purchase) {
            throw new Error("That purchase or card no longer exists.");
        }

        const maximumReplacementAmount = calculateBalance(card, latest) + Number(purchase.amount_cents);

        if (amount > maximumReplacementAmount) {
            throw new Error(`The edited amount exceeds the available ${formatMoney(maximumReplacementAmount)}.`);
        }

        await supabaseRpc(RPCS.updatePurchase, {
            p_purchase_id: purchaseId,
            p_amount_cents: amount,
            p_purchased_on: form.elements.purchaseDate.value,
            p_location: location || null,
            p_note: note || null
        });
    });
});

setIdentityUi();

if (selectedIdentity) {
    loadTrackerData();
} else {
    setStatus("Choose a household identity to view gift cards.");
    openIdentityDialog(false);
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch((error) => {
            console.error("Service worker registration failed:", error);
        });
    });
}
