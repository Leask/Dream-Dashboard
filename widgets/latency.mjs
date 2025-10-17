import { axisTime, getMaxMin } from '../lib/func.mjs';

export const { layout, type, config, render } = {
    layout: [9, 3, 3, 3],
    type: 'line',
    config: {
        label: 'Latency (ms)',
        showLegend: false,
        style: { text: 'green', baseline: 'black', line: 'yellow' },
        xPadding: 5,
        wholeNumbersOnly: false,
    },
    render: (status, instant) => {
        const metrics = status?.metrics || [];
        const x = [];
        const y = [];
        for (const point of metrics) {
            if (point.latencyMs === null || point.latencyMs === undefined) { continue; }
            const value = Number(point.latencyMs);
            if (!Number.isFinite(value)) { continue; }
            x.push(axisTime(point.time));
            y.push(value);
        }
        if (!y.length) {
            instant.setData([{ title: 'Latency', x: ['0'], y: [0] }]);
            return;
        }
        if (y.length === 1) {
            x.push(x[0]);
            y.push(y[0]);
        }
        const [maxY, minY] = getMaxMin(y, false);
        instant.options.maxY = maxY;
        instant.options.minY = minY;
        instant.setData([{ title: 'Latency', x, y, style: { line: 'yellow' } }]);
    },
};
