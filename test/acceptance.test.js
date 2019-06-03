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
        page = await browser.newPage()
    })

    afterEach(async function renderScreenshot() {
        await page.screenshot({
            path: resolve(reportsDirectory, `${this.currentTest.title}.png`),
        })
    })

    after(async () => {
        await browser.close()
    })

    it("should work", async () => {
        await page.goto("http://localhost:8888/")
        page.evaluate(() => wecco.define("test-component", () => "<p>test</p>")().mount("#app"))
        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("test")
    })
}) 