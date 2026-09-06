// ============================================================
//  Хранилище
// ============================================================
const STORAGE_KEY = "hh_saved_vacancies";

async function getSavedVacancies() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || {};
}

async function refreshUI() {
    const data = await getSavedVacancies();
    const count = Object.keys(data).length;
    document.getElementById("count").textContent = count;
    document.getElementById("export-btn").disabled = count === 0;
    document.getElementById("clear-btn").disabled = count === 0;
}

async function exportToFile() {
    const data = await getSavedVacancies();
    const arr = Object.entries(data).map(([id, info]) => ({ id, ...info }));
    const json = JSON.stringify(arr, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `hh_vacancies_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearAll() {
    if (!confirm("Удалить все сохранённые вакансии?")) return;
    chrome.storage.local.set({ [STORAGE_KEY]: {} }, () => {
        refreshUI();
        // Сообщаем content-скрипту, чтобы он обновил иконки на странице
        chrome.tabs.query(
            { url: ["https://hh.ru/*", "https://*.hh.ru/*"] },
            (tabs) => {
                for (const tab of tabs) {
                    chrome.tabs
                        .sendMessage(tab.id, { type: "storage-cleared" })
                        .catch(() => {});
                }
            },
        );
    });
}

document.getElementById("export-btn").addEventListener("click", exportToFile);
document.getElementById("clear-btn").addEventListener("click", clearAll);

refreshUI();
