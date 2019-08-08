# wecco examples

This directory contains some examples showing how to build components and apps using `@wecco/core`.

## Static

The file [`static.html`](./static.html) contains a self contained example that loads `@wecco/core` from the bitbucket downloads and defines elements using inline `script` tags.

## TypeScript & Webpack

This directory also contains a TypeScript/Webpack example app that contains the following two examples.

### Count Clicks

The first example shows a simple button component that counts the number of times it has been clicked. The example's source code can be found in [`count-clicks.ts`](./count-clicks.ts) and is also shown below:

```typescript
import * as wecco from "@wecco/core"

interface CountClicks {
    count: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, context) => {
    return wecco.html`<p>
        <button class="waves-effect waves-light btn" data-count=${data.count} @click=${() => { data.count++; context.notifyUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
})

CountClicks({ count: 0 }).mount("#count-clicks-app")
```

The example defines a custom web component named `count-clicks` which uses a model defined by the interface `CountClicks`. The component renders a single button with an `onclick` listener that updates the counter each time the button is clicked.

### Todo
This is a very simple example of a todo application that stores the todo items in `localStorage`. The source code is a little longer and is thus not shown here but can be found in [`todo.ts`](./todo.ts).