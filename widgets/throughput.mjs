import { axisTime, getMaxMin } from '../lib/func.mjs';

const asMbps = (bps = 0) => Number((bps / 1_000_000).toFixed(2));

export const { layout, type, config, render } = {
    layout: [0, 0, 9, 12],
    type: 'line',
    config: {
        label: 'Gateway Throughput (Mbps)',
        showLegend: true,
        legend: { width: 18 },
        style: { text: 'green', baseline: 'black' },
    },
    render: (status, instant) => {
        const metrics = status?.metrics || [];
        const x = [];
        const download = [];
        const upload = [];
        for (const point of metrics) {
            x.push(axisTime(point.time));
            download.push(asMbps(point.downloadBps));
            upload.push(asMbps(point.uploadBps));
        }
        if (!x.length) {
            instant.setData([
                { title: 'Download', x: ['0'], y: [0], style: { line: 'cyan' } },
                { title: 'Upload', x: ['0'], y: [0], style: { line: 'magenta' } },
            ]);
            return;
        }
        const [maxY, minY] = getMaxMin([...download, ...upload], false);
        instant.options.maxY = maxY;
        instant.options.minY = minY;
        instant.setData([
            { title: 'Download', x, y: download, style: { line: 'cyan' } },
            { title: 'Upload', x, y: upload, style: { line: 'magenta' } },
        ]);
    },
};
