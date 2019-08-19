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

describe("context", () => {
    it.only("should execute callback given to context.once just once", () => {
        return fixture.page.evaluate(() => {
            window.onceCallbackInvoked = 0
            wecco.define("test-component", (data, context) => {
                context.once(() => {
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
            .then(() => new Promise(resolve => setTimeout(resolve, 100)))
            .then(() => fixture.page.$eval("#app", e => e.innerText))
            .then(text => expect(text).toBe("count: 10; onceCallbackInvoked: 1"))
    })
})