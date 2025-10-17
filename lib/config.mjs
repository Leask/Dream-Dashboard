import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { utilitas } from 'utilitas';

const { __dirname } = utilitas.__(import.meta.url);
const workspaceConfigPath = join(__dirname, '..', 'config.json');
const homeConfigPath = join(os.homedir(), '.dream-dashboard.json');
const defaults = { site: 'default', gateway: null, verifySsl: false };
let cachedConfig = null;

const parseGateway = (output = '') => {
    const match = output.match(/(?:default|via)\s+(\d+\.\d+\.\d+\.\d+)/i);
    return match ? match[1] : null;
};

const discoverGateway = () => {
    const commands = [
        'ip route get 1.1.1.1',
        'ip route',
        'route -n get default',
        'netstat -rn',
    ];
    for (const command of commands) {
        try {
            const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const gw = parseGateway(output);
            if (gw) { return gw; }
        } catch (err) { /* ignore */ }
    }
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const info of interfaces[name]) {
            if (info.family === 'IPv4' && !info.internal) {
                const octets = info.address.split('.');
                if (octets.length === 4) { return `${octets.slice(0, 3).join('.')}.1`; }
            }
        }
    }
    return '192.168.1.1';
};

const readJsonFile = (path) => {
    try {
        const raw = readFileSync(path, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        if (err.code === 'ENOENT') { return {}; }
        utilitas.throwError(`${path} is missing or invalid JSON.`, 400);
    }
}; 

const parseBoolean = (value) => {
    if (value === undefined || value === null) { return undefined; }
    if (typeof value === 'boolean') { return value; }
    if (typeof value === 'number') { return value !== 0; }
    const lowered = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(lowered)) { return true; }
    if (['0', 'false', 'no', 'n'].includes(lowered)) { return false; }
    return undefined;
};

const parseCliOverrides = () => {
    const overrides = {};
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        if (!arg.startsWith('--')) { continue; }
        arg = arg.replace(/^--/, '');
        let [key, value] = arg.split('=');
        if (value === undefined) {
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                value = next;
                i += 1;
            } else {
                value = 'true';
            }
        }
        const normalizedKey = key
            .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
            .replace(/[^a-zA-Z0-9]/g, '');
        if (!normalizedKey) { continue; }
        if (normalizedKey === 'verifySsl') {
            const parsed = parseBoolean(value);
            if (parsed !== undefined) { overrides.verifySsl = parsed; }
            continue;
        }
        overrides[normalizedKey] = value;
    }
    return overrides;
};

const loadConfig = () => {
    if (cachedConfig) { return cachedConfig; }

    const workspaceConfig = readJsonFile(workspaceConfigPath);
    const homeConfig = readJsonFile(homeConfigPath);
    const cliOverrides = parseCliOverrides();

    const merged = {
        ...defaults,
        ...workspaceConfig,
        ...homeConfig,
        ...cliOverrides,
    };

    if (!merged.apiKey) {
        utilitas.throwError('apiKey is required (set via config.json, ~/.dream-dashboard.json, or CLI).', 400);
    }
    const parsedVerify = parseBoolean(merged.verifySsl);
    merged.verifySsl = parsedVerify !== undefined ? parsedVerify : defaults.verifySsl;
    if (merged.site !== undefined && merged.site !== null) {
        merged.site = String(merged.site).trim() || defaults.site;
    }
    if (merged.gateway !== undefined && merged.gateway !== null) {
        merged.gateway = String(merged.gateway).trim() || null;
    }
    merged.gateway = merged.gateway || discoverGateway();

    cachedConfig = merged;
    return merged;
};

export {
    workspaceConfigPath as configPath,
    loadConfig,
};
