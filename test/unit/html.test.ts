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
import { removeMarkerComments } from "./testutils"

describe("html.ts", async () => {
    beforeEach(() => {
        document.body = document.createElement("body")
    })

    describe("html", () => {
        describe("string content", () => {
            it("should create html from static literal", () => {
                updateElement(document.body, html`<p>hello, world!</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world!</p>")
            })
    
            it("should create html w/ placeholder filling innerText", () => {
                updateElement(document.body, html`<p>${"hello, world!"}</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world!</p>")
            })
    
            it("should create html w/ placeholder surrounded by static text", () => {
                updateElement(document.body, html`<p>hello, ${"world"}!</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world!</p>")
            })

            it("should create html w/ toplevel placeholder", () => {
                const gretee = "world";
    
                updateElement(document.body, html`<p>Hello</p>${gretee}`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p>Hello</p>world`)
            })
    
            it("should create html w/ nested and toplevel placeholder", () => {
                updateElement(document.body, html`<p>${"hello"}</p>${"world"}`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p>hello</p>world`)
            })
    
            it("should create html w/ multiple adjecent placeholder", () => {
                const message = "Hello,";
                const gretee = "world";
    
                updateElement(document.body, html`<p>${message} ${gretee}!</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p>Hello, world!</p>`)
            })
        })

        describe("attributes", () => {
            it("should create html w/ placeholder for whole attribute value", () => {
                const classes = "small hero"
    
                const template = (html`<p class=${classes}>hello, world!</p>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p class="small hero">hello, world!</p>`)
            })
    
            it("should create html w/ placeholder as part of attribute value", () => {
                const classes = "small"
    
                const template = (html`<p class="${classes} hero">hello, world!</p>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p class="small hero">hello, world!</p>`)
            })
    
            it("should create html w/ multiple placeholders as part of attribute value", () => {
                const classes = "small"
    
                const template = (html`<p class="${classes} hero ${"col"}">hello, world!</p>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p class="small hero col">hello, world!</p>`)
            })
    
            it("should create html w/ boolean attribute placeholder set to false", () => {            
                updateElement(document.body, html`<a ?disabled=${false}>hello, world!</a>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<a>hello, world!</a>`)
            })
    
            it("should create html w/ boolean attribute placeholder set to true", () => {            
                updateElement(document.body, html`<a ?disabled=${true}>hello, world!</a>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<a disabled="disabled">hello, world!</a>`)
            })

            describe("attribute directives", () => {
                describe("omit empty", () => {
                    it("should remove attribute when single placeholder returns undefined value", () => {
                        updateElement(document.body, html`<p id+omitempty="foo ${undefined}"></p>`)
                        expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p></p>`)
                    })

                    it("should remove attribute when at least one placeholder returns null value", () => {
                        updateElement(document.body, html`<p id+omitempty="foo ${null} ${"bar"}"></p>`)
                        expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p></p>`)
                    })

                    it("should set attribute when all placeholder return truthy value", () => {
                        updateElement(document.body, html`<p id+omitempty="foo ${"spam"} ${"bar"}"></p>`)
                        expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p id="foo spam bar"></p>`)
                    })
                })
            })
        })

        describe("properties", () => {
            it("should create input with value attribute", () => {
                updateElement(document.body, html`<input type="text" .value=${"hello, world"}>`)

                expect(removeMarkerComments(document.querySelector("input").value)).toBe("hello, world")
            })

            it("should create and update input with value attribute", () => {
                updateElement(document.body, html`<input type="text" .value=${"hello, world"}>`)
                updateElement(document.body, html`<input type="text" .value=${"hello, world again"}>`)

                expect(removeMarkerComments(document.querySelector("input").value)).toBe("hello, world again")
            })

            it("should preserve casing", () => {
                updateElement(document.body, html`<div .innerText=${"hello, world"}></div>`)

                expect(removeMarkerComments(document.querySelector("div").innerText)).toBe("hello, world")
            })
        })

        describe("events", () => {
            it("should create html w/ event placeholder", () => {
                let clicked = false
                const callback = () => { clicked = true }
    
                const template = (html`<a @click=${callback}>Hello, world</a>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<a>Hello, world</a>`)
    
                document.querySelector("a").dispatchEvent(new MouseEvent("click"))
                expect(clicked).toBe(true)
            })

            it("should create html w/ event placeholder that allows event to bubble up", () => {
                let eventTargets: Array<string> = []
                const callback = (label: string) => { eventTargets.push(label) }
    
                const template = (html`<div @click=${callback.bind(null, "div")}><a @click=${callback.bind(null, "a")}>Hello, world</a></div>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><a>Hello, world</a></div>`)
    
                document.querySelector("a").dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                }))
                expect(eventTargets).toBeEqual(["a", "div"])
            })

            it("should create html w/ event placeholder with capturing", () => {
                let eventTargets: Array<string> = []
                const callback = (label: string) => { eventTargets.push(label) }
    
                const template = (html`<div @click+capture=${callback.bind(null, "div")}><a @click=${callback.bind(null, "a")}>Hello, world</a></div>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><a>Hello, world</a></div>`)
    
                document.querySelector("a").dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                }))
                expect(eventTargets).toBeEqual(["div", "a"])
            })

            it("should create html w/ event placeholder that prevents defaults and stops propagation", () => {
                let eventTargets: Array<string> = []
                const callback = (label: string) => { eventTargets.push(label) }
    
                const template = (html`<div @click=${callback.bind(null, "div")}><a @click+stopPropagation=${callback.bind(null, "a")}>Hello, world</a></div>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><a>Hello, world</a></div>`)
    
                document.querySelector("a").dispatchEvent(new MouseEvent("click", {
                    bubbles: true,
                }))
                expect(eventTargets).toBeEqual(["a"])
            })
    
            it("should create html w/ update placeholder", () => {
                let element: Element | null = null
                const callback = (e: CustomEvent) => { element = e.target as Element}
    
                const template = (html`<a @update=${callback}>Hello, world</a>`)
                updateElement(document.body, template)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<a>Hello, world</a>`)
                expect(element.nodeName).toBe("A")
            })
    
            it("should render nested html template and propagate @update event", () => {
                let updateCalled = false
                updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled = true }}></span>`}</div>`)        
                expect(updateCalled).toBe(true)
            })

            it("should render list of nested html template and propagate @update event", () => {
                let updateCalled = 0
                updateElement(document.body, [html`<div>${html`<span @update=${() => { updateCalled++ }}></span>`}</div>`])
                expect(updateCalled).toBe(1)
            })
        })

        describe("iterables", () => {
            it("should render array of strings as placeholder", () => {
                updateElement(document.body, html`<ul>${"abc".split("")}</ul>`)

                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul>abc</ul>`)
            })

            it("should render array of nested templates as placeholder", () => {
                updateElement(document.body, html`<ul>${"abc".split("").map(s => html`<li>${s}</li>`)}</ul>`)

                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>a</li><li>b</li><li>c</li></ul>`)
            })

            it("should render nested iterables", () => {
                const li = (content: ElementUpdate) => html`<li>${content}</li>`
                const ul = (items: Array<ElementUpdate>) => html`<ul>${items}</ul>`

                updateElement(document.body, ul([li("foo"), li("bar"), li(ul([li("spam"), li("eggs")]))]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>foo</li><li>bar</li><li><ul><li>spam</li><li>eggs</li></ul></li></ul>`)
            })

            it("should render nested iterables with mixed content", () => {
                const li = (content: ElementUpdate) => html`<li>${content}</li>`
                const ul = (items: Array<ElementUpdate>) => html`<ul>${items}</ul>`

                updateElement(document.body, ul([li("foo"), li("bar"), li(ul([li(html`<em>spam</em> and ${"eggs"}`), li("eggs")]))]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>foo</li><li>bar</li><li><ul><li><em>spam</em> and eggs</li><li>eggs</li></ul></li></ul>`)
            })
        })

        describe("using nested tagged templates", () => {
            describe("nested tagged html", () => {
                it("should create html with nested mixed content", () => {
                    const p = (content: ElementUpdate) => html`<p>${content}</p>`
    
                    updateElement(document.body, p(html`<em>spam</em> and ${"eggs"}`))
                    expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p><em>spam</em> and eggs</p>`)
                })
            })

            it("should create html w/ placeholder containing nested html", () => {
                updateElement(document.body, html`<p>${html`<em>hello, world!</em>`}</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p><em>hello, world!</em></p>")
            })

            it("should create html w/ placeholder containing nested html and static elements", () => {
                updateElement(document.body, html`<p>hello, ${html`<em>world!</em>`}</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, <em>world!</em></p>")
            })
    
            it("should create html w/ placeholder containing nested element", () => {
                const e = document.createElement("em")
                e.appendChild(document.createTextNode("hello, world!"))
                updateElement(document.body, html`<p>${e}</p>`)
    
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p><em>hello, world!</em></p>")
            })
        })

        describe("re-rendering of template applied previously", () => {
            it("should only update changed text nodes", () => {
                const tpl = (name: string) => html`<p>hello, ${name}!</p>`
                updateElement(document.body, tpl("world"))
                document.querySelector("p").setAttribute("data-test-marker", "test")
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p data-test-marker="test">hello, world!</p>`)
    
                updateElement(document.body, tpl("foo"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p data-test-marker="test">hello, foo!</p>`)
            })

            it("should only update changed attribute values", () => {
                const tpl = (name: string) => html`<p data-name=${name}>hello, world!</p>`
                
                updateElement(document.body, tpl("world"))
                document.querySelector("p").setAttribute("data-test-marker", "test");
                (document.querySelector("p").firstChild as Text).data = "foobar"                
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p data-name="world" data-test-marker="test">foobar</p>`)
    
                updateElement(document.body, tpl("foo"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<p data-name="foo" data-test-marker="test">foobar</p>`)
            })

            it("should re-render updated nested template", () => {
                const tpl = (name: string) => html`<p>hello, ${name}!</p>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl("world")))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><p>hello, world!</p></div>`)

                updateElement(document.body, wrapper(tpl("foo")))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><p>hello, foo!</p></div>`)
            })

            it("should re-render different nested template", () => {
                const tpl1 = () => html`<p>hello, world!</p>`
                const tpl2 = () => html`<p>hello, foo!</p>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl1()))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><p>hello, world!</p></div>`)

                updateElement(document.body, wrapper(tpl2()))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><p>hello, foo!</p></div>`)
            })

            it("should re-render differently structured nested template", () => {
                const tpl1 = () => html`<p>hello, world!</p>`
                const tpl2 = () => html`<span>foobar</span>`
                const wrapper = (content: ElementUpdate) => html `<div>${content}</div>`

                updateElement(document.body, wrapper(tpl1()))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><p>hello, world!</p></div>`)

                updateElement(document.body, wrapper(tpl2()))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<div><span>foobar</span></div>`)
            })

            it("should re-render nested list template w/ more elements than before", () => {
                const tpl = (items: Array<string>) => html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`

                updateElement(document.body, tpl(["z"]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>z</li></ul>`)

                updateElement(document.body, tpl(["a", "b", "c"]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>a</li><li>b</li><li>c</li></ul>`)
            })
    
            it("should re-render nested list template w/ less elements than before", () => {
                const tpl = (items: Array<string>) => html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
                
                updateElement(document.body, tpl(["a", "b", "c"]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>a</li><li>b</li><li>c</li></ul>`)

                updateElement(document.body, tpl(["z"]))
                expect(removeMarkerComments(document.body.innerHTML)).toBe(`<ul><li>z</li></ul>`)
            })

            it("should re-render nested html template and propagate @update event", () => {
                let updateCalled = 0
    
                updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled++ }}>hello, ${"world"}!</span>`}</div>`)
                expect(removeMarkerComments(document.querySelector("span").innerHTML)).toBe("hello, world!")
                expect(updateCalled).toBe(1)
                
                updateElement(document.body, html`<div>${html`<span @update=${() => { updateCalled++ }}>hello, ${"foo"}!</span>`}</div>`)
                expect(removeMarkerComments(document.querySelector("span").innerHTML)).toBe("hello, foo!")
                expect(updateCalled).toBe(2)
            })            

            it("should re-render nested html tag with same values", () => {
                const tpl = (name: string) => html`<p>hello, ${html`<em>${name}</em>`}</p>`

                updateElement(document.body, tpl("world"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, <em>world</em></p>")

                updateElement(document.body, tpl("foo"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, <em>foo</em></p>")
            })

            it("should re-render nested html followed by string", () => {
                const tpl = (name: ElementUpdate) => html`<p>hello, ${name}</p>`

                updateElement(document.body, tpl(html`<em>${"world"}</em>`))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, <em>world</em></p>")

                updateElement(document.body, tpl("foo"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, foo</p>")
            })

            it("should re-render nested html followed by string", () => {
                const tpl = (name: ElementUpdate) => html`<p>hello, ${name}</p>`
                
                updateElement(document.body, tpl("foo"))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, foo</p>")

                updateElement(document.body, tpl(html`<em>${"world"}</em>`))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, <em>world</em></p>")
            })

            it("should remove rendered html when re-rendering empty string", () => {
                updateElement(document.body, html`<p>hello, world</p>`)
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")

                updateElement(document.body, "")
                expect(removeMarkerComments(document.body.innerHTML)).toBe("")
            })

            it("should remove rendered html when re-rendering empty string as nested template", () => {
                const nested = () => html`<p>world</p>`
                const tpl = (flag: boolean) => html`<p>hello</p> ${flag ? nested() : ""}`

                updateElement(document.body, tpl(true))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello</p> <p>world</p>")

                updateElement(document.body, tpl(false))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello</p> ")
            })

            it("should remove rendered html when re-rendering string with template and string again as nested template", () => {
                const nested = () => html`<p>world</p>`
                const tpl = (flag: boolean) => html`<p>hello</p> ${flag ? nested() : ""}`

                updateElement(document.body, tpl(false))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello</p> ")

                updateElement(document.body, tpl(true))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello</p> <p>world</p>")

                updateElement(document.body, tpl(false))
                expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello</p> ")
            })
        })
    })
})