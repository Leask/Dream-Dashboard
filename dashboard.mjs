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
const limitedLayouts = {
    info: [0, 0, 12, 3],
    throughput: [0, 3, 12, 9],
};
const config = loadConfig();
const status = {
    metrics: [],
    logs: [],
    clients: [],
    devices: [],
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
        devices: null,
    },
    lastUpdated: null,
    raw: null,
};

const widgetFiles = (readdirSync(widgetsPath) || []).filter(
    file => /\.mjs$/i.test(file) && file.indexOf('.') !== 0
);

for (const file of widgetFiles) {
    const name = file.replace(/^(.*)\.mjs$/i, '$1');
    const module = { ...await import(join(widgetsPath, file)) };
    module.originalLayout = [...module.layout];
    widgets[name] = module;
    widgets[name].instant = grid.set(
        module.layout[0], module.layout[1],
        module.layout[2], module.layout[3],
        contrib[module.type], module.config
    );
}

const applyLayouts = (limited) => {
    for (const key of Object.keys(widgets)) {
        const widget = widgets[key];
        const layout = limited && limitedLayouts[key] ? limitedLayouts[key] : widget.originalLayout;
        widget.instant = grid.set(
            layout[0], layout[1], layout[2], layout[3],
            contrib[widget.type], widget.config
        );
        if (limited && !limitedLayouts[key]) {
            widget.instant.hide();
        } else {
            widget.instant.show();
        }
    }
};

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
    if (resp?.devices) {
        status.devices = resp.devices.items || [];
        status.errors.devices = resp.devices.error || null;
    }
    if (err) {
        status.logs.push({ time: new Date(), message: err.message, error: true });
    }
    while (status.logs.length > maxStatus) { status.logs.shift(); }

    const height = screen.height || screen.rows || process.stdout.rows || 0;
    const limited = height > 0 && height < 30;
    const visibleWhenLimited = new Set(Object.keys(limitedLayouts));
    status.ui = status.ui || {};
    if (status.ui.limited !== limited) {
        applyLayouts(limited);
    }
    status.ui.limited = limited;

    for (const key of Object.keys(widgets)) {
        const widget = widgets[key];
        const hidden = limited && !visibleWhenLimited.has(key);
        if (hidden) { continue; }
        widget.render(status, widget.instant);
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
