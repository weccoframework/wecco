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

import { test } from "./benchmark"

test.describe("performance", () => {
    test.describe("initial rendering", () => {
        test("render function", async ({ benchmark }) => {
            await benchmark({
                prepare: () => {
                    window.div = function (text) {
                        return wecco.html`<div>${text}</div>`
                    }

                    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    const len = 16
                    window.randomString = function () {
                        let s = ""
                        for (let i = 0; i < len; i++) {
                            s += alphabet.charAt(Math.random() * alphabet.length)
                        }

                        return s
                    }
                },

                sample: () => {
                    const e = document.createElement("div")
                    document.body.appendChild(e)
                    const start = performance.now()
                    wecco.updateElement(e, div(randomString()))
                    return performance.now() - start
                }
            })
        })

        test("custom element", async ({ benchmark }) => {
            await benchmark({
                prepare: () => {
                    window.div = wecco.define("perftest-div", ({ text }, _) => wecco.html`<div>${text}</div>`)

                    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    const len = 16
                    window.randomString = function () {
                        let s = ""
                        for (let i = 0; i < len; i++) {
                            s += alphabet.charAt(Math.random() * alphabet.length)
                        }

                        return s
                    }
                },
                sample: () => {
                    return new Promise(resolve => {
                        const e = document.createElement("div")
                        document.body.appendChild(e)
                        const start = performance.now()
                        const d = div({ text: randomString() })
                        d.addEventListener("renderingComplete", () => {
                            resolve(performance.now() - start)
                        }, { once: true })

                        wecco.updateElement(e, d)
                    })
                }
            })
        })
    })

    test.describe("update previous rendering", () => {
        test("render function", async ({ benchmark }) => {
            await benchmark({
                prepare: () => {
                    window.div = function (text) {
                        return wecco.html`<div>${text}</div>`
                    }

                    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    const len = 16
                    window.randomString = function () {
                        let s = ""
                        for (let i = 0; i < len; i++) {
                            s += alphabet.charAt(Math.random() * alphabet.length)
                        }

                        return s
                    }

                    wecco.updateElement("#app", div(randomString()))
                },

                sample: () => {
                    const start = performance.now()
                    wecco.updateElement("#app", div(randomString()))
                    return performance.now() - start
                }
            })
        })

        test("custom element", async ({ benchmark }) => {
            await benchmark({
                prepare: () => {
                    window.div = wecco.define("perftest-div", ({ text }, _) => wecco.html`<div>${text}</div>`)

                    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    const len = 16
                    window.randomString = function () {
                        let s = ""
                        for (let i = 0; i < len; i++) {
                            s += alphabet.charAt(Math.random() * alphabet.length)
                        }

                        return s
                    }

                    window.instance = div({ text: randomString() })
                    instance.mount("#app")
                },

                sample: () => {
                    return new Promise(resolve => {
                        const start = performance.now()
                        instance.addEventListener("renderingComplete", () => {
                            resolve(performance.now() - start)
                        }, { once: true })
                        instance.setData({ text: randomString() })
                    })
                }
            })
        })
    })
})