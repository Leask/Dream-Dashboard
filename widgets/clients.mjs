export const { layout, type, config, render } = {
    layout: [9, 8, 3, 2],
    type: 'table',
    config: {
        label: 'Active Clients',
        columnSpacing: 2,
        columnWidth: [14, 10, 12],
        style: {
            fg: 'green',
            border: { fg: 'green' },
            header: { fg: 'cyan', bold: true },
        },
    },
    render: (status, instant) => {
        const clients = status?.clients || [];
        if (!clients.length) {
            const err = status?.errors?.clients;
            instant.setData({
                headers: ['State'],
                data: [[err ? `Error: ${err.message || err}` : 'No active clients']],
            });
            return;
        }
        const rows = clients.slice(0, 6).map(client => {
            const name = (client?.name || client?.ip || client?.mac || 'Unknown').slice(0, 18);
            const ip = client?.ip || (client?.isWired ? 'wired' : 'wireless');
            const down = formatBytes(client?.rxBytes || 0);
            const up = formatBytes(client?.txBytes || 0);
            return [name, ip, `↓${down} ↑${up}`];
        });
        instant.setData({
            headers: ['Client', 'IP', 'Usage'],
            data: rows,
        });
    },
};

function formatBytes(bytes = 0) {
    if (!Number.isFinite(bytes) || bytes <= 0) { return '0B'; }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    const precision = value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)}${units[index]}`;
}
