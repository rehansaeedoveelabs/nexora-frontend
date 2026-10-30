import { db, delay, copy, genId } from './db.js';

export const rulesService = {
  async list() {
    await delay();
    return copy([...db.rules].sort((a, b) => a.priority - b.priority));
  },

  async get(id) {
    await delay();
    return copy(db.rules.find((r) => r.id === id) ?? null);
  },

  async create(rule) {
    await delay();
    const created = { ...rule, id: genId('rule'), priority: db.rules.length + 1, updatedAt: new Date().toISOString() };
    db.rules.push(created);
    return copy(created);
  },

  async update(id, patch) {
    await delay();
    const rule = db.rules.find((r) => r.id === id);
    if (!rule) throw new Error('Rule not found');
    Object.assign(rule, patch, { updatedAt: new Date().toISOString() });
    return copy(rule);
  },

  async duplicate(id) {
    await delay();
    const rule = db.rules.find((r) => r.id === id);
    if (!rule) throw new Error('Rule not found');
    const copyRule = { ...copy(rule), id: genId('rule'), name: `${rule.name} (copy)`, priority: db.rules.length + 1, enabled: false, updatedAt: new Date().toISOString() };
    db.rules.push(copyRule);
    return copy(copyRule);
  },

  async remove(id) {
    await delay();
    db.rules = db.rules.filter((r) => r.id !== id);
    db.rules.forEach((r, i) => { r.priority = i + 1; });
    return true;
  },

  /** Reorder priorities from a full ordered list of ids. */
  async reorder(orderedIds) {
    await delay();
    orderedIds.forEach((id, i) => {
      const rule = db.rules.find((r) => r.id === id);
      if (rule) rule.priority = i + 1;
    });
    return copy([...db.rules].sort((a, b) => a.priority - b.priority));
  },
};
