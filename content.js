// ============================================================
//  Иконки
// ============================================================
const SVG_DEFAULT = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
    <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z"/>
    </svg>
`;

const SVG_ACTIVE = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ff0002" viewBox="0 0 16 16">
    <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2"/>
    </svg>
`;

// ============================================================
//  Хранилище
// ============================================================
const STORAGE_KEY = "hh_saved_vacancies";

async function getSavedVacancies() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || {};
}

async function saveVacancy(id, info) {
    const saved = await getSavedVacancies();
    saved[id] = info;
    await chrome.storage.local.set({ [STORAGE_KEY]: saved });
}

async function removeVacancy(id) {
    const saved = await getSavedVacancies();
    delete saved[id];
    await chrome.storage.local.set({ [STORAGE_KEY]: saved });
}

async function isVacancySaved(id) {
    const saved = await getSavedVacancies();
    return saved.hasOwnProperty(id);
}

// ============================================================
//  Извлечение ID и метаданных вакансии из карточки
// ============================================================
function getVacancyId(card) {
    const link = card.querySelector("a[href*='/vacancy/']");
    if (link) {
        const m = link.href.match(/\/vacancy\/(\d+)/);
        if (m) return m[1];
    }
    return null;
}

function getVacancyInfo(card) {
    const link = card.querySelector("a[href*='/vacancy/']");
    return {
        title: link ? link.textContent.trim() : "Без названия",
        url: link ? link.href : "",
        savedAt: new Date().toISOString(),
    };
}

// ============================================================
//  Обработка карточек
// ============================================================
async function processCard(card) {
    // Защита от дубликатов: если кнопка уже есть в этой карточке, ничего не делаем
    if (card.querySelector(".hh-ext-bookmark-btn")) {
        return;
    }
    const action_container = card.querySelector(
        "div > div[class^='actions-container']",
    );

    if (action_container) {
        action_container.appendChild(await createSaveVacancyButton(card));
    }
}

async function processExistingCards() {
    const cards = document.querySelectorAll("[class^='vacancy-card--']");
    for (const card of cards) {
        await processCard(card);
    }
}

// ============================================================
//  Создание кнопки закладки
// ============================================================
async function createSaveVacancyButton(card) {
    const vacancyId = getVacancyId(card);
    if (!vacancyId) return document.createComment("no-id");

    const button = document.createElement("button");
    button.className = "hh-ext-bookmark-btn";
    button.setAttribute("aria-label", "Сохранить вакансию");
    button.dataset.vacancyId = vacancyId;

    let isSaved = await isVacancySaved(vacancyId);
    button.dataset.isSaved = isSaved;
    button.innerHTML = isSaved ? SVG_ACTIVE : SVG_DEFAULT;

    button.addEventListener("click", async (e) => {
        e.stopPropagation();

        let currentIsSaved = button.dataset.isSaved === "true";
        currentIsSaved = !currentIsSaved;
        button.dataset.isSaved = currentIsSaved;

        if (currentIsSaved) {
            button.innerHTML = SVG_ACTIVE;

            const vacancyId = getVacancyId(card);
            await saveVacancy(vacancyId, getVacancyInfo(card));
            console.log(`✅ Вакансия ${vacancyId} сохранена`);
        } else {
            button.innerHTML = SVG_DEFAULT;

            await removeVacancy(vacancyId);
            console.log(`❌ Вакансия ${vacancyId} удалена из сохранённых`);
        }
    });

    return button;
}

// ============================================================
//  Запуск
// ============================================================
(async function init() {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "storage-cleared") {
            document.querySelectorAll(".hh-ext-bookmark-btn").forEach((btn) => {
                btn.innerHTML = SVG_DEFAULT;
                btn.dataset.isSaved = "false";
            });
        }
    });

    await processExistingCards();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Проверяем только добавленные узлы (nodes)
            for (const node of mutation.addedNodes) {
                // Убеждаемся, что это HTML-элемент (а не текстовый узел)
                if (node.nodeType === 1) {
                    // Если добавленный элемент сам является карточкой
                    if (
                        node.matches &&
                        node.matches("[class^='vacancy-card--']")
                    ) {
                        processCard(node);
                    }
                    // Если добавленный элемент содержит внутри себя карточки (например, блок списка)
                    const cardsInside = node.querySelectorAll
                        ? node.querySelectorAll("[class^='vacancy-card--']")
                        : [];
                    cardsInside.forEach(processCard);
                }
            }
        }
    });
    // Начинаем наблюдение за всем телом документа на предмет добавления новых элементов
    observer.observe(document.body, { childList: true, subtree: true });
})();
