# Privacy and observable data

CAW targets pseudonymous participation. This alpha does not provide network anonymity or encrypted private messaging. Public ownership, funding, signed actions and settlement can link activity even when a person uses a pseudonym.

| Surface | Present behavior | Remaining exposure or decision |
| --- | --- | --- |
| Drafts, search and saved views | In-tab state; no keystroke or search request is implemented | The browser, extensions and device may observe local activity; an exported file persists separately |
| Environment and fixture loading | Relative bundled files; credentials and referrers omitted; redirects refused; bounded input | A remote static host would see requests and network metadata; these controls do not hide an IP address |
| Local images and video | User-selected blob previews; no upload or remote preview service | Original file metadata remains in the file; preview is not sanitization, encryption or malware analysis |
| External links | User navigation; portable entry pages declare `no-referrer` | The destination still sees the visit and any information in the chosen URL |
| Future public chain and relays | Not connected to the frontend | Addresses, transaction timing, sizes and payment relationships require an explicit exposure model |
| Future private messages | Not implemented | Content encryption, retrieval privacy, key rotation, recovery and ownership transfer need separate reviewed designs |

The current browser sources contain no analytics, automatic link previews, service-worker registration, persistent browser-storage API or background network client. Local search operates on the record already held by the app. These source-level observations do not establish properties of a future host, browser extension or modified client. The local server's content policy blocks remote connections; a separate static host must configure its own response headers. Page-level referrer policy travels with the two entry pages, while the server's full header policy does not.

Future transport work must specify which participants can correlate sending, retrieval and settlement. Encryption alone does not answer that question. Multiple endpoints alone do not establish private retrieval, operator independence or authenticated chain state. Retain only information needed for a stated function, with explicit retention and deletion limits; public chain records cannot be recalled by deleting a frontend copy.

Historical private-message access after an NFT transfer and deletion of old decryption keys require a recorded specification decision. A promise to erase old keys can conflict with a promise to give a later owner access to old messages. No key-transfer or retention rule is adopted here, and the preserved manifesto is unchanged.

Before a public test candidate: map each outbound request and its observable data, review media metadata handling, resolve DM key/transfer behavior, test endpoint failure and alternate-client recovery, and publish measurable claims with their assumptions. These gates supplement the existing [roadmap](ROADMAP.md), [frontend policy](FRONTEND_POLICY.md) and [source conflicts](../sources/SPEC_CONFLICTS.md).
