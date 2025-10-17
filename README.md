# UniFi Gateway Dashboard

Terminal dashboard for real-time UniFi gateway throughput, latency, infrastructure inventory, and client activity.

## Requirements

- Node.js 18 or newer.
- A UniFi OS Console or Gateway running the Site Manager API.
- A valid Site Manager API key stored in `config.json` at the project root.
- Local network access to the UniFi gateway (the app will auto-discover the default gateway IP).

## Configuration

Configuration values are merged in the following order (later sources override earlier ones):

1. Built-in defaults (`site="default"`, `verifySsl=false`).
2. Project-local `config.json` (optional).
3. User-level config `~/.dream-dashboard.json` (optional).
4. CLI flags (e.g. `--api-key=...`, `--gateway=...`).

Create or edit whichever file suits your workflow (local or `~/.dream-dashboard.json`). Example content:

```json
{
  "apiKey": "YOUR_UNIFI_API_KEY",
  "site": "default",
  "gateway": null,
  "verifySsl": false
}
```

- `apiKey` *(required)* – UniFi Site Manager API key.
- `site` *(optional)* – Site identifier, defaults to `default`.
- `gateway` *(optional)* – Override the auto-discovered gateway IP.
- `verifySsl` *(optional)* – Set `true` if the gateway presents a trusted certificate.

CLI overrides use the same keys in kebab- or camel-case form. Examples:

```console
npm start -- --api-key=YOUR_KEY --gateway=192.168.1.1
node -- dashboard.mjs --site=prod --verify-ssl=true
```

## Install

```console
npm install
```

## Run

```console
npm start
# or
npx dashboard
```

The dashboard polls the UniFi Network Application every second (mainly `/proxy/network/api/s/<site>/stat/health`) and draws:

- Gateway summary with live download/upload rates, WAN IP, uptime, and monthly usage.
- UniFi device inventory (switches, APs, gateway, etc.).
- Latency timeline (when reported by the API).
- Throughput line chart (download vs upload in Mbps).
- Active client leaderboard with running totals.
- Event log for successful updates and any API errors.

## Notes

- Metrics and topology data are fetched with the UniFi Site Manager API (`/proxy/network/api/s/<site>/stat/health`, `/stat/device`, and `/clients/active`).
- Self-signed certificates are accepted by default; set `verifySsl` to `true` to enforce TLS validation.
- Ensure the API key has permissions to read health, device, and client information for the selected site.
