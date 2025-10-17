#!/usr/bin/env node

import { join } from 'path';
import { readdirSync } from 'fs';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { utilitas } from 'utilitas';
import { maxStatus } from './lib/func.mjs';
import { loadConfig } from './lib/config.mjs';
import { watchStatus } from './lib/dashboard.mjs';

const { __dirname } = utilitas.__(import.meta.url);
const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen });
const widgetsPath = join(__dirname, 'widgets');
const widgets = {};
const config = loadConfig();
const status = {
    metrics: [],
    logs: [],
    clients: [],
    applications: [],
    info: {
        gateway: config.gateway,
        site: config.site,
        wanStatus: null,
        isp: null,
        wanIp: null,
        uptime: null,
        monthlyUsage: null,
    },
    errors: {
        clients: null,
        applications: null,
    },
    lastUpdated: null,
    raw: null,
};

const widgetFiles = (readdirSync(widgetsPath) || []).filter(
    file => /\.mjs$/i.test(file) && file.indexOf('.') !== 0
);

for (const file of widgetFiles) {
    const name = file.replace(/^(.*)\.mjs$/i, '$1');
    widgets[name] = { ...await import(join(widgetsPath, file)) };
    widgets[name].instant = grid.set(
        widgets[name].layout[0], widgets[name].layout[1],
        widgets[name].layout[2], widgets[name].layout[3],
        contrib[widgets[name].type], widgets[name].config
    );
}

const mergeMetrics = (existing = [], incoming = []) => {
    const merged = new Map();
    for (const point of existing) {
        merged.set(point.time.getTime(), point);
    }
    for (const point of incoming) {
        merged.set(point.time.getTime(), point);
    }
    return Array.from(merged.values())
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .slice(-maxStatus);
};

const renderAll = (resp, err) => {
    if (resp?.points?.length) {
        status.metrics = mergeMetrics(status.metrics, resp.points);
        const latestPoint = resp.points[resp.points.length - 1];
        const latestTime = latestPoint?.time;
        if (latestTime && (!status.lastUpdated || latestTime.getTime() !== status.lastUpdated.getTime())) {
            status.logs.push({
                time: new Date(),
                message: `Received metrics up to ${latestTime.toLocaleTimeString()}`,
            });
        }
        status.lastUpdated = latestTime || status.lastUpdated;
        status.raw = resp.raw;
        status.info.wanStatus = latestPoint?.status || resp.status || status.info.wanStatus;
        if (resp.isp) { status.info.isp = resp.isp; }
        if (resp.wanIp) { status.info.wanIp = resp.wanIp; }
        if (resp.uptime !== undefined) { status.info.uptime = resp.uptime; }
        if (resp.monthlyUsage) { status.info.monthlyUsage = resp.monthlyUsage; }
    }
    if (resp?.clients) {
        status.clients = resp.clients.items || [];
        status.errors.clients = resp.clients.error || null;
    }
    if (resp?.applications) {
        status.applications = resp.applications.items || [];
        status.errors.applications = resp.applications.error || null;
    }
    if (err) {
        status.logs.push({ time: new Date(), message: err.message, error: true });
    }
    while (status.logs.length > maxStatus) { status.logs.shift(); }
    for (const key of Object.keys(widgets)) {
        widgets[key].render(status, widgets[key].instant);
    }
    screen.render();
};

screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

screen.on('resize', () => {
    for (const key of Object.keys(widgets)) {
        widgets[key].instant.emit('attach');
    }
    renderAll();
});

renderAll();

await watchStatus(renderAll);
