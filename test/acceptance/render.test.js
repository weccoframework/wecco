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

const GraceSleepTime = 10

describe("render", () => {
    it("should render static text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", () => "<p>test</p>")().mount("#app"))
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("test")
    })

    it("should render dynamic text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => `<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render array of static and dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.define("test-component", (data) => [
            wecco.html`<p>${data.m}</p>`,
            `<p>hello, world again</p>`
        ])({ m: "hello, world" }).mount("#app"))
        await sleep(GraceSleepTime)

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
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("1 times")
    })

    it("should bind html attribute values to data properties", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
            document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
        })
        await sleep(GraceSleepTime)

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

    it("should emit and subscribe for custom events", async () => {
        await fixture.page.evaluate(() => {
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
                <my-button label="Increment counter" />
            `
            })

            document.querySelector("#app").innerHTML = "<count-clicks/>"
        })

        await fixture.page.evaluate(() => {
            document.querySelector("button").dispatchEvent(new MouseEvent("click"))
        })
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app count-clicks p", e => e.innerText)
        expect(text).toBe("You clicked me 1 times.")
    })

    it("should invoke @mount eventlistener after component has been mounted", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("my-component", () => wecco.html`<span @mount=${self => self.innerText = "foo"}>bar</span>`)
            document.querySelector("#app").innerHTML = "<my-component></my-component>"
        })
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app span", e => e.innerText)
        expect(text).toBe("foo")
    })

    it("should invoke @mount eventlistener after component has been updated", async () => {
        await fixture.page.evaluate(() => {
            window.mountCalled = 0
            const c = wecco.define("my-component", (data) => wecco.html`<span @mount=${() => window.mountCalled++}>${data.message}</span>`)
            const e = c({ message: "hello" })
            e.mount("#app")
            e.setData({ message: "world" })
        })
        await sleep(GraceSleepTime)

        expect(await fixture.page.evaluate(() => window.mountCalled)).toBe(2)
    })

    it("should invoke @mount eventlistener after nested component has been mounted", async () => {
        await fixture.page.evaluate(() => {
            wecco.define("my-component", () => wecco.html`<div><span @mount=${self => self.innerText = "foo"}>bar</span></div>`)
            document.querySelector("#app").innerHTML = "<my-component></my-component>"
        })
        await sleep(GraceSleepTime)

        const text = await fixture.page.$eval("#app div span", e => e.innerText)
        expect(text).toBe("foo")
    })

    it("should invoke @mount only once per mounting cycle", async () => {
        await fixture.page.evaluate(() => {
            window.mountCounter = 0;
            const comp = () => {
                const onMount = () => {
                    window.mountCounter++;
                };
                return wecco.html`<h1 @mount=${onMount}>test-component</h1>`;
            };

            wecco.updateElement(document.querySelector("#app"), wecco.html`${comp()}`);
        })
        await sleep(GraceSleepTime)

        const count = await fixture.page.evaluate(() => window.mountCounter)
        expect(count).toBe(1)
    })

    it("should invoke @mount for a custom element only once per mounting cycle", async () => {
        await fixture.page.evaluate(() => {
            window.mountCounter = 0;
            const comp = wecco.define("test-component", () => {
                const onMount = () => {
                    window.mountCounter++
                }
                return wecco.html`<h1 @mount=${onMount}>test-component</h1>`
            })

            wecco.updateElement(document.querySelector("#app"), comp())
        })
        await sleep(GraceSleepTime)

        const count = await fixture.page.evaluate(() => window.mountCounter)
        expect(count).toBe(1)
    })

    it("should invoke @mount for a custom element wrapped in html tagged string only once per mounting cycle", async () => {
        await fixture.page.evaluate(() => {
            window.mountCounter = 0;
            const comp = wecco.define("test-component", () => {
                const onMount = () => {
                    window.mountCounter++
                }
                return wecco.html`<h1 @mount=${onMount}>test-component</h1>`
            })

            wecco.updateElement(document.querySelector("#app"), wecco.html`<div>${comp()}</div>`)
        })
        await sleep(GraceSleepTime)

        const count = await fixture.page.evaluate(() => window.mountCounter)
        expect(count).toBe(1)
    })

    it("should invoke @mount for nested html template", async () => {
        await fixture.page.evaluate(() => {
            window.mountCalled = 0
            wecco.updateElement("#app", wecco.html`<div>${wecco.html`<span @mount=${() => { window.mountCalled++ }}></span>`}</div>`)
        })
        await sleep(GraceSleepTime)

        const mountCalled = await fixture.page.evaluate(() => window.mountCalled)
        expect(mountCalled).toBe(1)
    })

    it("should invoke @mount for deeply nested html template", async () => {
        await fixture.page.evaluate(() => {
            window.mountCalled = 0
            wecco.updateElement("#app", wecco.html`<div>${wecco.html`<div>${wecco.html`<span @mount=${() => { window.mountCalled++ }}></span>`}</div>`}</div>`)
        })
        await sleep(GraceSleepTime)

        const mountCalled = await fixture.page.evaluate(() => window.mountCalled)
        expect(mountCalled).toBe(1)
    })

    it("render should only re-render changed elements", async () => {
        await fixture.page.evaluate(() => {
            document.test = {}
            document.test.app = document.body.querySelector("#app")
            document.test.renderText = text => {
                wecco.updateElement(document.test.app, wecco.html`<div>
    <p>${text}</p>
</div>`)
            }
            document.test.renderText("foo")
            document.test.app.querySelector("div").setAttribute("data-test-marker", "1")
        })

        let text = await fixture.page.evaluate(() => document.querySelector("#app div p").innerText)
        expect(text).toBe("foo")

        let testMarker = await fixture.page.evaluate(() => document.querySelector("#app div").getAttribute("data-test-marker"))
        expect(testMarker).toBe("1")

        await fixture.page.evaluate(() => {
            document.test.renderText("bar")
        })

        text = await fixture.page.evaluate(() => document.querySelector("#app div p").innerText)
        expect(text).toBe("bar")

        testMarker = await fixture.page.evaluate(() => document.querySelector("#app div").getAttribute("data-test-marker"))
        expect(testMarker).toBe("1")
    })
})