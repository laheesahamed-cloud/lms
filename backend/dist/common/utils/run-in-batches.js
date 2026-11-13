"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInBatches = runInBatches;
async function runInBatches(tasks, limit) {
    const results = new Array(tasks.length);
    const width = Math.max(1, Math.floor(limit) || 1);
    let next = 0;
    async function worker() {
        while (next < tasks.length) {
            const index = next++;
            results[index] = await tasks[index]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, () => worker()));
    return results;
}
//# sourceMappingURL=run-in-batches.js.map