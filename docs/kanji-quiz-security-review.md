# Kanji Quiz dependency security review (2026-10-13)

Scope: existing Angular lockfile and static frontend Docker image. No versions changed in final hardening. npm audit reports **14 affected package nodes: 3 critical, 6 high, 5 moderate**, including parent packages, not 14 independent exploits. Production-only audit reports one high finding. Audit remains nonzero.

The Dockerfile builds with Node, then copies only dist/browser and nginx.conf into pinned NGINX. No Node runtime, node_modules, SSR, Express, MCP or test server is shipped. Lockfile dev flags and npm explain paths were inspected. These are deployment applicability conclusions, not exploit-test results.

| Package | Version | Severity | Applicability |
| --- | --- | --- | --- |
| @angular/build | 22.1.3 | critical | Build-only parent of Piscina; no production Node process. |
| @angular/cli | 22.1.3 | high | CLI-only parent of MCP SDK; MCP server is not started in production. |
| @angular/router | 22.1.1 | high | SSR-only advisory; this NGINX-hosted client SPA has no SSR worker. Not applicable to the inspected deployment. |
| @modelcontextprotocol/sdk | 1.29.0 | high | Development CLI OAuth/MCP integration; not shipped. Review before connecting CLI MCP to untrusted servers. |
| @vitest/mocker | 4.1.10 | moderate | Test-server file-read risk; not shipped. Do not expose test servers to untrusted clients. |
| fast-uri | 3.1.5 | high | Build/schema tooling URI parsing. No production SSRF boundary uses this package; hostile schemas remain a tooling concern. |
| hono | 4.13.1 | moderate | CLI/MCP tooling HTTP/JSX/SSG features; absent from production. |
| ip-address | 10.5.0 | moderate | Development tooling IP parsing/classification; absent from production. No application IP allowlist uses this package. |
| piscina | 5.2.0 | critical | Used in Angular builds. Exploitation requires a separate primitive that pollutes Object.prototype in the build process; none identified here. Residual build-chain risk. |
| proxy-addr | 2.0.7 | critical | Express via CLI MCP SDK. Requires a vulnerable IPv6 proxy trust configuration; production NGINX does not use this package. |
| qs | 6.15.3 | moderate | CLI HTTP tooling parser; absent from production. Hostile requests matter if development servers are exposed. |
| source-map-js | 1.2.1 | high | Build-time source-map parser. Hostile maps can affect build availability; public quiz payloads are never build inputs. |
| undici | 7.29.0 | high | jsdom/Vitest dependency; absent from production. Browser fetch and .NET/Quarkus do not use this npm package. Untrusted test network responses remain a tooling risk. |
| vitest | 4.1.10 | moderate | Test-only parent of mocker; no production Vitest server. |

## Primary advisory checks

- [Angular router advisory](https://github.com/angular/angular/security/advisories/GHSA-ff3f-86qr-9cv3) explicitly excludes client-only SPAs. Reassess and patch before enabling SSR. No Angular-wide upgrade is justified by this deployment-specific finding.
- [Piscina advisory](https://github.com/piscinajs/piscina/security/advisories/GHSA-67c8-pqhq-4rmx) requires prototype pollution in the consuming process. Angular build pins 5.2.0; no forced override without compatibility review. Track tooling remediation separately.
- [proxy-addr advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) requires a problematic proxy-trust subnet. This package is only under Angular CLI MCP/Express.

## Remaining risk

Development-only does not mean harmless: build workers, local servers, installation and CI can process hostile inputs. Keep privileged CI isolated from untrusted changes and do not expose development/test/MCP servers. No complete supply-chain proof, malicious-package analysis, container OS scan, Maven audit or NuGet audit was performed. No demonstrably exploitable production npm finding was identified in the inspected static SPA deployment; no unrelated upgrades or automatic audit fixes were applied.

Reproduce from angular: npm audit --json; npm audit --omit=dev; npm explain piscina proxy-addr undici fast-uri. New advisories may change results.
