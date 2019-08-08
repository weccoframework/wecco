/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 Alexander Metzner.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { resolve } = require("path")
const { exists, mkdir } = require("fs")

const puppeteer = require("puppeteer")
const express = require("express")
const rollup = require("rollup")
const typescript = require("rollup-plugin-typescript2")
const commonjs = require("rollup-plugin-commonjs")

const { expect } = require("iko")

const reportsDirectory = resolve(process.cwd(), "reports", "screenshots")

describe("@wecco/core", () => {
    let server
    before(() => {
        const app = express()
        app.get("/", (req, res) => {
            res
                .status(200)
                .contentType("text/html")
                .send(`
                    <!doctype html>
                    <html>
                        <head>
                            <title>@wecco/core Acceptance Test</title>
                            <script src="/wecco-core.js"></script>
                        </head>
                        <body>
                            <div id="app"></div>
                        </body>
                    </html>
                `)
        })

        app.get("/wecco-core.js", async (req, res) => {
            const bundle = await rollup.rollup({
                input: "./index.ts",
                plugins: [
                    typescript({
                        tsconfigOverride: {
                            compilerOptions: {
                                module: "ESNext",
                            },
                        },
                    }),
                    commonjs(),
                ],
            })

            const { output } = await bundle.generate({
                name: "wecco",
                format: "umd",
            })

            res
                .status(200)
                .contentType("text/javascript")
                .send(output[0].code)
        })

        server = app.listen(8888)
    })

    after(() => {
        server.close()
    })

    before(cb => {
        exists(reportsDirectory, exists => {
            if (exists) {
                return cb()
            }

            mkdir(reportsDirectory, { recursive: true }, err => {
                cb(err)
            })
        })
    })

    let browser
    let page

    before(async () => {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    })

    beforeEach(async () => {
        page = await browser.newPage()
        await page.goto("http://localhost:8888/")
    })

    afterEach(async function renderScreenshot() {
        await page.screenshot({
            path: resolve(reportsDirectory, `${this.currentTest.title}.png`),
        })
    })

    after(async () => {
        await browser.close()
    })

    it("should render static text", async () => {
        await page.evaluate(() => wecco.define("test-component", () => "<p>test</p>")().mount("#app"))
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("test")
    })

    it("should render dynamic text", async () => {
        await page.evaluate(() => wecco.define("test-component", (data) => `<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render dynamic text using tagged text", async () => {
        await page.evaluate(() => wecco.define("test-component", (data) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render interactive element", () => {
        return page.evaluate(() => wecco
            .define("test-component",
                (data, context) => wecco.html`<button @click=${() => { data.c++; context.requestUpdate() }}>${data.c}</button>`)({ c: 0 }).mount("#app"))
            .then(() => page.$eval("#app button", e => e.innerText))
            .then(text => expect(text).toBe("0"))
            .then(() => page.$("#app button"))
            .then(b => b.click())
            .then(() => new Promise(resolve => setTimeout(resolve, 5)))
            .then(() => page.$eval("#app button", e => e.innerText))
            .then(text => expect(text).toBe("1"))
    })

    it("should rerender component when setData is called", async () => {
        await page.evaluate(() => {
            const c = wecco.define("test-component", data => wecco.html`<p>${data.c} ${data.m}</p>`)
            const e = c({ c: 0, m: "times" })
            e.mount("#app")
            e.setData({ c: 1 })
        })
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("1 times")
    })

    it("should bind html attribute values to data properties", async () => {
        await page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
            document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
        })
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("foo bar")
    })

    it("should bind data property changes to html attribute values", () => {
        return page.evaluate(() => {
            wecco.define("test-component", (data, context) => {
                if (data.text !== "changed") {
                    setTimeout(() => {
                        data.text = "changed"
                        context.requestUpdate()
                    }, 1)
                }
                return wecco.html`<p>${data.text}</p>`
            }, "text")
            document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
        })
            .then(() => new Promise(resolve => setTimeout(resolve, 10)))
            .then(() => page.$eval("#app test-component", e => e.getAttribute("text")))
            .then(text => expect(text).toBe("changed"))
    })

    it("should emit custom events", () => {
        return page.evaluate(() => {
            window._receivedEvent = null
            document.addEventListener("weccoEvent", e => {
                window._receivedEvent = e.detail
            })
            wecco.define("test-component", (data, context) => {
                if (!data.send) {
                    setTimeout(() => {
                        data.send = true
                        context.emit("test", "foobar")
                        context.requestUpdate()
                    }, 1)
                }
                return "test"
            })
            document.querySelector("#app").innerHTML = "<test-component></test-component>"
        })
            .then(() => new Promise(resolve => setTimeout(resolve, 10)))
            .then(() => page.evaluate(() => window._receivedEvent))
            .then(detail => expect(detail.name).toBe("test") && expect(detail.payload).toBe("foobar"))
    })

    it("should emit and subscribe for custom events", () => {
        return page.evaluate(() => {
            wecco.define("my-button", (data, context) => {
                return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
            }, "label")

            wecco.define("count-clicks", (data, context) => {
                data.count = data.count || 0
                context.addEventListener("click", () => {
                    data.count++
                    context.requestUpdate()
                })

                return wecco.html`
                <p>You clicked me ${data.count} times.</p>
                <my-button label="Increment counter"/>
            `
            })

            document.querySelector("#app").innerHTML = "<count-clicks/>"
        })
            .then(() => page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            })
            )
            .then(() => page.$eval("#app count-clicks p", e => e.innerText))
            .then(text => expect(text).toBe("You clicked me 1 times."))
    })
}) 