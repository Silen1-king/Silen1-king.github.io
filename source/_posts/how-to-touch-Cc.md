---
title: how to touch Cc
date: 2026-10-24
updated: 2026-10-30 15:15:50
description: 很多人问我使用 Cc 不怕被封吗，其实很怕，不过目前没事，分享一下使用方法：一份由 codex 生成的 Clash Verge 住宅代理链项目规则，可以直接复制丢给 agent。
categories: AI
tags:
  - vpn
  - network
  - proxy
  - clash-verge
  - mihomo
  - dns-leak
---

很多人问我使用Cc不怕被封吗，其实很怕，不过目前没事，分享一下使用方法。有一个codex的管理这个VPN的项目，以下是项目规则，配置的时候可以用另一个agent负责检查和监督
（电脑时区记得要与IP一致）

tips：

1. 无法保证100%没事
2. 我被封号了会下架这篇文章
3. 如果采用了我的方法被封了，我说一声抱歉，但不能怪我，请怪gpt，他教我的。

![alt text](</images/posts/how-to-touch-Cc/屏幕截图 2026-10-24 132826.png>)

![alt text](/images/posts/how-to-touch-Cc/image-1.png)

全文由codex生成，照搬的可以直接复制以下内容丢给agent

## Reusable project rules: Clash Verge residential chain

分享版整理日期：2026-10-24。来源：本项目当前 `AGENTS.md`。

他人可将本文保存为自己项目的 `AGENTS.md`，作为 AI 助手和维护者的工作规则。本文不是可直接导入 Clash Verge 的配置脚本。

使用前须在自己的私有规范脚本中配置住宅代理端点和凭据，并准备本文引用的脚本、测试和说明文件；如更换文件名或代理名称，应同步修改规则、实现及测试。不得复制原项目的代理账号、订阅或控制器密钥。

本分享版移除了原部署的出口 IP、配置/脚本 ID、历史实测结果及供应商账户限制；接收者必须自行验证。这些规则不代表接收者当前网络已通过验收。

### Project purpose

This project maintains a Clash Verge Rev / Mihomo enhancement script for a chained residential route:

```text
managed traffic
  -> 🏠 住宅业务专线
  -> Residential-ISP
  -> 🚀 住宅前置机场
  -> currently selected airport node
  -> residential Internet egress
```

The primary goal is to keep target AI model services, creative generation platforms (e.g., `muse.ai`), community platforms (Reddit and its first-party content domains), IP/DNS leak tests, target diagnostic endpoints, and explicitly managed STUN traffic on the residential egress without forcing unrelated traffic through it.

### Authoritative files

Treat these as the current source of truth:

- `clash-verge-residential-chain.js` — canonical Clash Verge JavaScript `main(config)` transformation.
- `test-clash-verge-residential-chain.js` — canonical static and idempotence test.
- `Clash-Verge-Residential-Chain-Writeup.md` — design decisions, deployment notes, validation, and rollback guidance.
- `last-deployment.json` — last deployment record only; it is a hint rather than proof of the currently active profile.
- `verify-target-ai.py` — read-only runtime verification for target AI platforms and residential egress.
- `verify-chat-service.py` — read-only runtime verification for managed chat services residential chain, including shared control hosts.

Before changing or checking the configuration, read the canonical script and test. Do not infer the intended configuration from old YAML snapshots, backups, browser profiles, screenshots, or generated `clash-verge.yaml` files.

The following helpers currently contain legacy group names such as `高风控服务`, `前置节点选择`, an older residential group name, and `日常外网`:

- `audit-clash-runtime.ps1`
- `audit-final-config.ps1`
- `test-front-nodes.ps1`

Do not treat their pass/fail results as authoritative for the current emoji-named script until they have been explicitly migrated and reviewed. `verify-residential-egress.ps1` retains its baseline filename; prefer the checks documented below.

### Required configuration invariants

When reviewing or modifying `clash-verge-residential-chain.js`, preserve all of these invariants unless the user explicitly asks to change the architecture.

#### Residential proxy

- There must be exactly one proxy named `Residential-ISP`.
- Its type must be `socks5`.
- Its server and port must match the current residential provider endpoint in the canonical script; never infer them from backups.
- In normal operation, its `dialer-proxy` must be `🚀 住宅前置机场`.
- Do not copy its username or password into `AGENTS.md`, reports, logs, screenshots, or public documentation.
- Treat the canonical script as the only local source for current endpoint credentials.
- `udp: true` is required on `Residential-ISP` so the exact managed STUN targets use SOCKS5 UDP relay. The static test must assert this field, and deployment verification must confirm it appears in the generated Mihomo configuration.
- Do not broaden this to all UDP traffic. If the service cannot relay UDP, the managed STUN requests should fail closed rather than fall back to the airport or `DIRECT`.

#### Direct-dial diagnostic switch

- `DEBUG_DIRECT` must exist near the top of the canonical script and default to `false`.
- When `DEBUG_DIRECT` is `false`, `Residential-ISP` must contain `dialer-proxy: 🚀 住宅前置机场`.
- When `DEBUG_DIRECT` is `true`, the script must omit the residential proxy's `dialer-proxy` field so a temporary direct-connect comparison can distinguish local-to-Residential-ISP reachability from airport-to-Residential-ISP reachability.
- `DEBUG_DIRECT=true` is diagnostic only. Do not leave it enabled for normal deployment, and do not reinterpret it as permission to add `DIRECT` to the dynamic front group or weaken any routing rule.
- The static test must exercise both switch states.

#### Dynamic front group

- `🚀 住宅前置机场` must be a `select` group built dynamically from `config.proxies`.
- Never hard-code one airport node name as the only front route.
- Exclude `Residential-ISP` and built-ins such as `DIRECT`, `REJECT`, `REJECT-DROP`, `PASS`, `COMPATIBLE`, and `GLOBAL`.
- Exclude empty, duplicate, invalid, and subscription-notice entries such as remaining traffic, reset time, expiry, suggestions, official-site, and subscription messages.
- If no usable airport node exists, use `REJECT`. Never silently fall back to `DIRECT`. Direct comparison is allowed only through the explicit `DEBUG_DIRECT` diagnostic switch.

#### Residential business group

- `🏠 住宅业务专线` must be a `select` group containing `Residential-ISP` and `DIRECT`.
- Normal operation requires `Residential-ISP` to be selected.
- `DIRECT` is a manual emergency/debug bypass, not the normal selection.

#### Rule priority

- The managed rule block must remain at the very top of `config.rules`.
- Keep the comments `// [INJECT-START]` and `// [INJECT-END]` around that block.
- Keep the transformation idempotent: repeated profile reloads must not duplicate proxies, groups, or rules.
- Preserve Rule mode.

The canonical managed destinations include:

- Standard IP check services: `ipinfo.io`, `whoer.net`, `browserleaks.com`, and `ip138.com`.
- Managed AI platform domains (e.g., `cc.ai`, `vendor.com`, and static/content asset CDNs).
- AI platform keyword match rules.
- Common anti-bot and authentication services: `challenges.cloudflare.com` and `auth0.com`.
- `DOMAIN-SUFFIX,muse.ai,🏠 住宅业务专线` so Muse and all of its `muse.ai` subdomains use the residential egress.
- The exact Reddit first-party suffix rules `reddit.com`, `redd.it`, `redditstatic.com`, and `redditmedia.com` so the site, short links, images, and static assets use the residential egress together.
- The exact STUN targets already present in the canonical script: `stun.l.google.com:19302`, `stun.cloudflare.com:3478`, and their tested IP rules. Host/IP changes must be established from a fresh runtime capture rather than inferred from the detected UDP exit IP.
- Custom diagnostic/test domains routed through `🏠 住宅业务专线` so test pages measure the residential route rather than the airport exit.
- `1.1.1.1/32` for the Cloudflare Trace request used by diagnostic pages.
- The exact chat platform suffix rules so web apps, APIs, authentication, static assets, and generated content share the residential egress.

Route diagnostic test domains through the residential business group as well as its residential DNS policy so diagnostic tests measure the residential route rather than the airport exit. Keep rules exact to target suffixes and do not broaden to unrelated traffic.

Route `muse.ai` through the residential business group and add `+.muse.ai` to the residential DNS policy. Keep the route exact to the `muse.ai` suffix; do not use a broad `DOMAIN-KEYWORD,muse` rule or add unrelated third-party domains without runtime evidence.

Route `reddit.com`, `redd.it`, `redditstatic.com`, and `redditmedia.com` through the residential business group and add their corresponding `+.` entries to the residential DNS policy. Keep these as exact `DOMAIN-SUFFIX` rules; do not use a broad `DOMAIN-KEYWORD,reddit` rule or add third-party advertising, analytics, or CDN domains without fresh runtime evidence.

Do not broaden the configuration to all UDP or all STUN traffic merely to satisfy a leak-test page. Exact target rules are intentional and avoid breaking games, calls, QUIC, and other UDP applications.

#### DNS

Preserve these properties:

- DNS enabled.
- IPv6 disabled in both the global configuration and DNS.
- `fake-ip` enhanced mode with `198.18.0.1/16`.
- `prefer-h3` `false`.
- `respect-rules` `false`.
- General encrypted external resolvers dial through `🚀 住宅前置机场`.
- Proxy bootstrap resolution uses the configured mainland encrypted DoH servers to avoid a DNS/proxy startup cycle.
- Direct-domain resolution uses the configured mainland encrypted DoH servers for local CDN behavior.
- Managed residential domains use DoH through `🏠 住宅业务专线` via `nameserver-policy`.
- `fallback` and `fallback-filter` must remain absent because concurrent fallback queries previously exposed mainland DNS resolvers.
- Existing unrelated `nameserver-policy` entries must be preserved.

#### Target AI routing behavior

- Target AI platforms are managed residential destinations, added on explicit user request.
- Route target entry points and inference APIs through the residential business group and add their corresponding `+.` entries to the residential DNS policy.
- Runtime backend dependencies and control plane hosts are also configured as exact residential suffixes with matching `+.` DNS entries.
- Keep these as exact `DOMAIN-SUFFIX` rules; avoid overly broad `DOMAIN-KEYWORD` rules.
- Do not add shared public account endpoints or shared corporate platform services to the residential group without a separate explicit decision; they affect unrelated daily traffic.
- Strip legacy exact `DOMAIN` rules or obsolete broad keyword rules so only exact suffix rules remain.

#### Managed Chat platform behavior

- Managed chat services are residential destinations, configured on explicit requirement.
- Route first-party chat endpoints (web interface, API endpoints, auth services) plus static/asset CDNs through the residential business group, with matching `+.` DNS policy entries.
- Keep these as exact `DOMAIN-SUFFIX` rules; do not use broad `DOMAIN-KEYWORD` rules.
- Do not add third-party shared endpoints (e.g., third-party voice streaming relay, unrelated analytics, public CDN infrastructure) without separate verification.

#### TUN

- Preserve the user’s existing TUN `enable` and `stack` choices.
- When TUN is enabled, require `auto-route`, `auto-detect-interface`, and `strict-route`.
- DNS hijack must cover both `any:53` and `tcp://any:53`.
- Do not enable IPv6 unless a complete, separately verified IPv6 proxy and DNS design is requested.

### Static-test coverage requirements

The canonical static test must explicitly assert all of the following:

- `tun.auto-route` is `true`.
- `tun.auto-detect-interface` is `true`.
- `tun.strict-route` is `true`.
- `dns-hijack` contains exactly `any:53` and `tcp://any:53`.
- `fake-ip-range` is `198.18.0.1/16`.
- General encrypted resolvers, proxy bootstrap resolvers, direct-domain resolvers, and residential-policy resolvers use their required paths.
- Each managed diagnostic domain, `muse.ai`, `reddit.com`, `redd.it`, `redditstatic.com`, and `redditmedia.com` suffix rule occurs exactly once and remains inside the leading managed rule block.
- Each managed AI service and its runtime-dependency suffix rule occurs exactly once, remains inside the leading managed rule block, and has a matching residential `nameserver-policy` entry; shared corporate endpoints remain outside the residential rules.
- Each managed chat service suffix rule occurs exactly once, remains inside the leading managed rule block, and has a matching residential `nameserver-policy` entry.
- Each corresponding residential `nameserver-policy` entry exists exactly once and uses the residential business group.
- Empty, duplicate, invalid, built-in, residential, managed-group, and subscription-notice entries cannot enter the dynamic front group.
- Both `DEBUG_DIRECT` states, fail-closed behavior, group contents, syntax, idempotence, and preservation of unrelated configuration remain covered.

### How to inspect this project

When the user asks to check, audit, confirm, or diagnose the setup, begin with read-only work. An inspection request does not authorize deployment or edits to the Clash Verge application directory.

Use this order:

1. Read this file, the canonical JavaScript, its test, and the write-up.
2. Run the static test:

```powershell
node .\test-clash-verge-residential-chain.js
```

3. Confirm that the test checks syntax, idempotence, filtering, fail-closed behavior, both `DEBUG_DIRECT` states, group contents, the unique high-priority target rules, residential DNS policies, and TUN fields.
4. Determine the actually active Clash Verge profile and attached script from the current profiles metadata. Do not assume that the profile ID or script ID in `last-deployment.json` is still active after a subscription change.
5. Compare the active script hash with the workspace canonical script. Report divergence before proposing a deployment.
6. Inspect the generated Mihomo configuration or controller state without printing controller secrets, subscription URLs, usernames, or passwords.
7. Perform runtime probes only if Clash Verge/Mihomo is running.

If the user only asks whether the setup is healthy, do not edit the source script, active profile, current group selection, or application configuration.

### Runtime acceptance checks

A complete health check should establish all of the following.

#### Group state

- Both current groups exist: `🚀 住宅前置机场` and `🏠 住宅业务专线`.
- The front group contains real nodes from the active subscription.
- It contains no forbidden built-ins, residential node, managed group, or notice entries.
- A real airport node is selected in the front group.
- `Residential-ISP` is selected in the residential business group.

If a subscription refresh removed or renamed the previously selected node, expect the select group to reset. This is not proof that the script failed; choose and test a current healthy front node.

#### Route and egress

Use the active Mihomo mixed HTTP port rather than assuming a default port. A preferred targeted probe is:

```powershell
curl.exe -x http://127.0.0.1:<MIXED_PORT> https://ipinfo.io/ip
```

Establish the residential egress with fresh managed requests in the recipient environment. Do not infer it from the proxy endpoint address or reuse another deployment's exit IP. Recheck after endpoint, subscription, or provider changes.

Also check:

```powershell
curl.exe -x http://127.0.0.1:<MIXED_PORT> https://1.1.1.1/cdn-cgi/trace
curl.exe -I -x http://127.0.0.1:<MIXED_PORT> https://target-service.example.com/
curl.exe -I -x http://127.0.0.1:<MIXED_PORT> https://www.baidu.com/
```

Acceptance:

- `ipinfo.io` reports the residential egress.
- Cloudflare Trace reports the same residential IP.
- Target managed service establishes TLS and returns an HTTP response.
- A domestic site remains usable and is not unintentionally forced through the residential route.

If controller connection details are inspected, the chain for a managed request should include the residential business group, `Residential-ISP`, the front group, and the selected airport node. It must not fall back to `DIRECT` for normal managed traffic.

Run several consecutive probes when judging a front node. A node that opens ordinary websites may still fail the airport-to-residential SOCKS5 TCP chain intermittently.

#### Deployment-specific evidence

- Establish provider authentication, UDP relay support, restrictions, and session limits from the recipient's current provider configuration and documentation.
- Do not add TLS, SNI, or credential suffixes without provider evidence.
- Record the actual active profile and attached script locally; do not assume another deployment's identifiers apply.
- Establish HTTP, HTTPS, DNS, and WebRTC results separately using fresh probes.
- A local TLS-client error is inconclusive for proxy connectivity; use a working TLS client to complete HTTPS verification.
- Configuration intent and successful parsing do not prove runtime connectivity or stability.
- Restore `DEBUG_DIRECT=false` immediately after an explicitly authorized direct-connect comparison.

#### DNS and WebRTC

- Trigger the DNS leak test from the intended browser/test page and wait for its asynchronous probes.
- No unintended mainland DNS server should be exposed for the managed test.
- Check that TUN is enabled when system-wide leak protection is expected.
- Confirm UDP and TCP port 53 hijacking and IPv6 disabled state.
- The WebRTC/STUN test must not expose the local public IP or the airport exit IP.
- The two exact managed STUN targets should either report the residential egress through SOCKS5 UDP relay or return no public candidate as a fail-closed result. They must not report the local public IP or the airport exit IP.
- When diagnosing a mismatch, capture active UDP connections from the Mihomo controller and report only the target host/IP, port, matched rule, and chain. Never print the controller secret. Do not mistake the detected UDP exit IP for a STUN destination rule.
- Do not claim HTTPS, DNS, WebRTC, or SOCKS5 UDP success from an HTTP egress check alone. SOCKS5 UDP is successful only after a fresh WebRTC/STUN test reports the residential egress; `udp: true` by itself proves only configuration intent.

### Subscription changes

#### Subscription node switching semantics

- The subscription's ordinary selector groups, such as `节点选择` or `🤖 AI服务`, are independent from `🚀 住宅前置机场`.
- Changing a node in an ordinary subscription selector must not be described as changing the residential chain.
- Changing the selection inside `🚀 住宅前置机场` changes the upstream airport leg of the residential chain.
- A successful front-node change should preserve the residential exit IP, but existing connections may reset and the new node may fail to reach the residential SOCKS5 endpoint over TCP or UDP.
- Do not switch the active front node during an inspection unless the user explicitly requests a switching test.
- After an explicitly requested front-node switch, run at least three consecutive residential egress probes, then perform fresh browser DNS-leak and WebRTC/STUN tests.
- If the selected front node disappears after a subscription refresh, report the reset and test a currently available real node; never fall back to `DIRECT`.

After updating the same subscription:

1. Re-run the static test.
2. Reload the profile.
3. Confirm the front group was rebuilt from the new `config.proxies`.
4. Confirm the previous selection still exists or select a new healthy node.
5. Repeat the targeted egress, DNS, WebRTC, and domestic-site checks.

After switching to a different profile or subscription:

1. Verify that the canonical Script is actually attached to the new active profile.
2. If the two managed groups disappear, first suspect that the Script is not attached or did not execute.
3. If the new configuration uses only `proxy-providers` and exposes no usable nodes through `config.proxies`, the current dynamic collector may require an intentional redesign. Do not silently weaken it to `DIRECT`.

Changing the selected front node should keep the residential exit IP unchanged. Existing long-lived connections may reset once; new connections should use the new airport-to-residential chain.

### Change and deployment protocol

For requested changes:

1. Edit the workspace canonical script first.
2. Update its test in the same change.
3. Run `node --check .\clash-verge-residential-chain.js` and the canonical Node test.
4. Check the generated configuration with Mihomo when available.
5. Before writing outside the workspace, resolve and verify the exact active profile and target path.
6. Create a timestamped backup of every application file that will be changed.
7. Deploy only after the user has requested configuration changes; a check or diagnosis request alone is not deployment authorization.
8. Reload/restart Clash Verge Rev as required.
9. Run the full runtime acceptance checks.
10. Preserve and report the rollback path.

Do not overwrite a whole Clash Verge configuration directory, delete profiles, or use a broad restore operation. Restore only the explicitly modified files from a verified backup.

### Security and reporting

- Never print or reproduce the HTTP proxy password, username, subscription URL/token, or Mihomo controller secret unless the user explicitly requires a local secret comparison and the output can remain redacted.
- Redact secrets from command output and final reports.
- Do not copy live browser profile data, cookies, history, or caches into diagnostics.
- Prefer concise PASS/FAIL reporting for every acceptance item, with the observed safe values such as group name, selected node name, exit IP, HTTP status, and DNS/WebRTC result.
- Distinguish static script correctness, active-config correctness, and live-network correctness. Passing one layer does not prove the others.
- If a proposed fix could affect unrelated traffic, explain the scope before applying it and prefer exact domain/IP rules over global changes.
