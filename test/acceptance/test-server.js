/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2021 The wecco authors.
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
const { mkdirSync, statSync } = require("fs")

const express = require("express")
const rollup = require("rollup")
const typescript = require("@rollup/plugin-typescript")
const commonjs = require("@rollup/plugin-commonjs")

const reportsDirectory = resolve(process.cwd(), "reports")
try {
    statSync(reportsDirectory)
} catch (e) {
    mkdirSync(reportsDirectory, { recursive: true })
}

let jsSource

rollup.rollup({
    input: "./index.ts",
    plugins: [
        typescript({
            compilerOptions: {
                module: "ESNext",
            },
        }),
        commonjs(),
    ],
})
    .then(bundle => bundle.generate({
        name: "wecco",
        format: "umd",
    }))
    .then(b => b.output[0].code)
    .then(jsSource => {
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
            res
                .status(200)
                .contentType("text/javascript")
                .send(jsSource)
        })

        const server = app.listen(8888)

        process.on("exit", () => {
            server.close()
        })
    })
