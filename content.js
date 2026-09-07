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
//  Создание кнопки сохранение избранного
// ============================================================
async function createSaveFavoritesButton() {
    const btn = document.createElement("button");
    btn.textContent = "Сохранить избранное";
    btn.id = "hh-ext-save-favorites-btn";
    btn.addEventListener("click", async () => {
        const originalText = btn.textContent;
        btn.textContent = "⏳ Сбор данных...";
        btn.disabled = true;

        let pageNum = 0;
        let hasMore = true;
        const maxPages = 50; // Защита от бесконечного цикла
        let totalSaved = 0;

        try {
            // Получаем текущие сохраненные вакансии, чтобы объединить с новыми
            const saved = await getSavedVacancies();

            while (hasMore && pageNum < maxPages) {
                btn.textContent = `⏳ Обработка страницы ${pageNum + 1}...`;

                // Запрашиваем страницу с текущими cookies авторизации (fetch по умолчанию их отправляет)
                const url = `/applicant/favorites?tab=vacancies&page=${pageNum}`;
                const response = await fetch(url);

                if (response.status === 404) {
                    console.log(
                        `Достигнут конец списка (страница ${pageNum} вернула 404). Завершаем сбор.`,
                    );
                    hasMore = false;
                    break;
                }
                if (!response.ok) {
                    throw new Error(
                        `HTTP ошибка! Статус: ${response.status} ${response.statusText}`,
                    );
                }

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                // Ищем карточки вакансий на полученной странице
                const cards = doc.querySelectorAll("[class^='vacancy-card--']");

                // Если карточек нет, значит это последняя страница
                if (cards.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const card of cards) {
                    const id = getVacancyId(card);
                    if (id && !saved[id]) {
                        saved[id] = getVacancyInfo(card);
                        totalSaved++;
                    }
                }

                // Сохраняем обновленный объект в хранилище после обработки каждой страницы
                await chrome.storage.local.set({ [STORAGE_KEY]: saved });
                pageNum++;
            }

            btn.textContent = `✅ Успешно! Добавлено: ${totalSaved}`;

            // Синхронизируем иконки на текущей открытой странице
            document
                .querySelectorAll(".hh-ext-bookmark-btn")
                .forEach((domBtn) => {
                    const vId = domBtn.dataset.vacancyId;
                    if (saved[vId]) {
                        domBtn.innerHTML = SVG_ACTIVE;
                        domBtn.dataset.isSaved = "true";
                    }
                });

            // Возвращаем кнопке исходный вид через 3 секунды
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 3000);
        } catch (error) {
            console.error("Ошибка при сохранении избранного:", error);
            alert(
                `Произошла ошибка при сборе данных: ${error.message}\nВозможно, сессия истекла или нет доступа. Попробуйте обновить страницу.`,
            );
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    return btn;
}

async function processFavoritePage() {
    const box = document.querySelector("[class^='magritte-box']");
    if (!box) return;
    if (box.querySelector(".hh-ext-save-favorites-btn")) {
        return;
    }
    const wrapper = document.createElement("div[class='hh']");
    wrapper.className = "hh-ext-horizontal-wrapper";
    wrapper.append(
        await createSaveFavoritesButton(),
        box.querySelector("button"),
    );
    box.appendChild(wrapper);
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

    processFavoritePage();
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
