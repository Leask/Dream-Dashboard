# UniFi Gateway Traffic Dashboard

Terminal dashboard for real-time UniFi gateway throughput, latency, and event monitoring.

## Requirements

- Node.js 18 or newer.
- A UniFi OS Console or Gateway running the Site Manager API.
- A valid Site Manager API key stored in `config.json` at the project root.
- Local network access to the UniFi gateway (the app will auto-discover the default gateway IP).

## Configuration

Create or edit `config.json` before launching:

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

## Install

```console
npm install
```

## Run

```console
npm start
```

The dashboard polls the UniFi Network Application `stat/health` endpoint every second (via the local gateway at `/proxy/network/api/s/<site>/stat/health`) and draws:

- Gateway summary with live download/upload rates and latency.
- Throughput line chart (download vs upload in Mbps).
- Latency timeline (when reported by the API).
- Event log for successful updates and any API errors.

## Notes

- Metrics are fetched with the UniFi Site Manager API (`/proxy/network/v2/api`).
- Self-signed certificates are accepted by default; set `verifySsl` to `true` to enforce TLS validation.
- Ensure the API key has permissions to read internet metrics for the selected site.
