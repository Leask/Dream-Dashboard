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

let cachedMonthlyUsage = { value: null, fetchedAt: 0 };

const fetchMonthlyUsage = async () => {
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    if (cachedMonthlyUsage.value !== null && cachedMonthlyUsage.fetchedAt && now - cachedMonthlyUsage.fetchedAt < fifteenMinutes) {
        return cachedMonthlyUsage.value;
    }
    if (cachedMonthlyUsage.value === null && cachedMonthlyUsage.fetchedAt && now - cachedMonthlyUsage.fetchedAt < fiveMinutes) {
        return null;
    }
    const end = Math.floor(now / 3_600_000) * 3_600_000;
    const start = end - 400 * 24 * 3_600_000;
    let usage = null;
    try {
        const response = await requestJson(`/proxy/network/api/s/${config.site}/stat/report/monthly.site`, {
            method: 'POST',
            body: {
                start,
                end,
                attrs: ['wan-tx_bytes', 'wan-rx_bytes', 'time'],
            },
        });
        const entries = Array.isArray(response?.data) ? response.data : [];
        const latest = entries
            .filter(item => item && item.time !== undefined)
            .sort((a, b) => toNumber(a.time) - toNumber(b.time))
            .pop();
        if (latest) {
            const downloadBytes = toNumber(latest['wan-rx_bytes']) || 0;
            const uploadBytes = toNumber(latest['wan-tx_bytes']) || 0;
            const totalBytes = downloadBytes + uploadBytes;
            usage = {
                downloadBytes,
                uploadBytes,
                totalBytes,
                periodStart: toNumber(latest.time) || null,
            };
        }
    } catch (error) {
        usage = null;
    }
    cachedMonthlyUsage = { value: usage, fetchedAt: now };
    return usage;
};

const simplifyClient = (client = {}) => {
    const name = client.display_name || client.hostname || client.name || client.ip || client.mac;
    const rxBytes = toNumber(client.rx_bytes) || 0;
    const txBytes = toNumber(client.tx_bytes) || 0;
    return {
        name,
        ip: client.ip || null,
        mac: client.mac || null,
        isWired: !!client.is_wired,
        signal: toNumber(client.signal),
        rxBytes,
        txBytes,
        rxRate: toNumber(client.rx_rate),
        txRate: toNumber(client.tx_rate),
        uptime: toNumber(client.uptime),
        lastSeen: toNumber(client.last_seen),
    };
};

const fetchActiveClients = async () => {
    try {
        const response = await requestJson(`/proxy/network/v2/api/site/${config.site}/clients/active`);
        const list = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
        const items = list
            .map(simplifyClient)
            .sort((a, b) => (b.rxBytes + b.txBytes) - (a.rxBytes + a.txBytes))
            .slice(0, 12);
        return { items };
    } catch (error) {
        return { items: [], error };
    }
};

const fetchWanHealth = async () => {
    const response = await requestJson(`/proxy/network/api/s/${config.site}/stat/health`);
    const payload = Array.isArray(response?.data) ? response.data : response;
    const wanHealth = (payload || []).find(item => item?.subsystem === 'wan') || null;
    const wwwHealth = (payload || []).find(item => item?.subsystem === 'www') || null;
    const point = toMetricPoint(wanHealth, wwwHealth);
    const monthlyUsage = await fetchMonthlyUsage();
    const isp = wanHealth?.isp_name || wanHealth?.isp_organization || null;
    const wanIp = wanHealth?.wan_ip || null;
    const uptime = toNumber(wanHealth?.uptime_stats?.WAN?.availability);
    return {
        points: point ? [point] : [],
        status: point?.status || null,
        isp,
        wanIp,
        uptime,
        monthlyUsage,
        raw: response,
    };
};

const fetchSnapshot = async () => {
    const [metrics, clients] = await Promise.all([
        fetchWanHealth(),
        fetchActiveClients(),
    ]);
    return {
        ...metrics,
        clients,
    };
};

const watchStatus = async (cb, i = 1, t = 1, d = 0, n = 'unifi', o = {}) => {
    return event.loop(async () => {
        let resp = null;
        let err = null;
        try {
            resp = await fetchSnapshot();
        } catch (error) {
            err = error;
        }
        if (cb) { await cb(resp, err); }
    }, i, t, d, n, { silent: true, ...o });
};

export {
    fetchSnapshot as fetchMetrics,
    watchStatus,
};
