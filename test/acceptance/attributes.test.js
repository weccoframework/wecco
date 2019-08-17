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

describe("attributes", () => {
    it("should bind html attribute values to data properties", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
            document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
        })
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("foo bar")
    })

    it("should bind multiple html attribute values when array is given", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, ["a1", "a2"])
            document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
        })
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("foobar")
    })

    it("should bind multiple html attribute values when multiple names are given", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, "a1", "a2")
            document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
        })
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("foobar")
    })

    it("should bind data property changes to html attribute values", () => {
        return fixture.page.evaluate(() => {
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
            .then(() => fixture.page.$eval("#app test-component", e => e.getAttribute("text")))
            .then(text => expect(text).toBe("changed"))
    })
})