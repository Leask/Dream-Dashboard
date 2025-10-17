import { getLastEntry } from '../lib/func.mjs';

const formatRate = (bps = 0) => {
    if (!bps) { return '0 Mbps'; }
    const mbps = bps / 1_000_000;
    return `${mbps.toFixed(mbps >= 10 ? 1 : 2)} Mbps`;
};

const formatLatency = (latency) => {
    if (latency === null || latency === undefined) { return 'N/A'; }
    const value = Number(latency);
    return Number.isNaN(value) ? 'N/A' : `${value.toFixed(2)} ms`;
};

const formatAgo = (time) => {
    if (!time) { return 'never'; }
    const diff = Math.max(0, Date.now() - time.getTime());
    const seconds = Math.round(diff / 1000);
    if (seconds < 60) { return `${seconds}s ago`; }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) { return `${minutes}m ago`; }
    const hours = Math.round(minutes / 60);
    return `${hours}h ago`;
};

const formatPercent = (value) => {
    if (value === null || value === undefined) { return 'N/A'; }
    const num = Number(value);
    if (Number.isNaN(num)) { return 'N/A'; }
    const precision = num >= 100 || num % 1 === 0 ? 0 : 1;
    return `${num.toFixed(precision)}%`;
};

const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) { return 'N/A'; }
    if (!Number.isFinite(bytes) || bytes <= 0) { return '0 B'; }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let idx = 0;
    let value = bytes;
    while (value >= 1000 && idx < units.length - 1) {
        value /= 1000;
        idx += 1;
    }
    const precision = value >= 10 ? 2 : 2;
    return `${value.toFixed(precision)} ${units[idx]}`;
};

export const { layout, type, config, render } = {
    layout: [0, 0, 3, 3],
    type: 'markdown',
    config: { fg: 'green', selectedFg: 'green', label: 'UniFi Gateway' },
    render: (status, instant) => {
        const last = getLastEntry(status);
        const usage = status?.info?.monthlyUsage;
        const lines = [
            `**Gateway**: ${status?.info?.gateway || 'unknown'}`,
            `**Site**: ${status?.info?.site || 'default'}`,
            `**WAN Status**: ${status?.info?.wanStatus || 'unknown'}`,
            `**ISP**: ${status?.info?.isp || 'unknown'}`,
            `**WAN IP**: ${status?.info?.wanIp || 'unknown'}`,
            `**Uptime**: ${formatPercent(status?.info?.uptime)}`,
            `**Updated**: ${last?.time ? last.time.toLocaleTimeString() : 'never'} (${formatAgo(last?.time)})`,
            `**Throughput ↓**: ${formatRate(last?.downloadBps)}`,
            `**Throughput ↑**: ${formatRate(last?.uploadBps)}`,
            `**Latency**: ${formatLatency(last?.latencyMs)}`,
            `**Monthly Data Usage**: ${formatBytes(usage?.totalBytes)}`,
        ];
        instant.setMarkdown(lines.join('\n'));
    },
};
