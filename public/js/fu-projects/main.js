import { State, t } from './state.js';
import { DOM, initDOMCache, updateStateFromDOM, renderToDOM, applyStaticTranslations, loadDefaultValues, adjustCardScale, resetButtons } from './ui.js';
import { PNGMetadata } from './metadata.js';
import { readCyberQRFromFile, updateQrInDom } from './qr.js';

const CONFIG = window.APP_CONFIG;
const META_KEYWORD = "fabulaprojekt";

function calculateLogic() {
    let cost = State.project.baseCost * State.project.areaMultiplier * State.project.useMultiplier;
    let flawMultiplier = State.project.hasFlaw ? 0.75 : 1;
    State.calculatedCost = cost * flawMultiplier;
    State.project.clockSections = Math.max(1, Math.floor(State.calculatedCost / 100));
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function processUpdate() {
    updateStateFromDOM();
    calculateLogic();
    renderToDOM();
}
async function switchLanguage(langCode) {
    State.lang = langCode;
    try {
        localStorage.setItem('preferredLang', State.lang);
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('lang', State.lang);
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);

        const response = await fetch(`/api/lang/${langCode}`);
        if (!response.ok) throw new Error("Translation fetch failed");

        const newDict = await response.json();
        State.translations[langCode] = newDict.fu_projects;
        window.DICT = newDict;

        applyStaticTranslations();
        loadDefaultValues(false);
        processUpdate();
        if (DOM.btnBack) DOM.btnBack.href = `../?lang=${State.lang}`;

    } catch (e) {
        console.error("[i18n] Error while switching languages:", e);
    }
}

function cleanFilename(str) {
    if (!str) return "project";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "project";
}

async function executeImageExport() {
    if (typeof html2canvas === 'undefined' || typeof LZString === 'undefined') {
        showToast(t("msg_err_libs", "Error: Missing libraries"), 'error'); return;
    }

    const fileName = cleanFilename(State.project.name);
    const exportData = { ...State.project, savedLang: State.lang };
    const jsonString = JSON.stringify(exportData);

    try {
        const baseCanvas = await html2canvas(DOM.projectCard, {
            backgroundColor: null,
            scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
                const cardWrapper = clonedDoc.getElementById('card-scale-wrapper');
                if (cardWrapper) cardWrapper.style.transform = 'none';

                const card = clonedDoc.getElementById('project-card');
                if (card) { card.style.width = '1000px'; card.style.maxWidth = 'none'; }

                const clonedQrCanvas = clonedDoc.querySelector('#card-qr-container');
                if (clonedQrCanvas && State.project.id) {
                    clonedQrCanvas.style.opacity = '1';
                }
            }
        });

        baseCanvas.toBlob(async imageBlob => {
            const finalBlob = await PNGMetadata.inject(imageBlob, META_KEYWORD, jsonString);
            const link = document.createElement('a');
            const objectUrl = URL.createObjectURL(finalBlob);
            link.download = `fu_project_${fileName}.png`;
            link.href = objectUrl;
            link.click();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            showToast(t("msg_toast_export_ok"), "success");
        }, "image/png");

    } catch (err) {
        console.error("Error while generating Image:", err);
        showToast(t("msg_err_img_gen", "Generation error"), 'error');
    } finally {
        resetButtons();
    }
}

async function saveImageServerQR() {
    let pwd = sessionStorage.getItem('FU_PASS');
    if (!pwd) {
        pwd = prompt(t("msg_prompt_password"));
        if (!pwd) return;
        sessionStorage.setItem('FU_PASS', pwd);
    }

    DOM.btnSaveQr.disabled = true;

    const exportData = { ...State.project, savedLang: State.lang };
    try {
        const response = await fetch('/api/fu-projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd, payload: exportData })
        });

        if (!response.ok) {
            if (response.status === 401) {
                sessionStorage.removeItem('FU_PASS');
                showToast(t("msg_toast_pwd_err"), "error");
                return;
            }
            throw new Error("Server rejected the save request.");
        }

        const data = await response.json();
        if (data.id && data.id.startsWith('fuid:')) {
            State.project.id = data.id.split(':')[1];
        }

        updateQrInDom(data.id);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        await executeImageExport();

    } catch (err) {
        console.error(err);
        showToast(t("msg_toast_conn_err"), "error");
    } finally {
        resetButtons();
    }
}

function saveToJson() {
    const exportData = { ...State.project, savedLang: State.lang };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `fu_project_${cleanFilename(State.project.name)}.json`;
    link.href = URL.createObjectURL(blob); link.click();
    showToast(t("msg_toast_json_ok"), "success");
}

async function processFile(file) {
    if (!file) return;
    try {
        let jsonString = null;

        if (file.type.startsWith('image/')) {
            if (file.name.toLowerCase().endsWith('.png')) {
                jsonString = await PNGMetadata.extract(file, META_KEYWORD);
            }
            if (!jsonString) jsonString = await readCyberQRFromFile(file);
            if (!jsonString) {
                showToast(t("msg_err_no_data", "No data in image."), 'error');
                return;
            }
        } else {
            jsonString = await file.text();
        }

        const rawData = JSON.parse(jsonString);
        if (!rawData || typeof rawData !== 'object') throw new Error("File doesn't contain a valid JSON object.");

        let data = Array.isArray(rawData) ? {
            name: rawData[0], baseCost: rawData[1], areaMultiplier: rawData[2], useMultiplier: rawData[3],
            hasFlaw: rawData[4] === 1, flawDesc: rawData[5], desc: rawData[6], clockSections: rawData[7], savedLang: rawData[8]
        } : rawData;

        if (data.savedLang && data.savedLang !== State.lang) {
            State.lang = data.savedLang;
            applyStaticTranslations();
        }

        State.project.id = data.id || null;

        State.project.name = data.name ?? data.nazwa ?? "";
        State.project.flawDesc = data.flawDesc ?? data.flaw_desc ?? "";
        State.project.desc = data.desc ?? data.opis ?? "";
        DOM.inPotential.value = data.baseCost ?? data.potential ?? data.potencial ?? 400;
        DOM.inArea.value = data.areaMultiplier ?? data.area ?? 2;
        DOM.inUse.value = data.useMultiplier ?? data.use ?? 1;
        DOM.inFlaw.checked = data.hasFlaw ?? data.flaw ?? false;

        processUpdate();
        showToast(t("msg_toast_load_ok"), "success");
    } catch (err) {
        console.error("Parsing error details:", err);
        showToast(t("msg_err_parse", "Parse error: ") + err.message, "error");
    }
}

async function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    await processFile(file);
    event.target.value = '';
}

function attachEventListeners() {
    const updateEvents = ['input', 'change'];
    const inputs = [DOM.inPotential, DOM.inArea, DOM.inUse, DOM.inFlaw];

    const debouncedProcessUpdate = debounce(processUpdate, 150);
    const debouncedAdjustCardScale = debounce(adjustCardScale, 150);

    inputs.forEach(el => {
        if (el) updateEvents.forEach(evt => el.addEventListener(evt, debouncedProcessUpdate));
    });

    if (DOM.btnSave) DOM.btnSave.addEventListener('click', () => executeImageExport(null));
    if (DOM.btnSaveQr) DOM.btnSaveQr.addEventListener('click', saveImageServerQR);
    if (DOM.btnSaveJson) DOM.btnSaveJson.addEventListener('click', saveToJson);
    if (DOM.btnLoad) DOM.btnLoad.addEventListener('click', () => DOM.inputLoad.click());
    if (DOM.inputLoad) DOM.inputLoad.addEventListener('change', loadFromFile);
    if (DOM.btnLangPl) DOM.btnLangPl.addEventListener('click', () => switchLanguage('pl'));
    if (DOM.btnLangEn) DOM.btnLangEn.addEventListener('click', () => switchLanguage('en'));

    const editableElements = [
        { card: DOM.cardName, stateKey: 'name' },
        { card: DOM.cardDesc, stateKey: 'desc' },
        { card: DOM.cardFlawDesc, stateKey: 'flawDesc' }
    ];

    editableElements.forEach(({ card, stateKey }) => {
        if (!card) return;

        card.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        card.addEventListener('input', (e) => {
            State.project[stateKey] = e.target.innerText;
            debouncedAdjustCardScale();
        });

        card.addEventListener('blur', () => {
            processUpdate();
        });
    });

    if (DOM.cardFlawDescBlock && DOM.cardFlawDesc) {
        DOM.cardFlawDescBlock.addEventListener('click', (e) => {
            if (e.target !== DOM.cardFlawDesc) {
                DOM.cardFlawDesc.focus();

                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(DOM.cardFlawDesc);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    }

    let dragCounter = 0;
    document.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; if (DOM.dragOverlay) DOM.dragOverlay.classList.add('active'); });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('dragleave', (e) => {
        e.preventDefault(); dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0 && DOM.dragOverlay) DOM.dragOverlay.classList.remove('active');
    });
    document.addEventListener('drop', async (e) => {
        e.preventDefault(); dragCounter = 0;
        if (DOM.dragOverlay) DOM.dragOverlay.classList.remove('active');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) await processFile(e.dataTransfer.files[0]);
    });
}

async function initApp() {
    initDOMCache();
    attachEventListeners();

    State.lang = window.APP_LANG || 'en';
    if (window.DICT && window.DICT.fu_projects) {
        State.translations[State.lang] = window.DICT.fu_projects;
    }

    const urlParams = new URLSearchParams(window.location.search);
    let prefLang = null;
    try {
        prefLang = localStorage.getItem('preferredLang');
    } catch (e) { }

    const targetLang = urlParams.get('lang') || prefLang;

    if (targetLang && targetLang !== State.lang && (targetLang === 'pl' || targetLang === 'en')) {
        await switchLanguage(targetLang);
    } else {
        applyStaticTranslations();
        loadDefaultValues(false);
        processUpdate();
    }

    if (DOM.btnBack) DOM.btnBack.href = `../?lang=${State.lang}`;
    adjustCardScale();
    if (DOM.previewArea && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => adjustCardScale()).observe(DOM.previewArea);
    } else { window.addEventListener('resize', adjustCardScale); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();
