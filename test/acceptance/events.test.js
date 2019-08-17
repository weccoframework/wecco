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

const { expect } = require("iko")
const { fixture: fixture } = require("./fixture.test")

describe("events", () => {
    it("should emit custom events", () => {
        return fixture.page.evaluate(() => {
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
            .then(() => fixture.page.evaluate(() => window._receivedEvent))
            .then(detail => expect(detail.name).toBe("test") && expect(detail.payload).toBe("foobar"))
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
})