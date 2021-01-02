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

describe("render", () => {
    it("should render static text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", () => "<p>test</p>")().mount("#app"))
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("test")
    })

    it("should render dynamic text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => `<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render array of static and dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => [wecco.html`<p>${data.m}</p>`, `<p>hello, world again</p>`])({ m: "hello, world" }).mount("#app"))
        let text = await fixture.page.$eval("#app p:nth-child(1)", e => e.innerText)
        expect(text).toBe("hello, world")
        
        text = await fixture.page.$eval("#app p:nth-child(2)", e => e.innerText)
        expect(text).toBe("hello, world again")
    })

    it("should render interactive element", () => {
        return fixture.page.evaluate(() => wecco
            .define("test-component",
                (data, context) => wecco.html`<button @click=${() => { data.c++; context.requestUpdate() }}>${data.c}</button>`)({ c: 0 }).mount("#app"))
            .then(() => fixture.page.$eval("#app button", e => e.innerText))
            .then(text => expect(text).toBe("0"))
            .then(() => fixture.page.$("#app button"))
            .then(b => b.click())
            .then(() => new Promise(resolve => setTimeout(resolve, 5)))
            .then(() => fixture.page.$eval("#app button", e => e.innerText))
            .then(text => expect(text).toBe("1"))
    })

    it("should rerender component when setData is called", async () => {
        await fixture.page.evaluate(() => {
            const c = wecco.define("test-component", data => wecco.html`<p>${data.c} ${data.m}</p>`)
            const e = c({ c: 0, m: "times" })
            e.mount("#app")
            e.setData({ c: 1 })
        })
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("1 times")
    })

    it("should bind html attribute values to data properties", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
            document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
        })
        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("foo bar")
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
            })
            )
            .then(() => fixture.page.$eval("#app count-clicks p", e => e.innerText))
            .then(text => expect(text).toBe("You clicked me 1 times."))
    })

    it("should invoke @mount eventlistener after component has been mounted", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("my-component", () => wecco.html`<span @mount=${self => self.innerText = "foo"}>bar</span>`)
            document.querySelector("#app").innerHTML = "<my-component></my-component>"
        })
        const text = await fixture.page.$eval("#app span", e => e.innerText)
        expect(text).toBe("foo")
    })

    it("should invoke @mount eventlistener after component has been updated", async () => {
        await fixture.page.evaluate(() => {
            const c = wecco.define("my-component", (data) => wecco.html`<span @mount=${self => self.innerText = "foo"}>${data.message}</span>`)
            const e = c({ message: "hello" })
            e.mount("#app")
            e.setData({ message: "world" })
        })

        const text = await fixture.page.$eval("#app span", e => e.innerText)
        expect(text).toBe("foo")
    })

    it("should invoke @mount eventlistener after nested component has been mounted", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("my-component", () => wecco.html`<div><span @mount=${self => self.innerText = "foo"}>bar</span></div>`)
            document.querySelector("#app").innerHTML = "<my-component></my-component>"
        })
        const text = await fixture.page.$eval("#app div span", e => e.innerText)
        expect(text).toBe("foo")
    })
})