/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2020 The wecco authors.
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
const { writeFile, mkdir, stat } = require("fs/promises")

const puppeteer = require("puppeteer")
const express = require("express")
const rollup = require("rollup")
const typescript = require("rollup-plugin-typescript2")
const commonjs = require("rollup-plugin-commonjs")

const reportsDirectory = resolve(process.cwd(), "reports")

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

before(async () => {
    try {
        await stat(reportsDirectory)
    } catch (e) {
        await mkdir(reportsDirectory, { recursive: true })
    }
})

const fixture = {
    browser: null,
    page: null,
}

exports.fixture = fixture

before(async () => {
    fixture.browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
})

beforeEach(async function () {
    const test = this.currentTest    
    test.messages = []

    fixture.page = await fixture.browser.newPage()

    fixture.page
        .on("console", message => {
            test.messages.push(`${message.type().toUpperCase()} ${message.text()}`)
        })
        .on("pageerror", ({ message }) => test.messages.push(`PAGE ERROR: ${message}`))

    await fixture.page.goto("http://localhost:8888/")
})

afterEach(async function renderScreenshot() {    
    await fixture.page.screenshot({
        path: resolve(reportsDirectory, `${this.currentTest.title}.png`),
    })

    const html = await fixture.page.evaluate(() => document.body.innerHTML)
    await writeFile(resolve(reportsDirectory, `${this.currentTest.title}.html`), `<html><head></head><body>${html}</body></html>`, "utf8")
    await writeFile(resolve(reportsDirectory, `${this.currentTest.title}.log`), this.currentTest.messages.join("\n"), "utf8")
})

after(async () => {
    await fixture.browser.close()
})

