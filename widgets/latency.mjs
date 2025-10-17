import { axisTime, getMaxMin, initData } from '../lib/func.mjs';

export const { layout, type, config, render } = {
    layout: [8, 4, 4, 4],
    type: 'line',
    config: {
        label: 'Latency (ms)',
        style: { line: 'yellow', text: 'green', baseline: 'black' },
        wholeNumbersOnly: false,
        xPadding: 5,
    },
    render: (status, instant) => {
        const metrics = status?.metrics || [];
        const data = initData();
        for (const point of metrics) {
            if (point.latencyMs === null || point.latencyMs === undefined) { continue; }
            data.x.push(axisTime(point.time));
            data.y.push(Number(point.latencyMs));
        }
        if (!data.x.length) {
            instant.setData([{ title: 'Latency', x: ['0'], y: [0] }]);
            return;
        }
        const [maxY, minY] = getMaxMin(data.y);
        instant.options.maxY = maxY;
        instant.options.minY = minY;
        instant.setData([{ title: 'Latency', x: data.x, y: data.y, style: { line: 'yellow' } }]);
    },
};
