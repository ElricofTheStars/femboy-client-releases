// Femboy relay proxy: a Cloudflare Worker that passes everything it receives on to the real relay, so the relay can still
// be reached from a network that blocks its address. Paste this whole file into the Worker's code editor (see README.md
// next to this file). It works from a phone's browser: no computer or command line is needed.
//
// What it does:
//   - Every request (any method, any path, WebSockets too) is sent on to UPSTREAM unchanged, and the answer is sent back.
//   - GET /__proxy shows a small status page: whether the relay answers through this proxy, and how fast.
//
// What it does not do: it is not an open proxy. It only ever talks to the one UPSTREAM address.
//
// Settings (Worker > Settings > Variables and Secrets), all optional:
//   UPSTREAM  text  the relay's real address (defaults to the one below)

const DEFAULT_UPSTREAM = "https://relay.femboy-client.net";
const STATUS_PATH = "/__proxy";
const CHECK_MILLIS = 8000;

export default {
	async fetch(request, env) {
		let upstream;
		try {
			upstream = new URL((env && env.UPSTREAM) || DEFAULT_UPSTREAM);
		} catch (e) {
			return text(500, "UPSTREAM is not a valid address.");
		}
		const url = new URL(request.url);
		// Pointing the proxy at itself would make it call itself for ever.
		if (upstream.host === url.host) return text(508, "UPSTREAM points at this proxy itself.");
		if (request.method === "GET" && url.pathname === STATUS_PATH) return status(upstream);
		return forward(request, url, upstream);
	},
};

// ---------------------------------------------------------------- passing requests on

async function forward(request, url, upstream) {
	const target = new URL(url.pathname + url.search, upstream);
	let answer;
	try {
		// Redirects are handed back to the client instead of followed, so it sees exactly what the relay said.
		answer = await fetch(new Request(target, request), { redirect: "manual" });
	} catch (e) {
		return text(502, "The relay could not be reached.");
	}
	// A WebSocket (status 101) has to go back exactly as it came.
	if (answer.status === 101) return answer;

	// A redirect to the relay's own address would lead straight back to the blocked name: point it at this proxy instead.
	const location = answer.headers.get("Location");
	if (location && location.startsWith(upstream.origin)) {
		const headers = new Headers(answer.headers);
		headers.set("Location", url.origin + location.slice(upstream.origin.length));
		return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers });
	}
	return answer;
}

// ---------------------------------------------------------------- the status page

async function status(upstream) {
	const started = Date.now();
	let line, good = false;
	try {
		const answer = await fetch(upstream.origin + "/", { redirect: "manual", signal: AbortSignal.timeout(CHECK_MILLIS) });
		// Any answer at all, even "not found", means the relay is there and talking.
		good = answer.status < 500;
		line = `The relay answered (${answer.status}) in ${Date.now() - started} ms.`;
	} catch (e) {
		line = "The relay did not answer.";
	}
	const page = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Femboy relay proxy</title>
<style>
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff0f6; color: #4a2337; font: 16px/1.5 system-ui, sans-serif; }
	main { margin: 16px; padding: 24px; max-width: 420px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px #e9a8c540; }
	h1 { margin: 0 0 8px; font-size: 20px; }
	.dot { display: inline-block; width: 12px; height: 12px; margin-right: 8px; border-radius: 50%; background: ${good ? "#3cb371" : "#e5484d"}; }
	p { margin: 8px 0 0; }
	small { color: #8a6477; overflow-wrap: anywhere; }
	@media (prefers-color-scheme: dark) { body { background: #24141c; color: #fbdfeb; } main { background: #321c28; box-shadow: none; } small { color: #c79bb0; } }
</style>
<main>
	<h1><span class="dot"></span>${good ? "Proxy is working" : "Relay unreachable"}</h1>
	<p>${escape(line)}</p>
	<p><small>Passing requests on to ${escape(upstream.origin)}</small></p>
</main>
</html>`;
	return new Response(page, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// ---------------------------------------------------------------- small things

function escape(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function text(status, body) {
	return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
