function processCard(card) {
    // Защита от дубликатов: если кнопка уже есть в этой карточке, ничего не делаем
    if (card.querySelector(".hh-ext-bookmark-btn")) {
        return;
    }
    const action_container = card.querySelector(
        "div > div[class^='actions-container']",
    );

    if (action_container) {
        action_container.appendChild(createSaveVacancyButton(card));
    }
}

function processExistingCards() {
    const cards = document.querySelectorAll("[class^='vacancy-card--']");
    cards.forEach(processCard);
}

function createSaveVacancyButton(card) {
    const button = document.createElement("button");
    button.className = "hh-ext-bookmark-btn";
    button.setAttribute("aria-label", "Сохранить вакансию");
    button.textContent = "Сохранить";

    const svgDefault = `
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
		<path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z"/>
		</svg>
	`;

    const svgActive = `
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ff0002" viewBox="0 0 16 16">
		<path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2"/>
		</svg>
	`;

    button.innerHTML = svgDefault;

    let isSaved = false;

    button.addEventListener("click", (e) => {
        e.stopPropagation();
        isSaved = !isSaved;
        if (isSaved) {
            button.innerHTML = svgActive;
            // Здесь можно добавить логику сохранения в файл или LocalStorage
            console.log("Вакансия сохранена!");
        } else {
            button.innerHTML = svgDefault;
            console.log("Вакансия удалена из сохраненных.");
        }
    });

    return button;
}

// Запускаем обработку карточек, которые уже есть при загрузке скрипта
processExistingCards();

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        // Проверяем только добавленные узлы (nodes)
        for (const node of mutation.addedNodes) {
            // Убеждаемся, что это HTML-элемент (а не текстовый узел)
            if (node.nodeType === 1) {
                // Если добавленный элемент сам является карточкой
                if (node.matches && node.matches("[class^='vacancy-card--']")) {
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
