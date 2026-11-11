
const LINK_RE = /(?:vmess|vless|trojan|ss|ssr|hysteria2|hy2|hysteria|tuic):\/\/[^\s"'<>]+/gi;
const CAMOUFLAGE = new Set([
    "ya.ru",
    "yandex.ru",
    "yandex.net",
    "yandex.com",
    "yastatic.net",
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "google.ru",
    "microsoft.com",
    "windows.com",
    "live.com",
    "office.com",
    "office.net",
    "microsoftonline.com",
    "apple.com",
    "icloud.com",
    "cdn-apple.com",
    "cloudflare.com",
    "cloudflare.net",
    "fastly.net",
    "fastly.com",
    "amazon.com",
    "amazonaws.com",
    "cloudfront.net",
    "akamai.net",
    "akamaihd.net",
    "akamaized.net",
    "github.com",
    "githubusercontent.com",
    "bing.com",
    "msn.com",
    "facebook.com",
    "fbcdn.net",
    "wikipedia.org",
    "adobe.com",
    "nvidia.com",
    "steamcommunity.com",
    "steampowered.com",
]);
const SKIP_PROTOCOL = new Set([
    "freedom",
    "blackhole",
    "dns",
    "loopback",
    "direct",
    "block",
]);
const SKIP_TAG = new Set(["direct", "block", "dns", "dns-out", "blocked"]);
function parseSubscription(input) {
    const warnings = [];
    const unwrapped = unwrapText(input);
    const text = unwrapped.text;
    if (!text) {
        return { sourceKind: "пусто", warnings: ["Пустой ввод."], nodes: [] };
    }
    let sourceKind = unwrapped.decoded ? "base64" : "текст";
    let nodes = [];
    if (/^\s*[\[{]/.test(text)) {
        try {
            const json = JSON.parse(text);
            const parsed = parseJsonValue(json, warnings);
            nodes = parsed.nodes;
            sourceKind = joinKind(sourceKind, parsed.kind);
        }
        catch (error) {
            warnings.push(`JSON не разобран: ${error instanceof Error ? error.message : "ошибка синтаксиса"}.`);
            nodes = parseLinks(text, warnings);
            if (nodes.length)
                sourceKind = joinKind(sourceKind, "ссылки");
        }
    }
    else {
        nodes = parseLinks(text, warnings);
        sourceKind = joinKind(sourceKind, nodes.length ? "ссылки" : "неизвестно");
    }
    if (!nodes.length && !warnings.length) {
        warnings.push("Узлов не нашлось. Нужен JSON Xray или ссылки vless/vmess/ss/trojan/hysteria2.");
    }
    if (/<html[\s>]/i.test(text) && !nodes.length) {
        warnings.push("Ответ похож на HTML, а не на подписку.");
    }
    return { sourceKind, warnings: cap(warnings), nodes };
}
function fingerprint(n) {
    return [
        n.protocol,
        n.network,
        n.security,
        n.address.trim().toLowerCase(),
        n.port ?? "",
        normCred(n.userId, n.credKind),
        n.method.trim().toLowerCase(),
        n.sni.trim().toLowerCase(),
        n.host.trim().toLowerCase(),
        n.path,
        n.publicKey,
    ].join("|");
}
function addressKind(host) {
    const h = host.trim().toLowerCase();
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(h))
        return "ipv4";
    if (h.includes(":"))
        return "ipv6";
    return "domain";
}
function registrable(host) {
    const h = host.trim().toLowerCase().replace(/\.$/, "");
    if (!h || addressKind(h) !== "domain")
        return h;
    const parts = h.split(".").filter(Boolean);
    if (parts.length <= 2)
        return parts.join(".");
    const second = parts[parts.length - 2] ?? "";
    const tld = parts[parts.length - 1] ?? "";
    if (tld.length === 2 &&
        /^(co|com|net|org|gov|ac|edu|ne|or)$/.test(second)) {
        return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
}
function isCamouflage(host) {
    const h = host.trim().toLowerCase().replace(/\.$/, "");
    if (!h || addressKind(h) !== "domain")
        return false;
    if (CAMOUFLAGE.has(h) || CAMOUFLAGE.has(registrable(h)))
        return true;
    return false;
}
function flagRegion(text) {
    const match = text.match(/\p{Regional_Indicator}{2}/u);
    if (!match)
        return "";
    return [...match[0]]
        .map((ch) => String.fromCodePoint((ch.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
        .join("");
}
function maskSecret(value) {
    if (!value)
        return "—";
    if (value.length <= 12)
        return "••••••";
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
function joinKind(base, next) {
    if (base === "текст")
        return next;
    if (base === "base64")
        return `base64 → ${next}`;
    return next;
}
function cap(warnings) {
    if (warnings.length <= 12)
        return warnings;
    return [...warnings.slice(0, 12), `…ещё ${warnings.length - 12} предупреждений`];
}
function warn(warnings, message) {
    warnings.push(message);
}
function unwrapText(input) {
    let text = input.replace(/^\uFEFF/, "").trim();
    let decoded = false;
    for (let i = 0; i < 2; i += 1) {
        if (!text)
            break;
        if (/^\s*[\[{]/.test(text) || text.includes("://"))
            break;
        const next = tryB64(text);
        if (!next)
            break;
        const trimmed = next.trim();
        if (!trimmed || trimmed === text)
            break;
        if (!/^\s*[\[{]/.test(trimmed) && !trimmed.includes("://"))
            break;
        text = trimmed;
        decoded = true;
    }
    return { text, decoded };
}
function tryB64(value) {
    const compact = value.replace(/\s+/g, "");
    if (compact.length < 16 || !/^[A-Za-z0-9+/_=-]+$/.test(compact))
        return null;
    try {
        const norm = compact.replace(/-/g, "+").replace(/_/g, "/");
        const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
        const bin = atob(pad);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1)
            bytes[i] = bin.charCodeAt(i);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        if (text.includes("\u0000"))
            return null;
        const printable = [...text].filter((ch) => ch >= " " || ch === "\n" || ch === "\r" || ch === "\t").length;
        if (printable / Math.max(text.length, 1) < 0.9)
            return null;
        return text;
    }
    catch {
        return null;
    }
}
function parseJsonValue(data, warnings) {
    if (Array.isArray(data)) {
        if (data.every((item) => typeof item === "string")) {
            return { nodes: parseLinks(data.join("\n"), warnings), kind: "ссылки" };
        }
        const nodes = [];
        let kind = "xray-json";
        for (const item of data) {
            const part = parseJsonValue(item, warnings);
            nodes.push(...part.nodes);
            if (part.kind !== "xray-json")
                kind = part.kind;
        }
        return { nodes, kind };
    }
    if (!data || typeof data !== "object")
        return { nodes: [], kind: "xray-json" };
    const record = data;
    if (Array.isArray(record.outbounds)) {
        const profile = str(record.remarks || record.remark || record.ps);
        const nodes = record.outbounds.flatMap((item) => outboundToNodes(item, profile, warnings));
        return { nodes, kind: "xray-json" };
    }
    if (Array.isArray(record.proxies)) {
        const nodes = record.proxies.flatMap((item) => clashToNodes(item, warnings).map(node=>({...node,sourceConfig:JSON.stringify(item)})));
        return { nodes, kind: "clash" };
    }
    if ((record.protocol || record.type) && (record.settings || record.server || record.streamSettings)) {
        return {
            nodes: outboundToNodes(record, str(record.remarks || record.tag), warnings),
            kind: record.server && !record.protocol ? "sing-box" : "xray-json",
        };
    }
    for (const key of ["configs", "servers", "subscription", "items", "data", "links"]) {
        if (!(key in record))
            continue;
        const inner = record[key];
        if (typeof inner === "string") {
            const unwrapped = unwrapText(inner);
            return {
                nodes: parseSubscription(unwrapped.text).nodes,
                kind: unwrapped.decoded ? "base64" : "вложение",
            };
        }
        return parseJsonValue(inner, warnings);
    }
    warn(warnings, "В JSON нет outbounds, proxies или списка ссылок.");
    return { nodes: [], kind: "json" };
}
function outboundToNodes(value, profile, warnings) {
    if (!value || typeof value !== "object")
        return [];
    const ob = value;
    if (ob.server && !ob.protocol && !ob.settings) {
        return singboxToNodes(ob, profile, warnings).map(node=>({...node,sourceConfig:JSON.stringify(ob)}));
    }
    const protocol = str(ob.protocol || ob.type).toLowerCase();
    const tag = str(ob.tag);
    if (!protocol || SKIP_PROTOCOL.has(protocol) || SKIP_TAG.has(tag.toLowerCase()))
        return [];
    const settings = asRecord(ob.settings);
    const stream = asRecord(ob.streamSettings);
    const hysteria = asRecord(stream.hysteriaSettings);
    const nodes = [];
    const vnext = Array.isArray(settings.vnext) ? settings.vnext : [];
    if (vnext.length) {
        for (const hop of vnext) {
            const rec = asRecord(hop);
            const users = Array.isArray(rec.users) && rec.users.length ? rec.users : [{}];
            for (const user of users) {
                const u = asRecord(user);
                nodes.push(makeNode({
                    protocol,
                    tag,
                    profile,
                    address: str(rec.address),
                    port: num(rec.port),
                    userId: str(u.id || u.password),
                    credKind: u.id ? "uuid" : u.password ? "password" : "none",
                    flow: str(u.flow),
                    method: str(u.method || u.security),
                    stream,
                }));
            }
        }
    }
    else if (Array.isArray(settings.servers) && settings.servers.length) {
        for (const server of settings.servers) {
            const rec = asRecord(server);
            nodes.push(makeNode({
                protocol,
                tag,
                profile,
                address: str(rec.address || rec.addr),
                port: num(rec.port),
                userId: str(rec.password || rec.auth),
                credKind: rec.password || rec.auth ? "password" : "none",
                flow: "",
                method: str(rec.method),
                stream,
            }));
        }
    }
    else if (settings.address || ob.address || hysteria.auth) {
        const userId = str(settings.password || settings.auth || hysteria.auth || ob.password);
        nodes.push(makeNode({
            protocol,
            tag,
            profile,
            address: str(settings.address || ob.address),
            port: num(settings.port ?? ob.port),
            userId,
            credKind: userId ? (protocol === "hysteria" || protocol === "hysteria2" ? "auth" : "password") : "none",
            flow: "",
            method: str(settings.method),
            stream,
            fpFallback: str(settings.fp || ob.fp),
        }));
    }
    else {
        warn(warnings, `Пропущен outbound без адреса (${tag || protocol}).`);
        return [];
    }
    return nodes.filter((node) => {
        if (!node.address) {
            warn(warnings, `Пропущен ${protocol} без адреса (${tag || "без тега"}).`);
            return false;
        }
        return true;
    }).map(node=>({...node,sourceConfig:JSON.stringify(ob)}));
}
function singboxToNodes(ob, profile, warnings) {
    const protocol = str(ob.type).toLowerCase();
    if (!protocol || SKIP_PROTOCOL.has(protocol))
        return [];
    const tls = asRecord(ob.tls);
    const reality = asRecord(tls.reality);
    const transport = asRecord(ob.transport);
    const userId = str(ob.uuid || ob.password || ob.auth);
    const node = makeNode({
        protocol,
        tag: str(ob.tag),
        profile: profile || str(ob.tag),
        address: str(ob.server),
        port: num(ob.server_port),
        userId,
        credKind: ob.uuid ? "uuid" : userId ? "password" : "none",
        flow: str(ob.flow),
        method: str(ob.method),
        stream: {
            network: str(transport.type || "tcp"),
            security: tls.enabled === false ? "none" : reality.enabled || reality.public_key ? "reality" : tls.enabled || tls.server_name ? "tls" : "none",
            tlsSettings: {
                serverName: tls.server_name,
                fingerprint: tls.utls && asRecord(tls.utls).fingerprint,
                alpn: tls.alpn,
            },
            realitySettings: {
                serverName: reality.server_name || tls.server_name,
                fingerprint: reality.fingerprint,
                publicKey: reality.public_key,
                shortId: reality.short_id,
            },
            wsSettings: { path: transport.path, headers: { Host: transport.host } },
        },
    });
    if (!node.address) {
        warn(warnings, "Пропущен sing-box outbound без server.");
        return [];
    }
    return [node];
}
function clashToNodes(value, warnings) {
    if (!value || typeof value !== "object")
        return [];
    const p = value;
    const protocol = str(p.type).toLowerCase();
    if (!protocol)
        return [];
    const reality = asRecord(p["reality-opts"]);
    const ws = asRecord(p["ws-opts"]);
    const grpc = asRecord(p["grpc-opts"]);
    const headers = asRecord(ws.headers);
    const userId = str(p.uuid || p.password || p.auth);
    const tlsOn = Boolean(p.tls) || protocol === "trojan";
    const node = makeNode({
        protocol: protocol === "ss" ? "shadowsocks" : protocol === "hy2" ? "hysteria2" : protocol,
        tag: str(p.name),
        profile: str(p.name),
        address: str(p.server),
        port: num(p.port),
        userId,
        credKind: p.uuid ? "uuid" : userId ? "password" : "none",
        flow: str(p.flow),
        method: str(p.cipher),
        stream: {
            network: str(p.network || (grpc["grpc-service-name"] ? "grpc" : "tcp")),
            security: reality["public-key"] ? "reality" : tlsOn ? "tls" : "none",
            tlsSettings: {
                serverName: p.sni || p.servername,
                fingerprint: p["client-fingerprint"],
                alpn: p.alpn,
            },
            realitySettings: {
                serverName: p.sni,
                publicKey: reality["public-key"],
                shortId: reality["short-id"],
                fingerprint: p["client-fingerprint"],
            },
            wsSettings: { path: ws.path, headers: { Host: headers.Host } },
            grpcSettings: { serviceName: grpc["grpc-service-name"] },
        },
    });
    if (!node.address) {
        warn(warnings, `Пропущен clash-узел без server (${str(p.name) || protocol}).`);
        return [];
    }
    return [node];
}
function makeNode(draft) {
    const stream = draft.stream;
    const tls = asRecord(stream.tlsSettings);
    const reality = asRecord(stream.realitySettings);
    const ws = asRecord(stream.wsSettings);
    const wsHeaders = asRecord(ws.headers);
    const xhttp = asRecord(stream.xhttpSettings);
    const grpc = asRecord(stream.grpcSettings);
    const upgrade = asRecord(stream.httpupgradeSettings);
    const network = str(stream.network || (draft.protocol.startsWith("hysteria") ? "hysteria" : "tcp")).toLowerCase();
    const security = str(stream.security || "none").toLowerCase();
    const sni = str(tls.serverName || reality.serverName);
    const host = str(wsHeaders.Host || xhttp.host || upgrade.host || grpc.authority);
    const path = str(ws.path || xhttp.path || upgrade.path || grpc.serviceName);
    const alpn = Array.isArray(tls.alpn) ? tls.alpn.map((item) => str(item)).filter(Boolean).join(",") : str(tls.alpn);
    const fragment = hasFragment(stream.finalmask);
    const address = draft.address.trim().replace(/\.$/, "");
    const clientFp = str(tls.fingerprint || reality.fingerprint || draft.fpFallback);
    const node = {
        protocol: draft.protocol,
        network,
        security,
        address,
        port: draft.port,
        addressKind: addressKind(address),
        sni,
        host,
        path,
        clientFp,
        flow: draft.flow,
        alpn,
        publicKey: str(reality.publicKey),
        shortId: str(reality.shortId),
        userId: draft.userId.trim(),
        credKind: draft.userId.trim() ? draft.credKind : "none",
        method: draft.method,
        fragment,
        profile: draft.profile,
        tag: draft.tag,
        labelCountry: flagRegion(draft.profile),
        fingerprint: "",
    };
    return { ...node, fingerprint: fingerprint(node) };
}
function hasFragment(value) {
    const mask = asRecord(value);
    const tcp = Array.isArray(mask.tcp) ? mask.tcp : [];
    return tcp.some((item) => asRecord(item).type === "fragment");
}
function parseLinks(text, warnings) {
    const found = text.match(LINK_RE) ?? [];
    if (!found.length && text.includes("://")) {
        warn(warnings, "Ссылки есть, но это не vless, vmess, ss, trojan или hysteria2.");
    }
    const nodes = [];
    for (const raw of found) {
        const link = raw.trim();
        const scheme = link.slice(0, link.indexOf("://")).toLowerCase();
        try {
            if (scheme === "vless" || scheme === "trojan")
                nodes.push({...parseStandard(link, scheme),sourceLink:link});
            else if (scheme === "vmess")
                nodes.push({...parseVmess(link),sourceLink:link});
            else if (scheme === "ss")
                nodes.push({...parseSs(link),sourceLink:link});
            else if (scheme === "hysteria2" || scheme === "hy2" || scheme === "hysteria")
                nodes.push({...parseHy(link, scheme),sourceLink:link});
            else if (scheme === "tuic")
                nodes.push({...parseStandard(link, "tuic"),sourceLink:link});
            else
                warn(warnings, `Схема ${scheme} не разбирается.`);
        }
        catch (error) {
            warn(warnings, `Не разобрана ссылка ${scheme}: ${error instanceof Error ? error.message : "ошибка"}.`);
        }
    }
    return nodes.filter((node) => node.address);
}
function parseStandard(link, protocol) {
    const { user, host, port, query, hash } = splitUri(link);
    const params = new URLSearchParams(query);
    const security = (params.get("security") || (protocol === "trojan" || protocol === "tuic" ? "tls" : "none")).toLowerCase();
    const network = (params.get("type") || params.get("network") || "tcp").toLowerCase();
    const sni = params.get("sni") || params.get("serverName") || params.get("peer") || "";
    const hostHeader = params.get("host") || params.get("authority") || "";
    const path = safeDecode(params.get("path") || params.get("serviceName") || "");
    return finalize({
        protocol: protocol === "hy2" ? "hysteria2" : protocol,
        network,
        security,
        address: host,
        port,
        sni,
        host: hostHeader,
        path,
        flow: params.get("flow") || "",
        alpn: (params.get("alpn") || "").replace(/,/g, ","),
        publicKey: params.get("pbk") || "",
        shortId: params.get("sid") || "",
        userId: safeDecode(user),
        credKind: protocol === "vless" || protocol === "tuic" ? "uuid" : "password",
        method: params.get("encryption") || "",
        fragment: Boolean(params.get("fragment") || params.get("packets")),
        profile: safeDecode(hash),
        tag: "",
        clientFp: params.get("fp") || "",
    });
}
function parseVmess(link) {
    const body = link.slice(link.indexOf("://") + 3).split("#")[0] ?? "";
    const decoded = tryB64(body);
    if (!decoded)
        throw new Error("vmess не base64");
    const json = JSON.parse(decoded);
    const tls = str(json.tls);
    return finalize({
        protocol: "vmess",
        network: str(json.net || "tcp").toLowerCase(),
        security: tls && tls !== "none" ? tls.toLowerCase() : "none",
        address: str(json.add || json.address),
        port: num(json.port),
        sni: str(json.sni),
        host: str(json.host),
        path: str(json.path),
        flow: "",
        alpn: str(json.alpn),
        publicKey: "",
        shortId: "",
        userId: str(json.id),
        credKind: "uuid",
        method: str(json.scy),
        fragment: false,
        profile: str(json.ps),
        tag: "",
        clientFp: str(json.fp),
    });
}
function parseSs(link) {
    const hashIdx = link.indexOf("#");
    const hash = hashIdx >= 0 ? safeDecode(link.slice(hashIdx + 1)) : "";
    let main = link.slice(link.indexOf("://") + 3);
    if (hashIdx >= 0)
        main = link.slice(link.indexOf("://") + 3, hashIdx);
    main = main.replace(/\?.*$/, "");
    let method = "";
    let password = "";
    let host = "";
    let port = null;
    if (main.includes("@")) {
        const at = main.lastIndexOf("@");
        const userinfo = safeDecode(main.slice(0, at));
        const parsedUser = splitMethodPassword(userinfo);
        method = parsedUser.method;
        password = parsedUser.password;
        const hp = splitHostPort(main.slice(at + 1));
        host = hp.host;
        port = hp.port;
    }
    else {
        const decoded = tryB64(main);
        if (!decoded || !decoded.includes("@"))
            throw new Error("ss без адреса");
        const at = decoded.lastIndexOf("@");
        const parsedUser = splitMethodPassword(decoded.slice(0, at));
        method = parsedUser.method;
        password = parsedUser.password;
        const hp = splitHostPort(decoded.slice(at + 1));
        host = hp.host;
        port = hp.port;
    }
    return finalize({
        protocol: "shadowsocks",
        network: "tcp",
        security: "none",
        address: host,
        port,
        sni: "",
        host: "",
        path: "",
        flow: "",
        alpn: "",
        publicKey: "",
        shortId: "",
        userId: password,
        credKind: "password",
        method,
        fragment: false,
        profile: hash,
        tag: "",
        clientFp: "",
    });
}
function parseHy(link, scheme) {
    const node = parseStandard(link, scheme === "hysteria" ? "hysteria" : "hysteria2");
    return {
        ...node,
        protocol: scheme === "hysteria" ? "hysteria" : "hysteria2",
        network: "hysteria",
        security: node.security === "none" ? "tls" : node.security,
        credKind: node.userId ? "auth" : "none",
    };
}
function splitMethodPassword(userinfo) {
    let decoded = userinfo;
    if (!decoded.includes(":")) {
        const maybe = tryB64(decoded);
        if (maybe?.includes(":"))
            decoded = maybe;
    }
    const index = decoded.indexOf(":");
    if (index < 0)
        return { method: "", password: decoded };
    return { method: decoded.slice(0, index), password: decoded.slice(index + 1) };
}
function splitUri(link) {
    const hashIdx = link.indexOf("#");
    const hash = hashIdx >= 0 ? link.slice(hashIdx + 1) : "";
    let rest = link.slice(link.indexOf("://") + 3);
    if (hashIdx >= 0)
        rest = link.slice(link.indexOf("://") + 3, hashIdx);
    const qIdx = rest.indexOf("?");
    const query = qIdx >= 0 ? rest.slice(qIdx + 1) : "";
    const main = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
    const at = main.lastIndexOf("@");
    if (at < 0)
        throw new Error("нет user@host");
    const hp = splitHostPort(main.slice(at + 1));
    return { user: main.slice(0, at), host: hp.host, port: hp.port, query, hash };
}
function splitHostPort(value) {
    if (value.startsWith("[")) {
        const end = value.indexOf("]");
        const host = end >= 0 ? value.slice(1, end) : value;
        const tail = end >= 0 ? value.slice(end + 1) : "";
        const port = tail.startsWith(":") ? num(tail.slice(1)) : null;
        return { host, port };
    }
    const colon = value.lastIndexOf(":");
    if (colon < 0)
        return { host: value, port: null };
    return { host: value.slice(0, colon), port: num(value.slice(colon + 1)) };
}
function finalize(input) {
    const address = input.address.trim().replace(/\.$/, "");
    const node = {
        protocol: input.protocol,
        network: input.network || "tcp",
        security: input.security || "none",
        address,
        port: input.port,
        addressKind: addressKind(address),
        sni: input.sni.trim(),
        host: input.host.trim(),
        path: input.path,
        clientFp: input.clientFp,
        flow: input.flow,
        alpn: input.alpn,
        publicKey: input.publicKey,
        shortId: input.shortId,
        userId: input.userId.trim(),
        credKind: input.userId.trim() ? input.credKind : "none",
        method: input.method,
        fragment: input.fragment,
        profile: input.profile,
        tag: input.tag,
        labelCountry: flagRegion(input.profile),
        fingerprint: "",
    };
    return { ...node, fingerprint: fingerprint(node) };
}
function normCred(value, kind) {
    const text = value.trim();
    if (!text)
        return "";
    if (kind === "uuid" || /^[0-9a-f-]{32,}$/i.test(text))
        return text.toLowerCase();
    return text;
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function str(value) {
    if (typeof value === "string")
        return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    return "";
}
function num(value) {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(n) || n <= 0 || n > 65535)
        return null;
    return Math.trunc(n);
}
function safeDecode(value) {
    try {
        return decodeURIComponent(value.replace(/\+/g, "%20"));
    }
    catch {
        return value;
    }
}





function analyze(parsed) {
    const groups = new Map();
    for (const node of parsed.nodes) {
        const current = groups.get(node.fingerprint);
        const profile = node.profile || node.tag;
        if (!current) {
            groups.set(node.fingerprint, {
                node,
                profiles: profile ? [profile] : [],
                hits: 1,
            });
        }
        else {
            current.hits += 1;
            if (profile && !current.profiles.includes(profile))
                current.profiles.push(profile);
        }
    }
    const nodes = [...groups.values()].map(({ node, profiles, hits }) => {
        const labels = [...new Set(profiles.map(flagRegion).filter(Boolean))];
        const identity = identityOf(node);
        const extras = relatedDomains(node).filter((domain) => domain !== identity.domain);
        return {
            ...node,
            identity: identity.domain ?? "ip",
            identitySource: identity.source,
            camouflageSni: identity.camouflage,
            otherDomains: extras,
            profiles,
            labelCountries: labels,
            labelCountry: labels[0] ?? node.labelCountry,
            dupCount: hits,
        };
    });
    nodes.sort((a, b) => {
        const domain = a.identity.localeCompare(b.identity, "ru");
        if (domain)
            return domain;
        const address = a.address.localeCompare(b.address, "ru");
        if (address)
            return address;
        return (a.port ?? 0) - (b.port ?? 0);
    });
    const domains = domainGroups(nodes);
    const facades = facadeCounts(nodes);
    const stats = buildStats(parsed.nodes.length, nodes);
    const score = buildScore(nodes, domains, stats);
    return {
        sourceKind: parsed.sourceKind,
        warnings: parsed.warnings,
        nodes,
        stats,
        domains,
        facades,
        score,
    };
}
function cmpEndpoint(node) {
    return `${node.address.trim().toLowerCase()}:${node.port ?? ''}:${node.protocol}`;
}
function cmpEndpointSecret(node) {
    return `${cmpEndpoint(node)}|${node.userId || ''}`;
}
function ipSetFor(nodes, resolvedHosts) {
    const set = new Set();
    for(const n of nodes) {
        if(n.addressKind !== 'domain') {
            if(isPublicIp(n.address)) set.add(n.address.toLowerCase());
        } else {
            for(const ip of resolvedHosts[n.address.toLowerCase()]?.ips || []) {
                if(isPublicIp(ip)) set.add(ip.toLowerCase());
            }
        }
    }
    return set;
}
function optionalSimilarity(a,b) {
    return a.size || b.size ? jaccard(a,b) : null;
}
function compareReports(a, b, network = {}) {
    const aNodes=a.nodes, bNodes=b.nodes;
    const mapB=new Map(bNodes.map(n=>[n.fingerprint,n]));
    const shared=aNodes.filter(n=>mapB.has(n.fingerprint));
    const onlyA=aNodes.filter(n=>!mapB.has(n.fingerprint));
    const sharedSet=new Set(shared.map(n=>n.fingerprint));
    const onlyB=bNodes.filter(n=>!sharedSet.has(n.fingerprint));
    const aExact=new Set(aNodes.map(n=>n.fingerprint)), bExact=new Set(bNodes.map(n=>n.fingerprint));
    const aEnd=new Set(aNodes.map(cmpEndpoint)), bEnd=new Set(bNodes.map(cmpEndpoint));
    const aCred=credSet(aNodes), bCred=credSet(bNodes);
    const aDomains=domainSet(aNodes), bDomains=domainSet(bNodes);
    const aKeys=keySet(aNodes),bKeys=keySet(bNodes);
    const aSignature=new Set(aNodes.map(cmpEndpointSecret)),bSignature=new Set(bNodes.map(cmpEndpointSecret));
    const aRootKeys=rootKeySet(aNodes),bRootKeys=rootKeySet(bNodes);
    const aTransports=transportSet(aNodes),bTransports=transportSet(bNodes);
    const endpointMapA=new Map(), endpointMapB=new Map();
    for(const n of aNodes) {const k=cmpEndpoint(n);if(!endpointMapA.has(k))endpointMapA.set(k,[]);endpointMapA.get(k).push(n)}
    for(const n of bNodes) {const k=cmpEndpoint(n);if(!endpointMapB.has(k))endpointMapB.set(k,[]);endpointMapB.get(k).push(n)}
    const sameEndpointDiffCredential=[], variantPairs=[];
    for(const [endpoint,listA] of endpointMapA) {
        const listB=endpointMapB.get(endpoint)||[];
        if(!listB.length)continue;
        const diff=listA.find(n=>listB.some(t=>n.userId&&t.userId&&n.userId!==t.userId));
        if(diff) {const target=listB.find(t=>diff.userId&&t.userId&&diff.userId!==t.userId);sameEndpointDiffCredential.push({endpoint,a:diff,b:target})}
        const variation=listA.find(n=>listB.some(t=>n.userId===t.userId&&n.fingerprint!==t.fingerprint));
        if(variation) {const target=listB.find(t=>variation.userId===t.userId&&variation.fingerprint!==t.fingerprint);variantPairs.push({endpoint,a:variation,b:target})}
    }
    const sameCredentialDiffEndpoint=[];
    const sharedCredList=[...aCred].filter(cred=>bCred.has(cred));
    for(const secret of sharedCredList) {
        const aList=aNodes.filter(n=>n.userId===secret),bList=bNodes.filter(n=>n.userId===secret);
        if(!aList.some(x=>bList.some(y=>cmpEndpoint(x)===cmpEndpoint(y)))) {
            sameCredentialDiffEndpoint.push({secret,a:aList.slice(0,4),b:bList.slice(0,4)});
        }
    }
    const sharedCreds=sharedCredList.map(secret=>({secret,domainsA:domainsForCred(aNodes,secret),domainsB:domainsForCred(bNodes,secret)}));
    const ipsA=ipSetFor(aNodes,network.hosts||{}),ipsB=ipSetFor(bNodes,network.hosts||{});
    const intA={asns:new Set(),prefixes:new Set()},intB={asns:new Set(),prefixes:new Set()};
    const addIntel=(set,result)=>{for(const ip of set){const info=network.ips?.[ip];if(info?.asn)result.asns.add(info.asn);if(info?.prefix)result.prefixes.add(info.prefix)}};
    addIntel(ipsA,intA);addIntel(ipsB,intB);
    const overlap={
        nodes:shared.length,nodeJaccard:jaccard(aExact,bExact),
        containmentA:aExact.size?shared.length/aExact.size:0,
        containmentB:bExact.size?shared.length/bExact.size:0,
        addresses:intersectionSize(aEnd,bEnd),addressJaccard:jaccard(aEnd,bEnd),
        creds:sharedCredList.length,credJaccard:optionalSimilarity(aCred,bCred)??0,
        domains:intersectionSize(aDomains,bDomains),domainJaccard:optionalSimilarity(aDomains,bDomains)??0,
        keys:intersectionSize(aKeys,bKeys),keyJaccard:optionalSimilarity(aKeys,bKeys)??0,
        variants:variantPairs.length,
        sameEndpointDiffCredential:sameEndpointDiffCredential.length,
        sameCredentialDiffEndpoint:sameCredentialDiffEndpoint.length,
        commonIps:intersectionSize(ipsA,ipsB),ipJaccard:optionalSimilarity(ipsA,ipsB)??0,
        commonAsns:intersectionSize(intA.asns,intB.asns),commonBgpPrefixes:intersectionSize(intA.prefixes,intB.prefixes),
        signatureMatches:intersectionSize(aSignature,bSignature),
        rootKeyMatches:intersectionSize(aRootKeys,bRootKeys),rootKeyJaccard:jaccard(aRootKeys,bRootKeys),
        transportMatches:intersectionSize(aTransports,bTransports),transportJaccard:jaccard(aTransports,bTransports),
        asnJaccard:optionalSimilarity(intA.asns,intB.asns)??0
    };
    const raw=[
        ['exact','Точные узлы',0.29,jaccard(aExact,bExact)],
        ['endpoint','Серверы',0.17,jaccard(aEnd,bEnd)],
        ['credential','Ключи',0.17,optionalSimilarity(aCred,bCred)],
        ['signature','Адрес + ключ',0.12,optionalSimilarity(aSignature,bSignature)],
        ['rootKey','Домен + ключ',0.08,optionalSimilarity(aRootKeys,bRootKeys)],
        ['transport','Сеть / TLS / SNI',0.07,optionalSimilarity(aTransports,bTransports)],
        ['reality','REALITY',0.04,optionalSimilarity(aKeys,bKeys)],
        ['domain','Домены',0.03,optionalSimilarity(aDomains,bDomains)],
        ['resolved','DNS / IP',0.02,network.hosts?optionalSimilarity(ipsA,ipsB):null],
        ['asn','ASN',0.01,intA.asns.size&&intB.asns.size?jaccard(intA.asns,intB.asns):null]
    ];
    const effective=raw.filter(x=>x[3]!==null), weight=effective.reduce((sum,x)=>sum+x[2],0);
    const total=weight?Math.round(100*effective.reduce((sum,x)=>sum+x[2]*x[3],0)/weight):0;
    const similarity={total,level:total>=85?'Почти одинаковы':total>=55?'Высокое':total>=25?'Частичное':total>0?'Низкое':'Нет совпадений',components:effective.map(([id,title,w,ratio])=>({id,title,ratio,value:Math.round(ratio*100),weight:w}))};
    return {a,b,overlap,similarity,shared,onlyA,onlyB,sharedCreds,
        sameEndpointDiffCredential, sameCredentialDiffEndpoint, variantPairs,
        commonDomains:[...aDomains].filter(v=>bDomains.has(v)).sort(),
        onlyDomainsA:[...aDomains].filter(v=>!bDomains.has(v)).sort(),
        onlyDomainsB:[...bDomains].filter(v=>!aDomains.has(v)).sort(),
        sharedRealityKeys:[...aKeys].filter(v=>bKeys.has(v)),
        sharedAsns:[...intA.asns].filter(v=>intB.asns.has(v)).sort(),
        sharedBgpPrefixes:[...intA.prefixes].filter(v=>intB.prefixes.has(v)).sort(),
        verdict:similarity.level};
}
function identityOf(node) {
    const camouflage = node.sni && isCamouflage(node.sni)
        ? registrable(node.sni)
        : node.host && isCamouflage(node.host)
            ? registrable(node.host)
            : "";
    if (node.addressKind === "domain" && node.address) {
        return { domain: registrable(node.address), source: "address", camouflage };
    }
    if (node.sni && !isCamouflage(node.sni) && !node.sni.includes(":")) {
        return { domain: registrable(node.sni), source: "sni", camouflage };
    }
    if (node.host && !isCamouflage(node.host) && !node.host.includes(":") && node.host.includes(".")) {
        return { domain: registrable(node.host), source: "host", camouflage };
    }
    return { domain: null, source: "ip", camouflage };
}
function relatedDomains(node) {
    const found = new Set();
    for (const host of [node.address, node.sni, node.host]) {
        if (!host || host.includes(":") || !host.includes("."))
            continue;
        if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host))
            continue;
        if (isCamouflage(host))
            continue;
        found.add(registrable(host));
    }
    return [...found];
}
function domainGroups(nodes) {
    const credDomains = new Map();
    for (const node of nodes) {
        if (!node.userId || node.identity === "ip")
            continue;
        const key = node.userId;
        const set = credDomains.get(key) ?? new Set();
        set.add(node.identity);
        credDomains.set(key, set);
    }
    const map = new Map();
    for (const node of nodes) {
        if (node.identity === "ip")
            continue;
        const current = map.get(node.identity) ?? {
            domain: node.identity,
            count: 0,
            hosts: [],
            protocols: [],
            creds: 0,
            exclusiveCreds: 0,
            viaSni: 0,
            hostSet: new Set(),
            protoSet: new Set(),
            credSet: new Set(),
        };
        current.count += 1;
        if (node.identitySource === "sni" || node.identitySource === "host")
            current.viaSni += 1;
        const host = node.addressKind === "domain" ? node.address : node.sni || node.host;
        if (host)
            current.hostSet.add(host);
        current.protoSet.add(node.protocol);
        if (node.userId)
            current.credSet.add(node.userId);
        map.set(node.identity, current);
    }
    return [...map.values()]
        .map((group) => {
        let exclusive = 0;
        for (const cred of group.credSet) {
            const homes = credDomains.get(cred);
            if (homes && homes.size === 1 && homes.has(group.domain))
                exclusive += 1;
        }
        return {
            domain: group.domain,
            count: group.count,
            hosts: [...group.hostSet].sort((a, b) => a.localeCompare(b)).slice(0, 8),
            protocols: [...group.protoSet].sort(),
            creds: group.credSet.size,
            exclusiveCreds: exclusive,
            viaSni: group.viaSni,
        };
    })
        .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}
function facadeCounts(nodes) {
    const map = new Map();
    for (const node of nodes) {
        if (!node.camouflageSni)
            continue;
        map.set(node.camouflageSni, (map.get(node.camouflageSni) ?? 0) + 1);
    }
    return [...map.entries()]
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count);
}
function buildStats(records, nodes) {
    const addresses = new Set(nodes.map((node) => node.address.toLowerCase()));
    const direct = nodes.filter((node) => node.addressKind !== "domain");
    const domains = nodes.filter((node) => node.addressKind === "domain");
    const creds = new Set(nodes.map((node) => node.userId).filter(Boolean));
    const brands = new Set(nodes.map((node) => node.identity).filter((item) => item !== "ip"));
    return {
        records,
        uniqueNodes: nodes.length,
        uniqueAddresses: addresses.size,
        directIps: new Set(direct.map((node) => node.address)).size,
        domainAddresses: new Set(domains.map((node) => node.address.toLowerCase())).size,
        brandDomains: brands.size,
        credentials: creds.size,
        protocols: tally(nodes.map((node) => node.protocol || "—")),
        networks: tally(nodes.map((node) => node.network || "tcp")),
        duplicateRecords: Math.max(0, records - nodes.length),
    };
}

function provenanceMetrics(report,enrichment={}) {
    const nodes=report.nodes||[];
    const roots=new Map(), keys=new Map(), rootsByIp=new Map(), crossNetwork=new Map();
    const ips=enrichment.ips||{},hosts=enrichment.hosts||{};
    const knownIps=new Set(), allIps=new Set(), allAsns=new Set(), countries=new Set();
    let sniMismatch=0, namedSni=0, crossRootKeys=0, unmatchedDns=0;
    for(const n of nodes) {
        const root=n.identity==='ip'?'IP / прямые':n.identity;
        let g=roots.get(root);
        if(!g){g={root,count:0,hosts:new Set(),keys:new Set(),asns:new Set(),countries:new Set(),ips:new Set(),protocols:new Set(),prefixes:new Set()};roots.set(root,g)}
        g.count++;g.hosts.add(n.address);g.protocols.add(n.protocol);
        if(n.userId){g.keys.add(n.userId);if(!keys.has(n.userId))keys.set(n.userId,new Set());keys.get(n.userId).add(root)}
        if(n.sni&&!isCamouflage(n.sni)&&!isIp(n.sni)) {
            namedSni++;
            if(n.addressKind==='domain' && registrable(n.address)!==registrable(n.sni))sniMismatch++;
        }
        const host=n.address.toLowerCase();
        const destIps=n.addressKind==='domain'?(hosts[host]?.ips||[]):[host];
        if(n.addressKind==='domain'&&hosts[host]?.error)unmatchedDns++;
        for(const ip of destIps){
            if(!isPublicIp(ip))continue;
            allIps.add(ip);g.ips.add(ip);
            const detail=ips[ip];if(!detail||detail.error)continue;
            knownIps.add(ip);
            if(detail.asn){g.asns.add(detail.asn);allAsns.add(detail.asn);if(!crossNetwork.has(detail.asn))crossNetwork.set(detail.asn,new Set());crossNetwork.get(detail.asn).add(root)}
            if(detail.prefix)g.prefixes.add(detail.prefix);
            if(detail.country){g.countries.add(detail.country);countries.add(detail.country)}
        }
    }
    for(const list of keys.values())if(list.size>1&&![...list].every(x=>x==='IP / прямые'))crossRootKeys++;
    const rootGroups=[...roots.values()].map(g=>({root:g.root,count:g.count,hosts:g.hosts.size,keys:g.keys.size,asns:[...g.asns],countries:[...g.countries],ips:g.ips.size,protocols:[...g.protocols],prefixes:g.prefixes.size}))
      .sort((a,b)=>b.count-a.count||a.root.localeCompare(b.root));
    const domainGroups=rootGroups.filter(g=>g.root!=='IP / прямые');
    const independent=domainGroups.filter(g=>[...keys.entries()].some(([secret,rs])=>rs.size===1&&rs.has(g.root))).length;
    const linkedAsns=[...crossNetwork.values()].filter(v=>v.size>1).length;
    const totalAsns=allAsns.size;
    const credentialIslands=[...keys.values()].filter(rs=>rs.size===1).length;
    return {rootCount:domainGroups.length,rootGroups,credCount:keys.size,crossRootKeys,credentialIslands,independentRoots:independent,
        sniMismatch,namedSni,allIps:allIps.size,knownIps:knownIps.size,asnCount:totalAsns,countries:countries.size,linkedAsns,unmatchedDns,
        intelCoverage:allIps.size?Math.round(100*knownIps.size/allIps.size):0,
        directCount:nodes.filter(n=>n.addressKind!=='domain').length,
        duplicateCount:nodes.reduce((sum,n)=>sum+Math.max(0,n.dupCount-1),0)};
}
function isIp(value) {return addressKind(value)!=='domain'}
function rootKeySet(nodes){return new Set(nodes.filter(n=>n.userId).map(n=>n.identity+'|'+n.userId))}
function transportSet(nodes){return new Set(nodes.map(n=>[n.address.toLowerCase(),n.port,n.protocol,n.network,n.security,n.sni].join('|')))}

function buildScore(nodes, domains, stats, enrichment = {}) {
    const clamp01=x=>Math.max(0,Math.min(1,x));
    const clamp100=x=>Math.round(Math.max(0,Math.min(100,x)));
    const rootNodes=nodes.filter(n=>n.identity!=='ip');
    const rootList=[...new Set(rootNodes.map(n=>n.identity))];
    const rootCount=rootList.length;
    const rootIndex=new Map(rootList.map((root,i)=>[root,i]));
    const parents=rootList.map((_,i)=>i);
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i};
    const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a};
    const credRoots=new Map(),pubRoots=new Map(),endpointRoots=new Map();
    function addTo(map,k,root){if(!k)return;const set=map.get(k)||new Set();set.add(root);map.set(k,set)}
    for(const n of rootNodes){
        addTo(credRoots,n.userId,n.identity);
        addTo(pubRoots,n.publicKey,n.identity);
        addTo(endpointRoots,`${n.address.toLowerCase()}:${n.port ?? ''}`,n.identity);
    }
    for(const map of [credRoots,pubRoots,endpointRoots]) {
        for(const roots of map.values()) {
            const list=[...roots];for(let i=1;i<list.length;i++)join(rootIndex.get(list[0]),rootIndex.get(list[i]));
        }
    }
    const linkedComponents=new Set(rootList.map((_,i)=>find(i))).size;
    const isolatedCreds=[...credRoots.values()].filter(roots=>roots.size===1).length;
    const sharedCreds=[...credRoots.values()].filter(roots=>roots.size>1).length;
    const distinctCreds=credRoots.size;
    const balances=domains.map(d=>d.count),size=balances.reduce((sum,x)=>sum+x,0)||1;
    const entropy=rootCount>1?-balances.reduce((sum,count)=>{const p=count/size;return sum+p*Math.log(p)},0)/Math.log(rootCount):0;
    const diversity=(rootCount<=1?0:rootCount===2?42:rootCount===3?61:rootCount<=5?75:Math.min(100,82+Math.log2(rootCount/5)*11));
    const domainScore=clamp100(diversity*(0.65+0.35*clamp01(entropy)));
    const isolation=distinctCreds?isolatedCreds/distinctCreds:0;
    const credMagnitude=Math.min(1,Math.log2(1+distinctCreds)/3.3);
    const credScore=rootCount<=1?0:clamp100((30+70*credMagnitude)*isolation*clamp01((rootCount-1)/3));
    const componentScore=rootCount<=1?0:clamp100(100*(linkedComponents-1)/Math.max(1,rootCount-1)*(0.58+0.42*Math.min(1,(rootCount-1)/4)));
    const allPublicIps=new Set(), allAsns=new Set(), allPrefixes=new Set(), countries=new Set();
    const asnRoots=new Map(), networkRoots=new Map();
    const hostInfo=enrichment.hosts||{}, ipInfo=enrichment.ips||{};
    for(const node of nodes){
        const ips=node.addressKind==='domain' ? (hostInfo[node.address.toLowerCase()]?.ips||[]) : [node.address];
        for(const ip of ips){
            if(!isPublicIp(ip))continue;
            allPublicIps.add(ip);
            const root=node.identity==='ip'?`IP:${node.address}`:node.identity;
            const detail=ipInfo[ip]||{};
            if(detail.asn){allAsns.add(detail.asn);addTo(asnRoots,detail.asn,root)}
            if(detail.prefix)allPrefixes.add(detail.prefix);
            if(detail.country)countries.add(detail.country);
            const subnet=ip.includes('.')?ip.split('.').slice(0,3).join('.')+'.0/24':ip.split(':').slice(0,3).join(':')+'::/48';
            addTo(networkRoots,subnet,root);
        }
    }
    const networkCount=allAsns.size||networkRoots.size;
    const networkDiversity=networkCount<=1?0:networkCount===2?35:networkCount===3?55:Math.min(100,65+8*(networkCount-4));
    const sharingMap=allAsns.size?asnRoots:networkRoots;
    let sharedNetworks=0;
    for(const roots of sharingMap.values())if(roots.size>1)sharedNetworks++;
    const networkScore=clamp100(networkDiversity*(1-.36*sharedNetworks/Math.max(1,networkCount)));
    const topology=provenanceMetrics({nodes},enrichment);
    const countrySpread=Math.min(100,Math.max(0,countries.size-1)*28);
    const geoScore=clamp100(networkScore*.84+countrySpread*.16);
    const sniScore=topology.namedSni?clamp100(100*topology.sniMismatch/topology.namedSni):0;
    let total=clamp100(domainScore*.26+credScore*.28+componentScore*.27+geoScore*.14+sniScore*.05);
    if(rootCount===0){
        const credsDirect=clamp100(100*Math.min(1,Math.log2(1+distinctCreds)/3));
        const splitDirect=clamp100(100*Math.min(1,Math.max(0,allAsns.size-1)/4));
        const directTotal=geoScore*.47+credsDirect*.30+splitDirect*.23;
        total=Math.min(allAsns.size>=2?85:allAsns.size===1?38:32,clamp100(directTotal));
    }
    else if(rootCount===1)total=Math.min(12,Math.round(geoScore*.08));
    if(rootCount>=2 && linkedComponents===1 && sharedCreds>0) total=Math.min(total,30);
    const factors=[
       {id:'domains',title:'Доменные группы',weight:.26,value:domainScore,detail:String(rootCount)},
       {id:'credentials',title:'Независимые ключи',weight:.28,value:credScore,detail:`${isolatedCreds} / ${distinctCreds}`},
       {id:'sources',title:'Раздельные компоненты',weight:.27,value:componentScore,detail:`${linkedComponents} / ${rootCount}`},
       {id:'networks',title:'ASN / география',weight:.14,value:geoScore,detail:`${allAsns.size} ASN · ${countries.size} GEO`},
       {id:'sni',title:'SNI / адрес',weight:.05,value:sniScore,detail:`${topology.sniMismatch} / ${topology.namedSni}`}

    ];
    const label=total>=75?'Высокий':total>=50?'Повышенный':total>=25?'Средний':'Низкий';
    return {total,label,factors,narrative:`${rootCount} ROOT · ${isolatedCreds} KEY · ${linkedComponents} GROUP`,evidence:{roots:rootCount,independentCredentials:isolatedCreds,sharedCredentials:sharedCreds,linkedComponents,asns:allAsns.size,bgpPrefixes:allPrefixes.size,resolvedIps:allPublicIps.size,intelCoverage:topology.intelCoverage,sniMismatch:topology.sniMismatch,countries:countries.size}};
}
function rescore(report,enrichment={}) {
    report.score=buildScore(report.nodes,report.domains,report.stats,enrichment);
    return report.score;
}
function tally(values) {
    const map = new Map();
    for (const value of values)
        map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
}
function credSet(nodes) {
    return new Set(nodes.map((node) => node.userId).filter(Boolean));
}
function addressSet(nodes) {
    return new Set(nodes.map((node) => `${node.address.toLowerCase()}:${node.port ?? ""}:${node.protocol}`));
}
function domainSet(nodes) {
    return new Set(nodes.map((node) => node.identity).filter((item) => item !== "ip"));
}
function keySet(nodes) {
    return new Set(nodes.map((node) => node.publicKey).filter(Boolean));
}
function domainsForCred(nodes, secret) {
    return [...new Set(nodes.filter((node) => node.userId === secret).map((node) => node.identity))].sort();
}
function intersectionSize(a, b) {
    let count = 0;
    for (const item of a)
        if (b.has(item))
            count += 1;
    return count;
}
function jaccard(a, b) {
    if (!a.size && !b.size)
        return 1;
    const inter = intersectionSize(a, b);
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
}


// Локальные агрегаты, безопасная сериализация и валидация адресов.
function extendedMetrics(report) {
  const nodes = report.nodes || [];
  const hosts = new Set(nodes.map(n => n.address.toLowerCase()));
  const endpoints = new Set(nodes.map(n => `${n.address.toLowerCase()}:${n.port ?? ''}`));
  const ips = new Set(nodes.filter(n => n.addressKind !== 'domain').map(n=>n.address.toLowerCase()));
  const hostnames = new Set(nodes.filter(n => n.addressKind === 'domain').map(n=>n.address.toLowerCase()));
  const roots = new Set(nodes.map(n => n.identity).filter(n=>n!=='ip'));
  return {
    records: report.stats.records, uniqueNodes: nodes.length,
    endpointHosts: hosts.size, endpoints: endpoints.size,
    directIps: ips.size, namedHosts: hostnames.size,
    rootDomains: roots.size,
    protocolCount: new Set(nodes.map(n=>n.protocol)).size,
    credentials: new Set(nodes.map(n=>n.userId).filter(Boolean)).size,
    repeated: report.stats.duplicateRecords,
    directConnections: nodes.filter(n=>n.addressKind!=='domain').length,
    riskScore: report.score.total
  };
}
function ipv4Private(address) {
  const m=address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a,b,c,d]=m.slice(1).map(Number);
  if([a,b,c,d].some(n=>n>255)) return true;
  return a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&b===168 || a===100&&b>=64&&b<=127 || a===192&&b===0&&c===0 || a===198&&(b===18||b===19) || a===192&&b===0&&c===2 || a===198&&b===51&&c===100 || a===203&&b===0&&c===113;
}
function isPublicIp(address) {
  const host=String(address).toLowerCase().replace(/^\[|\]$/g,'');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return !ipv4Private(host);
  if (!host.includes(':')) return false;
  return !(host==='::' || host==='::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('ff') || host.startsWith('2001:db8:') || host.startsWith('::ffff:') || host.startsWith('2001:0:'));
}
function safeNetworkTarget(input) {
  let url;
  try { url=new URL(String(input).trim()); } catch { return {ok:false,error:'Некорректный URL'}; }
  if (!['https:','http:'].includes(url.protocol)) return {ok:false,error:'Поддерживаются только HTTP и HTTPS'};
  if (url.username || url.password) return {ok:false,error:'Встроенные в URL логин и пароль не поддерживаются'};
  if (url.href.length>8192) return {ok:false,error:'Слишком длинный URL'};
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if (!host || host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')&&!host.includes(':')) return {ok:false,error:'Локальные адреса не поддерживаются'};
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) {
    if(!isPublicIp(host)) return {ok:false,error:'Частные и зарезервированные IP не поддерживаются'};
  }
  return {ok:true,url:url.href};
}
function exportSanitized(report, enrichment={ips:{},hosts:{}}) {
  return {
    format:'Subscope sanitized report 1.0', createdAt:new Date().toISOString(),
    sourceKind:report.sourceKind,
    metrics:extendedMetrics(report),
    risk:{index:report.score.total,label:report.score.label,factors:report.score.factors.map(f=>({title:f.title,value:f.value,weight:f.weight}))},
    domains:report.domains,
    nodes:report.nodes.map(n=>({
      protocol:n.protocol, transport:n.network, security:n.security,
      address:n.address, port:n.port, type:n.addressKind, domain:n.identity,
      sni:n.sni, host:n.host, userType:n.credKind,
      fingerprint:n.clientFp, flow:n.flow,
      repetitions:n.dupCount
    })),
    ipInfo:Object.values(enrichment.ips||{}).map(i=>({ip:i.ip,asn:i.asn,prefix:i.prefix,org:i.org,country:i.country,region:i.region,city:i.city,error:i.error})),
    resolvedHosts:enrichment.hosts||{}
  };
}


export {parseSubscription,analyze,compareReports,rescore,provenanceMetrics,registrable,maskSecret,addressKind,isCamouflage,extendedMetrics,safeNetworkTarget,isPublicIp,exportSanitized};
