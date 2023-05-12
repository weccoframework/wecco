# Changelog

# Version 0.24.0

* `updateElement` emits custom events `updatestart` and `updateend` to notify listeners when an update is
  applied to an element
* custom elements created using `define` emit custom events `connect` and `disconnect` to notify listeners
  when the custom element is connected/disconnected from the DOM

# Version 0.23.0

**Breaking Change**: This version contains an API change that breaks with prior
versions.

* `define` accepts an object as the optional last parameter allowing you to set
  observed (HTML element) attributes as well as observed (JavaScript element)
  properties
* Added performance tests to benchmark render performance

# Version 0.22.2

* Fix handling of `null` and `undefined` when updating bound attributes of custom elements
* Improve bundles
* Rework examples

# Version 0.22.1

* Fix `null` value error when using `null` inside a placeholder of `wecco.html`

# Version 0.22.0

**Breaking Change**: This version contains an API change that breaks with prior
versions.

* Change signature of _app_ functions to always receive `ctx` as the first
  parameter. This allows a very much easier use of `bind` when building views.
* `null` is allowed for functions that return an `ElementUpdate`. A `null` value
  causes no change in the element`s DOM.
* Minor dev dependency upgrades
* Example uses vite.js (instead of webpack)

# Version 0.21.7

* Upgraded several dependencies (security fixes)

# Version 0.21.6

* fix: preserve case when setting properties from HTML template attributes

# Version 0.21.5

* fix: send `update` event for custom elements but not their sub-trees
# Version 0.21.4

* fix: only send `update` event for elements connected to a document root

# Version 0.21.3

* fix: `removeAllChildren` also works with non-`Element`s such as Shadow root or other document-fragments.

# Version 0.21.2

* trigger `update` event when rendering shadow root

# Version 0.21.1

* fix minor build system details to conform to github npm registry

# Version 0.21.0

* updated package scope to `@weccoframework`

# Version 0.20.0

* add support for omitting attributes if a placeholder returns `undefined` or `null`

# Version 0.19.0

* add support for setting Javascript properties on HTML elements created with `html`-tagged strings

# Version 0.18.0

* add support for options passed to `addEventListener`

# Version 0.17.0

* add support for asynchronous apps (model creation and updates)

# Version 0.16.3

* fixed an issue when re-rendering a template containing a placeholder with text, nested template and text again

# Version 0.16.2

* only update attribute value when bound value changes

# Version 0.16.1

* fix type signature of app updater to include `NoModelChange`

# Version 0.16.0

* introduce `NoModelChange` value to skip rendering of an app

# Version 0.15.3

* fix handling of nested html tagged strings with toplevel mixed content

# Version 0.15.2

* fix null reference error when updating node bindings

# Version 0.15.1

* fix: remove previous content when applying text content to node binding and non-text node found

# Version 0.15.0

* complete rewrite of `html` string tag to support partial updates which greatly improves performance

** Breaking Change: `@mount` special binding dropped and replaced with `@update` event

# Version 0.14.3

* fix missing export of `UpdateTarget`

# Version 0.14.2

* fix redundant emit of `mounted` event when embedding one `HtmlTemplate`s inside another one

# Version 0.14.1

* fix type definition of how `ElementUpdate` handles arrays

# Version 0.14.0

* `ElementUpdate` can be an array of update requests which will be applied in order

# Version 0.13.0

* `update` callback running as part of an app receive a `context` parameter to emit other messages

# Version 0.12.0

* Removed `controller` package in exchange for new `app` package

# Version 0.11.0

* Upgraded all dependencies

# Version 0.10.1

* Fixed event handler management on DOM updates

# Version 0.10.0

* Added support for invocation chaining on several objects

# Version 0.9.1

* Fixed `@mount` with nested elements

# Version 0.9.0

* `@mount` event (see https://bitbucket.org/wecco/core/issues/1/mount-special-event)

# Version 0.8.0

* `context` Parameter supports `once` helper method

# Version 0.7.0

* `define` method accepts multiple observed attribute names as rest parameter

# Version 0.6.0

* Execute an element's render callback with a delay thus collecting multiple data changes into one render call
* Fixed bug that render callback is triggered twice when an observed attribute is changed via DOM interaction

# Version 0.5.0

**Breaking Change**: Changed signature of render callback.

* Added support for element events send via HTML `CustomEvent` objects.

# Version 0.4.0

* Added caching support for HTML rendered using backticks and custom string tag
* Fixed bug in todo-example concerning state handling

# Version 0.3.0

* Added support to bind HTML attribute values to model properties

# Version 0.2.0

* Added examples

# Version 0.1.0

Initial version