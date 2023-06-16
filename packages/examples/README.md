# `@weccoframework/examples`

This package contains some examples showing how to build components and apps 
using `@weccoframework/core`.

The examples use TypeScript in combination with vite.js.

In order to run the example, start the vite.js dev server with

```shell
npm start
```

This directpry contains three examples: a simple button that counts the number 
of times it has been clicked and a very simple ToDo app. The button example is
provided using two different implementations:

* one as a web component (see [`count-clicks-element.ts`](./count-clicks-element.ts))
* one as a _wecco app_ (see  [`count-clicks-app.ts`](./count-clicks-app.ts))

The ToDo app uses the _app_ API.
