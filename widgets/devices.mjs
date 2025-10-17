const columns = [
    { key: 'name', width: 16 },
    { key: 'type', width: 4 },
    { key: 'ip', width: 14 },
    { key: 'state', width: 6 },
];

const formatState = (state) => {
    if (state === 1) { return 'online'; }
    if (state === 0) { return 'offline'; }
    return state === undefined || state === null ? 'unknown' : String(state);
};

const formatRow = (device) => {
    return [
        (device?.name || 'Unknown').slice(0, columns[0].width),
        (device?.type || 'n/a').slice(0, columns[1].width),
        (device?.ip || 'n/a').slice(0, columns[2].width),
        formatState(device?.state).slice(0, columns[3].width),
    ];
};

export const { layout, type, config, render } = {
    layout: [3, 0, 3, 3],
    type: 'table',
    config: {
        label: 'UniFi Devices',
        columnSpacing: 2,
        columnWidth: columns.map(col => col.width + 2),
        style: {
            fg: 'green',
            border: { fg: 'green' },
            header: { fg: 'cyan', bold: true },
        },
    },
    render: (status, instant) => {
        const devices = status?.devices || [];
        const err = status?.errors?.devices;
        if (!devices.length) {
            instant.setData({
                headers: ['Status'],
                data: [[err ? err.message || 'No devices' : 'Loading devices…']],
            });
            return;
        }
        const rows = devices
            .map(formatRow)
            .slice(0, 8);
        instant.setData({
            headers: columns.map(col => col.key.toUpperCase()),
            data: rows,
        });
    },
};
