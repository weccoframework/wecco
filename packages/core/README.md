# `@weccoframework/core`

This package contains the core part of `wecco`.

`wecco` features a _functional programming style_ as opposed to a class based approach using inheritence that 
other common web frameworks endorse. Using functions to express a dynamic web UI allows a developer to focus 
on a descriptive approach, where as classes tend to obfuscate the concepts behind a dynamic UI.

`wecco` is written using [TypeScript](https://www.typescriptlang.org/). The type definitions allow an IDE to 
provide valuable hints of function's parameters and return types. Nevertheless `wecco` can be used with plain 
Javascript as well.

Besides a couple of development tools (such as TypeScript, mocha, ...) `wecco` uses _no dependencies_ (all 
dependencies are declared as `devDependencies` in [`package.json`](./package.json)). This 
means, that adding `wecco` to your project does not bloat your `node_modules`. The UMD module is only 13k in
size.

> wecco is stil under heavy development and the API is not considered stable until release 1.0.0.

See https://weccoframework.github.io for reference documentation on how to use `wecco`.

# Installation

## npm / yarn / pnpm

`wecco` is available via npmjs as `@weccoframework/core`.

You can also go to the [releases](https://github.com/weccoframework/core/releases) and download the tar ball 
and install it manually.

## Directly embedding in a HTML page

You can include the a UMD version of `wecco` into your web application. Simply go to the 
[releases](https://github.com/weccoframework/core/releases) and download the latest version
of the `umd`. To test a version, you can directly load the bundle from the github downloads, i.e.

```html
<script src="https://github.com/weccoframework/core/releases/download/v0.25.0/weccoframework-core.js"></script>
```

If you want to include `wecco` as a ES6 module, use the `.mjs` file, i.e.: 

```html
<script src="https://github.com/weccoframework/core/releases/download/v0.25.0/weccoframework-core.mjs"></script>
```

Please note, that this is _not_ recommended for any kind of production systems and should only be used during 
development.

# Usage

See https://weccoframework.github.io for an introduction as well as reference documentation on `wecco`.

The following code show as "sneak preview". It contains a full "app" for a button that counts the number of
times a user clicked it.

```typescript
import * as wecco from "@weccoframework/core"

class Model {
    constructor(public readonly count: number, public readonly explanation: string) {}

    inc() {
        return new Model(this.count + 1, this.explanation)
    }
}

type Message = "inc"

function update({model}: wecco.UpdaterContext<Model, Message>): Model {
    return model.inc()
}

function view ({ emit, model }: wecco.ViewContext<Model, Message>) {
    return wecco.html`
    <p class="text-sm">${model.explanation}</p>
    <p>
        <button 
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            @click=${() => emit("inc")}>
            You clicked me ${model.count} times
        </button>
    </p>`
}

document.addEventListener("DOMContentLoaded", () => {
    wecco.createApp(() => new Model(0, "Click the button to increment the counter."), update, view)
        .mount("#count-clicks-app")
})

```

`wecco.define` is used to define a custom webcomponent. It returns a factory function that can be used to 
create instances of the web component. The component is also registered as a web component and can be created
using a HTML tag.

The first parameter to `wecco.define` defines the name of the component and must follow the custom webcomponent's 
conventions (i.e. it must contain a dash). 

The second parameter is the render callback. `wecco` is based on callbacks and you will see several of these.
The render callback is called everytime the component should update. 

The first parameter passed to this callback is the component's data. Using Typescript this parameter's type is
defined using a generic type parameter. You commonly use an interface to describe the type. 

The second parameter is the notify update callback. It can be used to notify the component that something has
changed and the component should update its content. We use this callback to notify when the user has clicked
the button and we updated the `data`-attribute `count`.

The last line creates an instance of the component passing in an object that implements `CountClicks` - the
data interface - which initializes the component's data state. The result is an instance of `HTMLElement`
which can be added to the DOM using plain DOM manipulation functions. The object also provides a convenience
method `mount` which can be used to add the element to dom: Simply pass in a `HTMLElement` or a string which
is passed to `document.querySelector` in order to obtain the element to add the new element as a child.

Here is the same count clicks example with a custom element:

```typescript
import * as wecco from "@weccoframework/core"

interface CountClicks {
    count?: number
}

const CountClicks = wecco.define<CountClicks>("count-clicks", ({ data, requestUpdate }) => {
    data.count = data.count ?? 0

    return wecco.html`<p>
        <button 
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" 
            @click=${() => { data.count++; requestUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
}, {
    observedAttributes: ["count"],
})
```

Check out the [examples](./examples) to see these two in action as well as the classical todo app.

# Author

wecco is written by Alexander Metzner <alexander.metzner@gmail.com>.

# License

Copyright (c) 2019 - 2025 The wecco authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.


