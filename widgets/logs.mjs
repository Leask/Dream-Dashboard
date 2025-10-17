const formatLog = (entry) => {
    if (!entry) { return null; }
    const timestamp = entry.time instanceof Date
        ? entry.time.toLocaleTimeString()
        : new Date(entry.time || Date.now()).toLocaleTimeString();
    const message = entry.message || JSON.stringify(entry);
    const prefix = entry.error ? '[!]' : '[i]';
    return `${timestamp} ${prefix} ${message}`;
};

export const { layout, type, config, render } = {
    layout: [9, 6, 3, 2],
    type: 'log',
    config: { fg: 'green', selectedFg: 'green', label: 'Events' },
    render: (status, instant) => {
        const items = (status?.logs || [])
            .map(formatLog)
            .filter(Boolean)
            .slice(-50);
        if (instant.setItems) {
            instant.setItems(items);
        } else {
            instant.clearItems?.();
            items.forEach(line => instant.log(line));
        }
    },
};
