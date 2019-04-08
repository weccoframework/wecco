# wecco

`wecco` is a Web Framework based on web standards such as [Web Components](https://www.webcomponents.org/), 
[HTML Templates](https://developer.mozilla.org/de/docs/Web/HTML/Element/template) and plain JavaScript that features

* simplicity
* performance
* small footprint

`wecco` features a _functional programming style_ as opposed to a class based approach using inheritence that other common web frameworks endorse. Using functions to express a dynamic web UI allows a developer to focus on a descriptive approach, where as classes tend to obfuscate the concepts behind a dynamic UI.

`wecco` is written using [TypeScript](https://www.typescriptlang.org/). The type definitions allow an IDE to provide valuable hints of function's parameters and return types. Nevertheless `wecco` can be used with plain Javascript as well.

`wecco` is open-source software licensed under the Apache License, Version 2.0.

## Installation

Currently, wecco is not published to any npm registry, but you can install it using the full download URL:

```bash
$ npm i @wecco/core@https://bitbucket.org/wecco/core/downloads/wecco-core-0.1.0.tgz
```

## Usage

The following code contains a full "app" for a button that counts the number of times a user clicked it.

```typescript
import * as wecco from "@wecco/core"

interface CountClicks {
    count: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, notifyUpdate) => {
    return wecco.html`<p>
        <button class="waves-effect waves-light btn" data-count=${data.count} @click=${() => { data.count++; notifyUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
})

CountClicks({ count: 0 }).mount("#count-clicks-app")
```

`wecco.define` is used to define a custom webcomponent. It returns a factory function that can be used to create instances of the web component. The component is also registered as a web component and can be created using a HTML tag.

The first parameter to `wecco.define` defines the name of the component and must follow the custom webcomponent's conventions (i.e. it must contain a dash). 

The second parameter is the render callback. `wecco` is based on callbacks and you will see several of these. The render callback is called everytime the component should update. 

The first parameter passed to this callback is the component's data. Using Typescript this parameter's type is defined using a generic type parameter. You commonly use an interface to describe the type. 

The second parameter is the notify update callback. It can be used to notify the component that something has changed and the component should update its content. We use this callback to notify when the user has clicked the button and we updated the `data`-attribute `count`.

The last line creates an instance of the component passing in an object that implements `CountClicks` - the data interface - which initializes the component's data state. The result is an instance of `HTMLElement` which can be added to the DOM using plain DOM manipulation functions. The object also provides a convenience method `mount` which can be used to add the element to dom: Simply pass in a `HTMLElement` or a string which is passed to `document.querySelector` in order to obtain the element to add the new element as a child.