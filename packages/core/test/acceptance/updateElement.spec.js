/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2025 The wecco authors.
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

import { expect, test } from "@playwright/test"
import { sleep } from "./sleep"

function removeMarkerComments (html) {
    return html.replace(/<!---->/g, "")
}

test.describe("updateElement", () => {
    test("should render null", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", null))
        await sleep()

        const text = await page.$eval("#app", e => e.innerText)
        expect(text).toBe("")
    })

    test("should render static text", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", "test"))
        await sleep()

        const text = await page.$eval("#app", e => e.innerText)
        expect(text).toBe("test")
    })

    test("should render dynamic text", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", `${"hello, world"}`))
        await sleep()

        const text = await page.$eval("#app", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    test("should render dynamic text using tagged html", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", wecco.html`<p>${"hello, world"}</p>`))
        await sleep()

        const text = await page.$eval("#app p", e => e.innerText)
        expect(text).toBe("hello, world")
    })

    test("should render tagged html with toplevel placeholder ", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", wecco.html`<p>${"hello, world"}</p>${"dude"}`))
        await sleep()

        const text = await page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<p>hello, world</p>dude`)
    })

    test("should render array of static and dynamic text using tagged text", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => wecco.updateElement("#app", [
            wecco.html`<p>${"hello, world"}</p>`,
            `hello, world again`
        ]))
        await sleep()

        const text = await page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<p>hello, world</p>hello, world again`)
    })

    test("should render nested iterables", async ({page}) => {
        await page.goto(".")
        await page.evaluate(() => {
            const li = (content) => wecco.html`<li>${content}</li>`
            const ul = (items) => wecco.html`<ul>${items}</ul>`
    
            wecco.updateElement("#app", ul([li("foo"), li("bar"), li(ul([li("spam"), li("eggs")]))]))
        })

        const text = await page.$eval("#app", e => e.innerHTML)
        expect(removeMarkerComments(text)).toBe(`<ul><li>foo</li><li>bar</li><li><ul><li>spam</li><li>eggs</li></ul></li></ul>`)
    })

    test.describe("forms", () => {
        test("should render value binding of input element", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => wecco.updateElement("#app", wecco.html`<input type="text" .value=${"hello, world"}>`))
            await sleep()
    
            const text = await page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world")
        })        

        test("should update value binding of input element", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.tpl = (value) => wecco.html`<input type="text" .value=${value}>`
                wecco.updateElement("#app", tpl("hello, world"))
            })
            await sleep()

            let text = await page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world")

            await page.evaluate(() => {
                wecco.updateElement("#app", tpl("hello, world again"))
            })

            await sleep()

            text = await page.$eval("#app input", e => e.value)
            expect(text).toBe("hello, world again")
        })        
    })

    test.describe("events", () => {
        test("should invoke @update only once per update cycle", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
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

            const count = await page.evaluate(() => window.updateCounter)
            expect(count).toBe(1)
        })

        test("should invoke @update for nested html template", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<span @update=${() => { window.updateCalled++ }}></span>`}</div>`)
            })
            await sleep()

            const updateCalled = await page.evaluate(() => window.updateCalled)
            expect(updateCalled).toBe(1)
        })

        test("should invoke @update for deeply nested html template", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<div>${wecco.html`<div>${wecco.html`<span @update=${() => { window.updateCalled++ }}></span>`}</div>`}</div>`)
            })
            await sleep()

            const updateCalled = await page.evaluate(() => window.updateCalled)
            expect(updateCalled).toBe(1)
        })

        test("should invoke updatestart and updateend", async({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                const div = document.createElement("div")
                document.body.appendChild(div)
                window.updatestartCalled = false
                window.updateendCalled = false
                div.addEventListener("updatestart", () => {
                    window.updatestartCalled = true
                })
                div.addEventListener("updateend", () => {
                    window.updateendCalled = true
                })
                wecco.updateElement(div, "test")
            })
            await page.waitForTimeout(10)
            const [updatestartCalled, updateendCalled] = await page.evaluate(() => {
                return [window.updatestartCalled, window.updateendCalled]
            })

            expect(updatestartCalled).toBe(true)
            expect(updateendCalled).toBe(true)
        })
    })

    test.describe("template reuse", () => {
        test("render should only re-render changed elements", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                document.test = {}
                document.test.app = document.body.querySelector("#app")

                document.test.renderText = text => {
                    wecco.updateElement(document.test.app, wecco.html`<div><p>${text}</p></div>`)
                }
                document.test.renderText("foo")
                document.test.app.querySelector("div").setAttribute("data-test-marker", "1")
            })

            let text = await page.evaluate(() => document.querySelector("#app div p").innerText)
            expect(text).toBe("foo")

            let testMarker = await page.evaluate(() => document.querySelector("#app div").getAttribute("data-test-marker"))
            expect(testMarker).toBe("1")

            await page.evaluate(() => {
                document.test.renderText("bar")
            })

            text = await page.evaluate(() => document.querySelector("#app div p").innerText)
            expect(text).toBe("bar")

            testMarker = await page.evaluate(() => document.querySelector("#app div").getAttribute("data-test-marker"))
            expect(testMarker).toBe("1")
        })

        test("should remove rendered html when re-rendering empty string as nested template", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.tpl = msg => wecco.html`<p>hello, ${msg ? wecco.html`<em>${msg}</em>` : "world"}</p>`
                wecco.updateElement("#app", tpl("foo"))
            })

            let text = await page.evaluate(() => document.querySelector("#app").innerHTML)
            expect(removeMarkerComments(text)).toBe("<p>hello, <em>foo</em></p>")

            await page.evaluate(() => {
                wecco.updateElement("#app", tpl())
            })

            text = await page.evaluate(() => document.querySelector("#app").innerHTML)
            expect(removeMarkerComments(text)).toBe("<p>hello, world</p>")
        })

    })
})