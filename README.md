# wecco

![CI Status][ci-img-url] 
[![Releases][release-img-url]][release-url]
[![Vulerabilities][vulnerabilities-img-url]][vulnerabilities-url]

[ci-img-url]: https://github.com/weccoframework/wecco/workflows/CI/badge.svg
[release-img-url]: https://img.shields.io/github/v/release/weccoframework/wecco.svg
[release-url]: https://github.com/weccoframework/wecco/releases
[vulnerabilities-url]: https://snyk.io/test/github/weccoframework/wecco
[vulnerabilities-img-url]: https://snyk.io/test/github/weccoframework/wecco/badge.svg

`wecco` is a framework for building web applications based on web standards such as 
[Web Components](https://www.webcomponents.org/), 
[HTML Templates](https://developer.mozilla.org/de/docs/Web/HTML/Element/template) 
and JavaScript features supported by modern browsers. It is designed to

* be simple and easy to use
* deliver performant web apps (by leveraging browser features)
* have a very small footprint

The core part of `wecco` has no external dependencies and the minified UMD file is only 18k is size.

See https://weccoframework.github.io for reference documentation on how to use `wecco`.

# Development

This repository uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces?v=true#using-workspaces)
to define several packages `wecco` consists of . All of these packages will be published separately to npmjs
and share the organization `@weccoframework`. Make sure you run `npm install` (or similar) from the root
directory and not within any of the `packages`.

The packages contained in this monorepo are:

* [`@weccoframework/core`](./packages/core) - the core framework
* [`@weccoframework/examples`](./packages/examples) - several examples using `wecco` as a standalone package

# License

Copyright (c) 2019 - 2023 The wecco authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
