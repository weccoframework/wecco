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

describe("context", () => {
    it("should execute callback given to context.once just once", async () => {
        await fixture.page.evaluate(() => {
            window.onceCallbackInvoked = 0
            wecco.define("test-component", (data, context) => {
                context.once("initializer", () => {
                    window.onceCallbackInvoked++
                })

                data.count = data.count || 0

                if (data.count < 10) {
                    setTimeout(() => {
                        data.count += 1
                        context.requestUpdate()
                    }, 1)
                }

                return `count: ${data.count}; onceCallbackInvoked: ${window.onceCallbackInvoked}`
            })
            document.querySelector("#app").innerHTML = "<test-component></test-component>"
        })

        let text = ""
        while (true) {
            await sleep(10)
            text = await fixture.page.$eval("#app", e => e.innerText)
            if (text.startsWith("count: 10")) {
                break
            }
        }

        expect(text).toBe("count: 10; onceCallbackInvoked: 1")
    })
})