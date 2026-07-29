# Changelog

## [3.5.0](https://github.com/zirkelc/chunkdown/compare/v3.4.0...v3.5.0) (2026-07-29)


### Features

* label A/B benchmark sides with branch and commit ([5623db7](https://github.com/zirkelc/chunkdown/commit/5623db75fd4cadf4ab7d80aa69f015bb08e3765f))


### Bug Fixes

* keep unknown gfm transforms in the sizing parse ([f56844b](https://github.com/zirkelc/chunkdown/commit/f56844b77b7632435e55fecbd28b64525d7895ed))


### Performance Improvements

* ~32% faster splitting via parse-free sizing fast paths ([39d16d2](https://github.com/zirkelc/chunkdown/commit/39d16d241f02ef9a7bc5f2c6d5a4593ae6f21e3c))
* analyze code nodes without re-parsing in text splitter ([2ad8d41](https://github.com/zirkelc/chunkdown/commit/2ad8d41fc1bd986b2460dd42bd9ba0bfec882433))
* analyze simple link-bearing lines without re-parsing in text splitter ([971ad6f](https://github.com/zirkelc/chunkdown/commit/971ad6fb65d89e733046698312c5e2f894b04e39))
* build parser and serializer extensions once at module scope ([418d751](https://github.com/zirkelc/chunkdown/commit/418d751a5da15efa80836036389249f657545358))
* collect link definitions with a flow-only walk ([02cc62f](https://github.com/zirkelc/chunkdown/commit/02cc62f7047275b653e1f66b9cce2e31d997ddbe))
* drop the autolink-literal transform from parsing ([c45aae7](https://github.com/zirkelc/chunkdown/commit/c45aae7c97074d9ac0986a478b7c261a9ef7fb6b))
* extend fast line analysis to multi-line paragraphs ([1fd39c7](https://github.com/zirkelc/chunkdown/commit/1fd39c76ab07a2f5e18319aecea37964e553614b))
* fast line analysis supports inline code spans ([a5dd2ba](https://github.com/zirkelc/chunkdown/commit/a5dd2ba9f5e2c5c1e2e4ef6973b1658c459dae0d))
* fast line analysis supports unambiguous asterisk emphasis ([6a289df](https://github.com/zirkelc/chunkdown/commit/6a289dfa04cf14daa7b469c8617ddaa5ee867a41))
* select best split boundary with a linear scan instead of sorting ([4e37f70](https://github.com/zirkelc/chunkdown/commit/4e37f70aa5573320478cb1ab7917a24c8eaad21b))
* size plain prose without parsing ([efe6572](https://github.com/zirkelc/chunkdown/commit/efe657297cb8dc1e1ffaa6d23f9ba45d5de492b9))
* size prose with backslash escapes without parsing ([154d913](https://github.com/zirkelc/chunkdown/commit/154d913ec583acb5edba92ee9c3a5ed343480cb9))
* size prose with inline code spans without parsing ([eb5fbb3](https://github.com/zirkelc/chunkdown/commit/eb5fbb3d3341c7b79525e7ca63ffb022717801c2))
* size prose with literal brackets without parsing ([aae7799](https://github.com/zirkelc/chunkdown/commit/aae7799e300bd21c589b92f2966bec6c979d8bf0))
* size prose with unambiguous asterisk emphasis without parsing ([fa927bc](https://github.com/zirkelc/chunkdown/commit/fa927bc9a316c659fab1ac0fa973d5c042754364))
* size prose with well-formed inline links without parsing ([54d077f](https://github.com/zirkelc/chunkdown/commit/54d077f4b2a524c3815969fe40635913b2a071e4))
* size unclosed backtick code fences without parsing ([a55c10d](https://github.com/zirkelc/chunkdown/commit/a55c10dc6e589be19ce983ec1e3c3433f1e250b9))
* skip autolink-literal transform when parsing only for content size ([acd2997](https://github.com/zirkelc/chunkdown/commit/acd29976af73fc77d614c66563f955cf401197a0))
* split recursion over boundary windows instead of adjusted copies ([ad884f4](https://github.com/zirkelc/chunkdown/commit/ad884f40f59b5d6a906ddd7442ff1050f3b28a4e))

## [3.4.0](https://github.com/zirkelc/chunkdown/compare/v3.3.0...v3.4.0) (2026-05-02)


### Features

* export defaultNodeRules ([9470dc8](https://github.com/zirkelc/chunkdown/commit/9470dc884878622944747a0e933fdb1e11e719d4))

## [3.3.0](https://github.com/zirkelc/chunkdown/compare/v3.2.1...v3.3.0) (2026-05-02)


### Features

* add word rule for in-word splitting ([bb298cc](https://github.com/zirkelc/chunkdown/commit/bb298cc29208fd135c5eeefd90c8e33923b6a349))


### Bug Fixes

* format ([f6da2b4](https://github.com/zirkelc/chunkdown/commit/f6da2b4878250a6c952bcf0fc47c750c682aae89))
* split oversized headings instead of emitting verbatim ([e231620](https://github.com/zirkelc/chunkdown/commit/e23162031b9151aa03113b2e44e1b29dee365da7))

## [3.2.1](https://github.com/zirkelc/chunkdown/compare/v3.2.0...v3.2.1) (2026-03-24)


### Bug Fixes

* optimize performance of text splitter for plain text matching ([195a909](https://github.com/zirkelc/chunkdown/commit/195a909b79e89e1a6afcb8b0716c9d64505132ba))

## [3.2.0](https://github.com/zirkelc/chunkdown/compare/v3.1.0...v3.2.0) (2026-02-25)


### Features

* improve text splitter with plaintext-to-markdown mapping ([2280108](https://github.com/zirkelc/chunkdown/commit/2280108584b071e679b0ac1dd7a1b0cb60bb4ff4))

## [3.1.0](https://github.com/zirkelc/chunkdown/compare/v3.0.0...v3.1.0) (2025-12-16)


### Features

* add support for node rules for code and inlineCode ([bcc2a0f](https://github.com/zirkelc/chunkdown/commit/bcc2a0f64718fc38d7cd4b388a520a42c7df0325))

## [3.0.0](https://github.com/zirkelc/chunkdown/compare/v2.4.3...v3.0.0) (2025-12-12)


### ⚠ BREAKING CHANGES

* breadcrumbs

### Features

* breadcrumbs ([c11b877](https://github.com/zirkelc/chunkdown/commit/c11b8770ec6e120d5c7552bb6911b0bec757051e))

## [2.4.3](https://github.com/zirkelc/chunkdown/compare/v2.4.2...v2.4.3) (2025-12-02)


### Bug Fixes

* always use resource links ([bbcb23d](https://github.com/zirkelc/chunkdown/commit/bbcb23d097a73cd5d60ff6e3ff1c34805b987f3a))
* overflow ratio less than 1.0 ([9501729](https://github.com/zirkelc/chunkdown/commit/950172918b24aae763249243220b0c127d580822))
* set maxOverflowRatio optional ([caaaa17](https://github.com/zirkelc/chunkdown/commit/caaaa170b013f5cdb708d77e9a6d859b632c771b))
* text splitter escapes splitted markdown ([57ed94b](https://github.com/zirkelc/chunkdown/commit/57ed94b840531bc142b6fa13a1622b710ec3ca7a))

## [2.4.2](https://github.com/zirkelc/chunkdown/compare/v2.4.1...v2.4.2) (2025-11-28)


### Bug Fixes

* append thematic breaks to section as closing node ([e03cbdd](https://github.com/zirkelc/chunkdown/commit/e03cbdd76a0cf766df5aa241af2dd74308222c71))

## [2.4.1](https://github.com/zirkelc/chunkdown/compare/v2.4.0...v2.4.1) (2025-11-25)


### Bug Fixes

* protected ranges ([1d5f81f](https://github.com/zirkelc/chunkdown/commit/1d5f81f2350cf9f860fedb1f2e9341fb2835d691))

## [2.4.0](https://github.com/zirkelc/chunkdown/compare/v2.3.0...v2.4.0) (2025-11-22)


### Features

* tablePipeAlign false for less tokens ([2808f44](https://github.com/zirkelc/chunkdown/commit/2808f44bb407237fa6573f8d46f65ad9a42ce165))

## [2.3.0](https://github.com/zirkelc/chunkdown/compare/v2.2.0...v2.3.0) (2025-11-22)


### Features

* add getters for chunk size, max overflow ratio, and max raw size ([c183735](https://github.com/zirkelc/chunkdown/commit/c18373562a48d1636eac0ecc82ab5ab1b46af7d7))

## [2.2.0](https://github.com/zirkelc/chunkdown/compare/v2.1.0...v2.2.0) (2025-11-07)


### Features

* apply node transformations ([b3c6500](https://github.com/zirkelc/chunkdown/commit/b3c6500b170bafa9d554c96bd596014286da60cb))


### Bug Fixes

* release please always update ([fa42aef](https://github.com/zirkelc/chunkdown/commit/fa42aef24b8b7d649956ad48653527948cbd4a50))

## [2.1.0](https://github.com/zirkelc/chunkdown/compare/v2.0.0...v2.1.0) (2025-11-05)


### Features

* normalize reference-style links ([28c3af8](https://github.com/zirkelc/chunkdown/commit/28c3af815bc61645572164ffbd56dbbf4821eaa5))

## [2.0.0](https://github.com/zirkelc/chunkdown/compare/v1.4.1...v2.0.0) (2025-11-03)


### ⚠ BREAKING CHANGES

* refactor chunkdown

### Features

* refactor chunkdown ([6b811b1](https://github.com/zirkelc/chunkdown/commit/6b811b1787c66b809bc1901ee32974191532659e))

## [1.4.1](https://github.com/zirkelc/chunkdown/compare/v1.4.0...v1.4.1) (2025-10-22)


### Bug Fixes

* remove hard-coded breakpoints for formatting ([fb26c3c](https://github.com/zirkelc/chunkdown/commit/fb26c3cb26d799b5a729a4b9b6c8e52d34aedecd))

## [1.4.0](https://github.com/zirkelc/chunkdown/compare/v1.3.0...v1.4.0) (2025-10-21)


### Features

* implement configurable breakpoints ([4359c28](https://github.com/zirkelc/chunkdown/commit/4359c28d76720cd44a0da5ffce153861c3f92b7b))
