# wecco

`wecco` is a Web Framework based on web standards such as [Web Components](https://www.webcomponents.org/), 
[HTML Templates](https://developer.mozilla.org/de/docs/Web/HTML/Element/template) and plain JavaScript that features

* simplicity
* performance
* small footprint

`wecco` features a _functional programming style_ as opposed to a class based approach using inheritence that other common web frameworks endorse. Using functions to express a dynamic web UI allows a developer to focus on a descriptive approach, where as classes tend to obfuscate the concepts behind a dynamic UI.

`wecco` is written using [TypeScript](https://www.typescriptlang.org/). The type definitions allow an IDE to provide valuable hints of function's parameters and return types. Nevertheless `wecco` can be used with plain Javascript as well.

Besides a couple of development tools (such as TypeScript, mocha, ...) `wecco` uses _no dependencies_ (all dependencies are declared as `devDependencies` in the [`package.json`](./package.json)). This 
means, that adding `wecco` to your project does not bloat your `node_modules`. The (unminified) UMD module is only 28k in size.

> wecco is stil under heavy development and the API is not considered stable until release 1.0.0.

## Installation

### NPM

Currently, wecco is not published to any npm registry, but you can install it using the full download URL:

```bash
$ npm i @wecco/core@https://bitbucket.org/wecco/core/downloads/wecco-core-0.12.0.tgz
```

### Via Bitbucket Downloads

Directly include the bundled version of wecco into your HTML document:

```html
<script src="https://bitbucket.org/wecco/core/downloads/wecco-core-0.12.0.umd.js"></script>
```

## Usage

The following code contains a full "app" for a button that counts the number of times a user clicked it.

```typescript
import * as wecco from "@wecco/core"

class Model {
    constructor(public readonly count: number) {}

    inc() {
        return new Model(this.count + 1)
    }
}

type Message = "inc"

function update(model: Model, message: Message): Model {
    return model.inc()
}

function view (model: Model, context: wecco.AppContext<Message>) {
    return wecco.html`<p>
        <button class="btn btn-primary" @click=${() => context.emit("inc")}>
            You clicked me ${model.count} times
        </button>
    </p>`
}

document.addEventListener("DOMContentLoaded", () => {
    wecco.app(() => new Model(0), update, view, "#count-clicks-app")
})
```

`wecco.define` is used to define a custom webcomponent. It returns a factory function that can be used to create instances of the web component. The component is also registered as a web component and can be created using a HTML tag.

The first parameter to `wecco.define` defines the name of the component and must follow the custom webcomponent's conventions (i.e. it must contain a dash). 

The second parameter is the render callback. `wecco` is based on callbacks and you will see several of these. The render callback is called everytime the component should update. 

The first parameter passed to this callback is the component's data. Using Typescript this parameter's type is defined using a generic type parameter. You commonly use an interface to describe the type. 

The second parameter is the notify update callback. It can be used to notify the component that something has changed and the component should update its content. We use this callback to notify when the user has clicked the button and we updated the `data`-attribute `count`.

The last line creates an instance of the component passing in an object that implements `CountClicks` - the data interface - which initializes the component's data state. The result is an instance of `HTMLElement` which can be added to the DOM using plain DOM manipulation functions. The object also provides a convenience method `mount` which can be used to add the element to dom: Simply pass in a `HTMLElement` or a string which is passed to `document.querySelector` in order to obtain the element to add the new element as a child.

Here is the same count clicks example with a custom element:

```typescript
import * as wecco from "@wecco/core"

interface CountClicks {
    count?: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, context) => {
    if (typeof(data.count) === "undefined") {
        data.count = 0
    }

    return wecco.html`<p>
        <button class="btn btn-primary" @click=${() => { data.count++; context.requestUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
}, "count")
```

Check out the [examples](./examples) to see these two in action as well as the classical todo app.

# Author

wecco is written by Alexander Metzner <alexander.metzner@gmail.com>.

# License

```
Copyright (c) 2019 - 2020 The wecco authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```