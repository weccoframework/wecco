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

const { expect } = require("iko")
const { fixture: fixture } = require("./fixture.test")
const { sleep } = require("./sleep")

describe("app", () => {
    it("should run counter app", async () => {
        await fixture.page.evaluate(() => {
            class Model {
                constructor(count) { 
                    this.count = count
                }

                inc() {
                    return new Model(this.count + 1)
                }
            }

            function update(model) {
                return model.inc()
            }

            function view(model, context) {
                return wecco.html`<p>
                    <button class="btn btn-primary" @click=${() => context.emit("inc")}>
                        You clicked me ${model.count} times
                    </button>
                </p>`
            }

            wecco.app(() => new Model(0), update, view, "#app")
        })
        
        await fixture.page.evaluate(() => {
            document.querySelector("button").dispatchEvent(new MouseEvent("click"))
        })
        
        await sleep(100)
        
        const text = await fixture.page.$eval("#app button", e => e.innerText)
        expect(text).toBe("You clicked me 1 times")
    })
})