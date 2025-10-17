import { utilitas } from 'utilitas';

const getLastEntry = (a, f = 'metrics') => {
    const list = a?.[f] || [];
    return list[list.length - 1] || null;
};
const getLastAntenna = getLastEntry;
const initData = () => ({ x: [], y: [] });
const pdTime = (time) => utilitas.ensureInt(time, { pad: 2 });
const maxStatus = 100;

const axisTime = (time) => {
    const t = new Date(time);
    return [t.getHours(), t.getMinutes(), t.getSeconds()].map(pdTime).join(':');
};

const roundUpTo = (value, step = 10) => {
    if (!Number.isFinite(value) || value <= 0) { return step; }
    return Math.ceil(value / step) * step;
};

const getMaxMin = (data, percent) => {
    const src = percent ? [100, 0] : data;
    const filtered = src.filter(value => Number.isFinite(value));
    if (!filtered.length) { return [roundUpTo(10), 0]; }
    const max = Math.max(...filtered);
    const roundedMax = roundUpTo(max, 10);
    return [roundedMax, 0];
};

export {
    axisTime,
    getLastAntenna,
    getLastEntry,
    getMaxMin,
    initData,
    maxStatus,
};
