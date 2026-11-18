"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalCiKey = generalCiKey;
exports.sortByName = sortByName;
function generalCiKey(value) {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}
function sortByName(rows, name) {
    return rows.sort((a, b) => {
        const x = generalCiKey(name(a));
        const y = generalCiKey(name(b));
        if (x !== y)
            return x < y ? -1 : 1;
        return Number(a.id) - Number(b.id);
    });
}
//# sourceMappingURL=general-ci-sort.js.map