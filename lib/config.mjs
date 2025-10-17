import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { utilitas } from 'utilitas';

const { __dirname } = utilitas.__(import.meta.url);
const configPath = join(__dirname, '..', 'config.json');
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

const loadConfig = () => {
    if (cachedConfig) { return cachedConfig; }
    let fileConfig = {};
    try {
        const raw = readFileSync(configPath, 'utf8');
        fileConfig = raw ? JSON.parse(raw) : {};
    } catch (err) {
        utilitas.throwError('config.json is missing or invalid.', 400);
    }
    const merged = { ...defaults, ...fileConfig };
    if (!merged.apiKey) {
        utilitas.throwError('apiKey is required in config.json.', 400);
    }
    merged.gateway = merged.gateway || discoverGateway();
    cachedConfig = merged;
    return merged;
};

export {
    configPath,
    loadConfig,
};
