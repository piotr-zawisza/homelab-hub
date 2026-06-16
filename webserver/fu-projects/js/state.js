export const State = {
    lang: 'en', 
    translations: {},
    project: { 
        id: null,
        name: '', 
        baseCost: 400, 
        areaMultiplier: 2, 
        useMultiplier: 1, 
        hasFlaw: true, 
        flawDesc: '', 
        desc: '', 
        clockSections: 6 
    },
    uiText: { potential: '', area: '', use: '' },
    calculatedCost: 600
};

export function t(key, fallback = "") {
    return (State.translations[State.lang] || {})[key] || fallback;
}