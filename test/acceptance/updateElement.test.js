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

function removeMarkerComments (html) {
    return html.replace(/<!---->/g, "")
}

describe("updateElement", () => {
    it("should render static text", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", "test"))
        await sleep()

        const text = await fixture.page.$eval("#app", e => e.innerText)
        expect(text).toBe("test")
    })

    it("should render dynamic text", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", `${"hello, world"}`))
        await sleep()

        const text = await fixture.page.$eval("#app", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render dynamic text using tagged html", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", wecco.html`<p>${"hello, world"}</p>`))
        await sleep()

        const text = await fixture.page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    it("should render tagged html with toplevel placeholder ", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", wecco.html`<p>${"hello, world"}</p>${"dude"}`))
        await sleep()

        const text = await fixture.page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<p>hello, world</p>dude`)
    })

    it("should render array of static and dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", [
            wecco.html`<p>${"hello, world"}</p>`,
            `hello, world again`
        ]))
        await sleep()

        const text = await fixture.page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<p>hello, world</p>hello, world again`)
    })

    it("should render nested iterables", async () => {
        await fixture.page.evaluate(() => {
            const li = (content) => wecco.html`<li>${content}</li>`
            const ul = (items) => wecco.html`<ul>${items}</ul>`
    
            wecco.updateElement("#app", ul([li("foo"), li("bar"), li(ul([li("spam"), li("eggs")]))]))
        })

        const text = await fixture.page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<ul><li>foo</li><li>bar</li><li><ul><li>spam</li><li>eggs</li></ul></li></ul>`)
    })

    describe("forms", () => {
        it("should render value binding of input element", async () => {
            await fixture.page.evaluate(() => wecco.updateElement("#app", wecco.html`<input type="text" .value=${"hello, world"}>`))
            await sleep()
    
            const text = await fixture.page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world")
        })        

        it("should update value binding of input element", async () => {
            await fixture.page.evaluate(() => {
                window.tpl = (value) => wecco.html`<input type="text" .value=${value}>`
                wecco.updateElement("#app", tpl("hello, world"))
            })
            await sleep()

            let text = await fixture.page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world")

            await fixture.page.evaluate(() => {
                wecco.updateElement("#app", tpl("hello, world again"))
            })

            await sleep()

            text = await fixture.page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world again")
        })        
    })

    describe("update event", () => {
        it("should invoke @update only once per update cycle", async () => {
            await fixture.page.evaluate(() => {
                window.updateCounter = 0;
                const comp = () => {
                    const onMount = () => {
                        window.updateCounter++;
                    };
                    return wecco.html`<h1 @update=${onMount}>test-component</h1>`;
                };

                wecco.updateElement(document.querySelector("#app"), wecco.html`${comp()}`);
            })
            await sleep()

            const count = await fixture.page.evaluate(() => window.updateCounter)
            expect(count).toBe(1)
        })

        it("should invoke @update for nested html template", async () => {
            await fixture.page.evaluate(() => {
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<span @update=${() => { window.updateCalled++ }}></span>`}</div>`)
            })
            await sleep()

            const updateCalled = await fixture.page.evaluate(() => window.updateCalled)
            expect(updateCalled).toBe(1)
        })

        it("should invoke @update for deeply nested html template", async () => {
            await fixture.page.evaluate(() => {
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<div>${wecco.html`<span @update=${() => { window.updateCalled++ }}></span>`}</div>`}</div>`)
            })
            await sleep()

            const updateCalled = await fixture.page.evaluate(() => window.updateCalled)
            expect(updateCalled).toBe(1)
        })
    })

    describe("template reuse", () => {
        it("render should only re-render changed elements", async () => {
            await fixture.page.evaluate(() => {
                document.test = {}
                document.test.app = document.body.querySelector("#app")

                document.test.renderText = text => {
                    wecco.updateElement(document.test.app, wecco.html`<div><p>${text}</p></div>`)
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

        it("should remove rendered html when re-rendering empty string as nested template", async () => {
            await fixture.page.evaluate(() => {
                window.tpl = msg => wecco.html`<p>hello, ${msg ? wecco.html`<em>${msg}</em>` : "world"}</p>`
                wecco.updateElement("#app", tpl("foo"))
            })

            let text = await fixture.page.evaluate(() => document.querySelector("#app").innerHTML)
            expect(removeMarkerComments(text)).toBe("<p>hello, <em>foo</em></p>")

            await fixture.page.evaluate(() => {
                wecco.updateElement("#app", tpl())
            })

            text = await fixture.page.evaluate(() => document.querySelector("#app").innerHTML)
            expect(removeMarkerComments(text)).toBe("<p>hello, world</p>")
        })

    })
})