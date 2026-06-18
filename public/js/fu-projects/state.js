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

export function t(key) {
    if (window.FULL_DICT && window.FULL_DICT[State.lang] && window.FULL_DICT[State.lang].fu_projects) {
        return window.FULL_DICT[State.lang].fu_projects[key] || key;
    }
    return window.DICT[key] || key;
}
