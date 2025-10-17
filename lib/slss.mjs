import { Agent } from 'undici';
import { URL } from 'url';
import { event, utilitas } from 'utilitas';
import { loadConfig } from './config.mjs';

const config = loadConfig();
const origin = new URL(`https://${config.gateway}`);
const insecureAgent = config.verifySsl === false
    ? new Agent({ connect: { rejectUnauthorized: false }, keepAliveTimeout: 30000 })
    : null;

const requestJson = async (pathname, { method = 'GET', query = {}, body = null } = {}) => {
    const url = new URL(pathname.replace(/^\/+/, ''), origin);
    for (const key of Object.keys(query || {})) {
        const value = query[key];
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    }
    const headers = {
        'X-API-Key': config.apiKey,
        'Accept': 'application/json',
    };
    if (body) { headers['content-type'] = 'application/json'; }
    const options = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        dispatcher: insecureAgent || undefined,
    };
    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        utilitas.throwError(`Failed to reach UniFi gateway at ${config.gateway}. ${error.message}`, 503);
    }
    if (!response.ok) {
        const text = (await response.text())
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);
        utilitas.throwError(`UniFi API error ${response.status}: ${text}`, response.status);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    return {};
};

const toNumber = (value) => {
    if (value === null || value === undefined) { return null; }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
};

const pickNumber = (source, ...keys) => {
    for (const key of keys) {
        const value = source?.[key];
        const num = toNumber(value);
        if (num !== null) { return num; }
    }
    return null;
};

const average = (values = []) => {
    const filtered = values.map(toNumber).filter(value => value !== null);
    if (!filtered.length) { return null; }
    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

const resolveLatency = (wanHealth, wwwHealth) => {
    const directLatency = pickNumber(wwwHealth, 'latency', 'speedtest_ping');
    if (directLatency !== null) { return directLatency; }
    const uptimeLatency = toNumber(wanHealth?.uptime_stats?.WAN?.latency_average);
    if (uptimeLatency !== null) { return uptimeLatency; }
    const monitorLatencies = [
        ...(wanHealth?.uptime_stats?.WAN?.monitors || []).map(item => item?.latency_average),
        ...(wanHealth?.uptime_stats?.WAN?.alerting_monitors || []).map(item => item?.latency_average),
    ];
    return average(monitorLatencies);
};

const toMetricPoint = (wanHealth, wwwHealth) => {
    if (!wanHealth && !wwwHealth) { return null; }
    const rxBytesRate = pickNumber(wanHealth, 'rx_bytes-r', 'rx_bytes_r');
    const txBytesRate = pickNumber(wanHealth, 'tx_bytes-r', 'tx_bytes_r');
    const latency = resolveLatency(wanHealth, wwwHealth);
    const downloadBps = rxBytesRate !== null ? rxBytesRate * 8 : null;
    const uploadBps = txBytesRate !== null ? txBytesRate * 8 : null;
    return {
        time: new Date(),
        downloadBps: downloadBps || 0,
        uploadBps: uploadBps || 0,
        latencyMs: latency,
        status: wanHealth?.status || wwwHealth?.status || null,
        raw: { wan: wanHealth, www: wwwHealth },
    };
};

const fetchWanHealth = async () => {
    const response = await requestJson(`/proxy/network/api/s/${config.site}/stat/health`);
    const payload = Array.isArray(response?.data) ? response.data : response;
    const wanHealth = (payload || []).find(item => item?.subsystem === 'wan') || null;
    const wwwHealth = (payload || []).find(item => item?.subsystem === 'www') || null;
    const point = toMetricPoint(wanHealth, wwwHealth);
    return {
        points: point ? [point] : [],
        status: point?.status || null,
        raw: response,
    };
};

const watchStatus = async (cb, i = 1, t = 1, d = 0, n = 'unifi', o = {}) => {
    return event.loop(async () => {
        let resp = null;
        let err = null;
        try {
            resp = await fetchWanHealth();
        } catch (error) {
            err = error;
        }
        if (cb) { await cb(resp, err); }
    }, i, t, d, n, { silent: true, ...o });
};

export {
    fetchWanHealth as fetchMetrics,
    watchStatus,
};
