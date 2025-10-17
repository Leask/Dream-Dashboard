export const { layout, type, config, render } = {
    layout: [9, 10, 3, 2],
    type: 'table',
    config: {
        label: 'Top Applications',
        columnSpacing: 2,
        columnWidth: [16, 12, 12],
        style: {
            fg: 'green',
            border: { fg: 'green' },
            header: { fg: 'cyan', bold: true },
        },
    },
    render: (status, instant) => {
        const applications = status?.applications || [];
        if (!applications.length) {
            const err = status?.errors?.applications;
            instant.setData({
                headers: ['Status'],
                data: [[err ? 'DPI disabled or unavailable' : 'Collecting DPI data…']],
            });
            return;
        }
        const rows = applications.slice(0, 6).map(app => {
            const name = (app?.name || 'Unknown').slice(0, 18);
            const down = formatBytes(app?.rxBytes || 0);
            const up = formatBytes(app?.txBytes || 0);
            return [name, `↓${down}`, `↑${up}`];
        });
        instant.setData({
            headers: ['Application', 'Down', 'Up'],
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
