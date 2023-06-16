# wecco examples

This directory contains some examples showing how to build components and apps 
using `@weccoframework/core`.

The example uses TypeScript in combination with vite.js to power a simple app.

In order to run the example, make sure you have run

```shell
npm run build
```

This directpry contains three examples: a simple button that counts the number 
of times it has been clicked and a very simple ToDo app. The button example is
provided using two different implementations:

* one as a web component (see [`count-clicks-element.ts`](./count-clicks-element.ts))
* one as a _wecco app_ (see  [`count-clicks-app.ts`](./count-clicks-app.ts))

The ToDo app uses the _app_ API.
