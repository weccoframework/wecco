# Changelog

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