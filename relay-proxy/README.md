# Relay proxy

A Cloudflare Worker that passes everything on to the real relay (`relay.femboy-client.net`), so the relay can be reached from a network that blocks that address. It only ever talks to the relay, so it is not an open proxy.

## Set it up from a phone

1. Open dash.cloudflare.com in the phone's browser and sign in.
2. Go to Workers & Pages, then Create, then Worker. Name it (for example `femboy-relay-proxy`) and deploy the starter.
3. Press Edit code, delete what is there, paste all of `worker.js`, and press Deploy.
4. Open `https://<the worker's address>/__proxy`. A green dot means the relay answers through the proxy.

The worker's address looks like `femboy-relay-proxy.<your-name>.workers.dev`.

## Point the client at it

The client reads the relay's address from `relay.json`, which is signed. To send clients through the proxy, put the worker's address in `relay.json` and sign it again with the release key, the same way as any other change to that file. An unsigned change is thrown away by the client.

## Settings

All optional, under Worker > Settings > Variables and Secrets.

| Name | Kind | Meaning |
| --- | --- | --- |
| `UPSTREAM` | text | The relay's real address. Defaults to `https://relay.femboy-client.net`. |

## Good to know

- Some networks block `workers.dev` too. If so, give the worker a custom domain (Worker > Settings > Domains & Routes).
- The relay sees Cloudflare's address instead of each player's own. The player's address is still passed along in the `CF-Connecting-IP` header.
