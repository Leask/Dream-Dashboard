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

export const { layout, type, config, render } = {
    layout: [9, 0, 3, 4],
    type: 'markdown',
    config: { fg: 'green', selectedFg: 'green', label: 'UniFi Gateway' },
    render: (status, instant) => {
        const last = getLastEntry(status);
        const lines = [
            `**Gateway**: ${status?.info?.gateway || 'unknown'}`,
            `**Site**: ${status?.info?.site || 'default'}`,
            `**WAN Status**: ${status?.info?.wanStatus || 'unknown'}`,
            `**Updated**: ${last?.time ? last.time.toLocaleTimeString() : 'never'} (${formatAgo(last?.time)})`,
            `**Download**: ${formatRate(last?.downloadBps)}`,
            `**Upload**: ${formatRate(last?.uploadBps)}`,
            `**Latency**: ${formatLatency(last?.latencyMs)}`,
            `**Samples cached**: ${(status?.metrics || []).length}`,
        ];
        instant.setMarkdown(lines.join('\n'));
    },
};
