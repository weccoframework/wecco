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

const { expect } = require("iko")
const { fixture: fixture } = require("./fixture.test")
const { sleep } = require("./sleep")

describe("events", () => {
    it("should emit custom events", () => {
        return fixture.page.evaluate(() => {
            window._receivedEvent = null
            document.addEventListener("test", e => {
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
            .then(() => fixture.page.evaluate(() => window._receivedEvent))
            .then(detail => expect(detail).toBe("foobar"))
    })

    it("should emit and subscribe for custom events", () => {
        return fixture.page.evaluate(() => {
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
            .then(() => fixture.page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            }))
            .then(() => new Promise(resolve => setTimeout(resolve, 20)))
            .then(() => fixture.page.$eval("#app count-clicks p", e => e.innerText))
            .then(text => expect(text).toBe("You clicked me 1 times."))
    })

    it("should emit and subscribe for custom events on same component", () => {
        return fixture.page.evaluate(() => {
            const b = wecco.define("my-button", (data, context) => {
                return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
            }, "label")

            document.querySelector("#app").innerHTML = "<my-button label=\"test\"></my-button>"
        })
            .then(() => fixture.page.evaluate(() => {
                document.querySelector("my-button").addEventListener("click", () => {
                    document.querySelector("#app").innerHTML = "clicked"
                })
            }))
            .then(() => fixture.page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            }))
            .then(() => new Promise(resolve => setTimeout(resolve, 20)))
            .then(() => fixture.page.$eval("#app", e => e.innerText))
            .then(text => expect(text).toBe("clicked"))
    })
    
    it("should handle multiple elements with the same listener correct", async () => {
        await fixture.page.evaluate(() => {
            window.clickStats = {
                one: 0,
                two: 0,
            }
            wecco.updateElement("#app", wecco.html`
                <a @click=${() => window.clickStats.one++}>One</a>
                <a @click=${() => window.clickStats.two++}>Two</a>
            `)
        })
        await sleep(10)
        await fixture.page.evaluate(() => {
            document.querySelector("#app a:nth-of-type(1)").dispatchEvent(new MouseEvent("click"))
            document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
            document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
        })
        await sleep(10)

        const stats = await fixture.page.evaluate(() => window.clickStats)

        expect(stats.one).toBe(1)
        expect(stats.two).toBe(2)
    })
})