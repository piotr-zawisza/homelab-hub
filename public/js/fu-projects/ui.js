import { State, t } from './state.js';
import { updateQrInDom } from './qr.js';

export const DOM = {};

export function initDOMCache() {
    const ids = ['drag-overlay', 'in-potential', 'in-area', 'in-use', 'in-flaw', 
                 'out-potential', 'out-area', 'out-use', 'out-flaw', 'total-cost', 'total-progress', 
                 'card-name', 'card-potential', 'card-area', 'card-use', 'card-cost', 
                 'card-progress', 'card-flaw', 'card-desc', 'card-flaw-desc-block', 'card-flaw-desc', 
                 'btn-back', 'btn-lang-pl', 'btn-lang-en', 'btn-save', 'btn-save-qr', 'btn-save-json', 
                 'btn-load', 'input-load', 'project-card', 'preview-area'];
                 
    ids.forEach(id => {
        const camelCaseKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        DOM[camelCaseKey] = document.getElementById(id);
    });
}

export function updateStateFromDOM() {
    State.project.baseCost = DOM.inPotential ? (parseInt(DOM.inPotential.value) || 0) : 0;
    State.project.areaMultiplier = DOM.inArea ? (parseFloat(DOM.inArea.value) || 1) : 1;
    State.project.useMultiplier = DOM.inUse ? (parseFloat(DOM.inUse.value) || 1) : 1;
    State.project.hasFlaw = DOM.inFlaw ? DOM.inFlaw.checked : false;

    const potIdx = DOM.inPotential ? DOM.inPotential.selectedIndex : -1;
    State.uiText.potential = potIdx >= 0 ? DOM.inPotential.options[potIdx].text : '';
    const areaIdx = DOM.inArea ? DOM.inArea.selectedIndex : -1;
    State.uiText.area = areaIdx >= 0 ? DOM.inArea.options[areaIdx].text : '';
    const useIdx = DOM.inUse ? DOM.inUse.selectedIndex : -1;
    State.uiText.use = useIdx >= 0 ? DOM.inUse.options[useIdx].text : '';
}

export function renderToDOM() {
    const tr = (State.translations && State.translations[State.lang]) ? State.translations[State.lang] : {};
    const currShort = tr["lbl_currency_short"] || "z";

    if (DOM.outPotential) DOM.outPotential.innerText = `${State.project.baseCost} ${currShort}`;
    if (DOM.outArea) DOM.outArea.innerText = `x${State.project.areaMultiplier}`;
    if (DOM.outUse) DOM.outUse.innerText = `x${State.project.useMultiplier}`;
    if (DOM.outFlaw) {
        DOM.outFlaw.innerText = `x${State.project.hasFlaw ? 0.75 : 1}`;
        DOM.outFlaw.style.color = State.project.hasFlaw ? "#ff5252" : "#aaa";
    }
    if (DOM.totalCost) DOM.totalCost.innerText = `${State.calculatedCost} ${currShort}`;
    if (DOM.totalProgress) {
        const sectionWord = tr["lbl_sections"] || "sekcji";
        DOM.totalProgress.innerText = `T${State.project.clockSections} (${State.project.clockSections} ${sectionWord})`;
    }
    
    DOM.cardFlawDescBlock.classList.toggle('element-hidden', !State.project.hasFlaw);

    if (document.activeElement !== DOM.cardName) {
        if (DOM.cardName) DOM.cardName.innerText = State.project.name;
    }
    if (document.activeElement !== DOM.cardDesc) {
        if (DOM.cardDesc) DOM.cardDesc.innerText = State.project.desc;
    }
    if (State.project.hasFlaw && DOM.cardFlawDesc) {
        if (document.activeElement !== DOM.cardFlawDesc) {
            DOM.cardFlawDesc.innerText = State.project.flawDesc;
        }
    }

    if (DOM.cardPotential) DOM.cardPotential.innerText = State.uiText.potential;
    if (DOM.cardArea) DOM.cardArea.innerText = State.uiText.area;
    if (DOM.cardUse) DOM.cardUse.innerText = State.uiText.use;
    if (DOM.cardCost) DOM.cardCost.innerText = State.calculatedCost;
    if (DOM.cardProgress) DOM.cardProgress.innerText = State.project.clockSections;
    if (DOM.cardFlaw) DOM.cardFlaw.innerText = State.project.hasFlaw ? (tr["card_flaw_yes"] || "Tak") : (tr["card_flaw_no"] || "Brak");

    const syncStatus = document.getElementById('ui-sync-status');
    if (syncStatus) {
        if (State.project.id) {
            syncStatus.textContent = `🟢 Synced (${State.project.id})`;
            syncStatus.style.color = 'var(--fu-value-green)';
        } else {
            syncStatus.textContent = `⚪ Local`;
            syncStatus.style.color = '#888';
        }
    }

    if (State.project.id) {
        updateQrInDom(`fuid:${State.project.id}`);
    } else {
        const qrContainer = document.getElementById('card-qr-container');
        if (qrContainer) qrContainer.innerHTML = '';
    }

    adjustCardScale();
}

export function applyStaticTranslations() {
    const tr = State.translations[State.lang];
    if (!tr) return;
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (tr[key]) el.textContent = tr[key]; });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { const key = el.getAttribute('data-i18n-title'); if (tr[key]) el.title = tr[key]; });
    if (DOM.btnLangPl) DOM.btnLangPl.classList.toggle('active', State.lang === 'pl');
    if (DOM.btnLangEn) DOM.btnLangEn.classList.toggle('active', State.lang === 'en');
}

export function loadDefaultValues(force = false) {
    const tr = State.translations[State.lang]; if (!tr) return;
    if (force || !State.project.name) State.project.name = tr["default_name"] || "";
    if (force || !State.project.flawDesc) State.project.flawDesc = tr["default_flaw_desc"] || "";
    if (force || !State.project.desc) State.project.desc = tr["default_desc"] || "";
}

export function resetButtons() {
    if (DOM.btnSave) { DOM.btnSave.disabled = false; 
    DOM.btnSave.innerText = t("btn_download_png", "Download (.PNG)"); }
    
    if (DOM.btnSaveQr) { DOM.btnSaveQr.disabled = false; 
    DOM.btnSaveQr.innerText = t("btn_download_qr", "Download with QR"); }
}

export function adjustCardScale() {
    const wrapper = document.getElementById('card-scale-wrapper'); 
    const card = document.getElementById('project-card');
    if (!wrapper || !card) return;
    
    let scaleW = 1;
    if (window.innerWidth <= 1100) {
        scaleW = Math.min(1, (window.innerWidth - 20) / 1000);
    }

    let scaleH = 1;
    const availableHeight = window.innerHeight - 40; // 40px na marginesy
    const cardHeight = card.offsetHeight;
    
    if (cardHeight > availableHeight) {
        scaleH = Math.max(0.6, availableHeight / cardHeight);
    }

    const finalScale = Math.min(scaleW, scaleH);
    
    wrapper.style.transform = `scale(${finalScale})`; 
    wrapper.style.height = `${cardHeight * finalScale}px`; 
}