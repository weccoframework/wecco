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
        expect(text).toMatch(/^<p data-wecco-id="\d"><!--{{wecco:0\/start}}-->hello, world<!--{{wecco:0\/end}}--><\/p><!--{{wecco:1\/start}}-->dude<!--{{wecco:1\/end}}-->$/)
    })

    it("should render array of static and dynamic text using tagged text", async () => {
        await fixture.page.evaluate(() => wecco.updateElement("#app", [
            wecco.html`<p>${"hello, world"}</p>`,
            `hello, world again`
        ]))
        await sleep()

        let text = await fixture.page.$eval("#app", e => e.innerHTML)
        expect(text).toBe(`<p data-wecco-id="0"><!--{{wecco:0/start}}-->hello, world<!--{{wecco:0/end}}--></p>hello, world again`)
    })

    describe("mount event", () => {
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
            await sleep()

            const count = await fixture.page.evaluate(() => window.mountCounter)
            expect(count).toBe(1)
        })

        it("should invoke @mount for nested html template", async () => {
            await fixture.page.evaluate(() => {
                window.mountCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<span @mount=${() => { window.mountCalled++ }}></span>`}</div>`)
            })
            await sleep()

            const mountCalled = await fixture.page.evaluate(() => window.mountCalled)
            expect(mountCalled).toBe(1)
        })

        it("should invoke @mount for deeply nested html template", async () => {
            await fixture.page.evaluate(() => {
                window.mountCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<div>${wecco.html`<span @mount=${() => { window.mountCalled++ }}></span>`}</div>`}</div>`)
            })
            await sleep()

            const mountCalled = await fixture.page.evaluate(() => window.mountCalled)
            expect(mountCalled).toBe(1)
        })
    })

    describe("template reuse", () => {
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
})