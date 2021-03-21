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

import { expect } from "iko"
import { ElementUpdate, updateElement } from "../../src/update"
import { html } from "../../src/html"

describe("html.ts", async () => {
    beforeEach(() => {
        document.body = document.createElement("body")
    })

    describe("html", () => {
        it("should create html from static literal", () => {
            updateElement(document.body, html`<p>hello, world!</p>`)

            expect(document.body.innerHTML).toBe("<p>hello, world!</p>")
        })

        it("should create html w/ placeholder filling innerText", () => {
            updateElement(document.body, html`<p>${"hello, world!"}</p>`)

            expect(document.body.innerHTML).toBe("<p>hello, world!<!----></p>")
        })

        it("should create html w/ placeholder surrounded by static text", () => {
            updateElement(document.body, html`<p>hello, ${"world"}!</p>`)

            expect(document.body.innerHTML).toBe("<p>hello, world<!---->!</p>")
        })

        it("should create html w/ placeholder containing nested html", () => {
            updateElement(document.body, html`<p>${html`<em>hello, world!</em>`}</p>`)

            expect(document.body.innerHTML).toBe("<p><em>hello, world!</em></p>")
        })

        it("should create html w/ placeholder containing nested element", () => {
            const e = document.createElement("em")
            e.appendChild(document.createTextNode("hello, world!"))
            updateElement(document.body, html`<p>${e}</p>`)

            expect(document.body.innerHTML).toBe("<p><em>hello, world!</em></p>")
        })

        it("should create html w/ toplevel placeholder", () => {
            const gretee = "world";

            updateElement(document.body, html`<p>Hello</p>${gretee}`)

            expect(document.body.innerHTML).toBe(`<p>Hello</p>world<!---->`)
        })

        it("should create html w/ nested and toplevel placeholder", () => {
            updateElement(document.body, html`<p>${"hello"}</p>${"world"}`)

            expect(document.body.innerHTML).toBe(`<p>hello<!----></p>world<!---->`)
        })

        it("should create html w/ multiple adjecent placeholder", () => {
            const message = "Hello,";
            const gretee = "world";

            updateElement(document.body, html`<p>${message} ${gretee}!</p>`)

            expect(document.body.innerHTML).toBe(`<p>Hello,<!----> world<!---->!</p>`)
        })

        it("should create html w/ placeholder for whole attribute value", () => {
            const classes = "small hero"

            const template = (html`<p class=${classes}>hello, world!</p>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toBe(`<p class="small hero">hello, world!</p>`)
        })

        it("should create html w/ placeholder as part of attribute value", () => {
            const classes = "small"

            const template = (html`<p class="${classes} hero">hello, world!</p>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toBe(`<p class="small hero">hello, world!</p>`)
        })

        it("should create html w/ multiple placeholders as part of attribute value", () => {
            const classes = "small"

            const template = (html`<p class="${classes} hero ${"col"}">hello, world!</p>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toBe(`<p class="small hero col">hello, world!</p>`)
        })

        it("should create html w/ boolean attribute placeholder set to false", () => {            
            updateElement(document.body, html`<a ?disabled=${false}>hello, world!</a>`)

            expect(document.body.innerHTML).toBe(`<a>hello, world!</a>`)
        })

        it("should create html w/ boolean attribute placeholder set to true", () => {            
            updateElement(document.body, html`<a ?disabled=${true}>hello, world!</a>`)

            expect(document.body.innerHTML).toBe(`<a disabled="disabled">hello, world!</a>`)
        })

        it("should create html w/ event placeholder", () => {
            let clicked = false
            const callback = () => { clicked = true }

            const template = (html`<a @click=${callback}>Hello, world</a>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toBe(`<a>Hello, world</a>`)

            document.querySelector("a").dispatchEvent(new MouseEvent("click"))
            expect(clicked).toBe(true)
        })

        it("should create html w/ update placeholder", () => {
            let element: Element | null = null
            const callback = (e: CustomEvent) => { element = e.target as Element}

            const template = (html`<a @update=${callback}>Hello, world</a>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toBe(`<a>Hello, world</a>`)
            expect(element.nodeName).toBe("A")
        })

        it("should render nested html template and propagate @update event", () => {
            let updateCalled = false
            updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled = true }}></span>`}</div>`)        
            expect(updateCalled).toBe(true)
        })

        it("should re-render nested html template and propagate @update event", () => {
            let updateCalled = 0

            updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled++ }}>hello, ${"world"}!</span>`}</div>`)
            expect(document.querySelector("span").innerHTML).toBe("hello, world<!---->!")
            expect(updateCalled).toBe(1)
            
            updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled++ }}>hello, ${"foo"}!</span>`}</div>`)
            expect(document.querySelector("span").innerHTML).toBe("hello, foo<!---->!")
            expect(updateCalled).toBe(2)
        })

        describe("re-rendering of template applied previously", () => {
            it("should only update changed text nodes", () => {
                const tpl = (name: string) => html`<p>hello, ${name}!</p>`
                updateElement(document.body, tpl("world"))
                document.querySelector("p").setAttribute("data-test-marker", "test")
                expect(document.body.innerHTML).toBe(`<p data-test-marker="test">hello, world<!---->!</p>`)
    
                updateElement(document.body, tpl("foo"))
                expect(document.body.innerHTML).toBe(`<p data-test-marker="test">hello, foo<!---->!</p>`)
            })

            it("should only update changed attribute values", () => {
                const tpl = (name: string) => html`<p data-name=${name}>hello, world!</p>`
                
                updateElement(document.body, tpl("world"))
                document.querySelector("p").setAttribute("data-test-marker", "test");
                (document.querySelector("p").firstChild as Text).data = "foobar"                
                expect(document.body.innerHTML).toBe(`<p data-name="world" data-test-marker="test">foobar</p>`)
    
                updateElement(document.body, tpl("foo"))
                expect(document.body.innerHTML).toBe(`<p data-name="foo" data-test-marker="test">foobar</p>`)
            })

            it("should re-render updated nested template", () => {
                const tpl = (name: string) => html`<p>hello, ${name}!</p>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl("world")))
                expect(document.body.innerHTML).toBe(`<div><p>hello, world<!---->!</p></div>`)

                updateElement(document.body, wrapper(tpl("foo")))
                expect(document.body.innerHTML).toBe(`<div><p>hello, foo<!---->!</p></div>`)
            })

            it("should re-render different nested template", () => {
                const tpl1 = () => html`<p>hello, world!</p>`
                const tpl2 = () => html`<p>hello, foo!</p>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl1()))
                expect(document.body.innerHTML).toBe(`<div><p>hello, world!</p></div>`)

                updateElement(document.body, wrapper(tpl2()))
                expect(document.body.innerHTML).toBe(`<div><p>hello, foo!</p></div>`)
            })

            it("should re-render differently structured nested template", () => {
                const tpl1 = () => html`<p>hello, world!</p>`
                const tpl2 = () => html`<span>foobar</span>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl1()))
                expect(document.body.innerHTML).toBe(`<div><p>hello, world!</p></div>`)

                updateElement(document.body, wrapper(tpl2()))
                expect(document.body.innerHTML).toBe(`<div><span>foobar</span></div>`)
            })

            it("should re-render nested list template", () => {
                const tpl = (items: Array<string>) => html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`

                updateElement(document.body, tpl(["z"]))
                expect(document.body.innerHTML).toBe(`<ul><li>z</li></ul>`)

                updateElement(document.body, tpl(["a", "b", "c"]))
                expect(document.body.innerHTML).toBe(`<ul><li>a</li><li>b</li><li>c</li></ul>`)
            })

            it.skip("should re-render nested list template (2)", () => {
                const tpl = (items: Array<string>) => html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
                
                updateElement(document.body, tpl(["a", "b", "c"]))
                expect(document.body.innerHTML).toBe(`<ul><li>a</li><li>b</li><li>c</li></ul>`)

                updateElement(document.body, tpl(["z"]))
                expect(document.body.innerHTML).toBe(`<ul><li>z</li></ul>`)
            })
        })
    })
})