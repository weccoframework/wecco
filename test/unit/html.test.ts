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
import { updateElement } from "../../src/update"
import { html } from "../../src/html"

describe("html.ts", async () => {
    beforeEach(() => {
        document.body = document.createElement("body")
    })

    describe("html", () => {
        it("should create html w/o placeholder", () => {
            updateElement(document.body, html`<p>Hello, world</p>`)

            expect(document.body.innerHTML).toBe("<p>Hello, world</p>")
        })

        it("should create html w/ placeholder", () => {
            const gretee = "world";

            updateElement(document.body, html`<p>Hello, ${gretee}</p>`)

            expect(document.body.innerHTML).toMatch(/^<p data-wecco-id="\d">Hello, <!--{{wecco:0\/start}}-->world<!--{{wecco:0\/end}}--><\/p>/)
        })

        it("should create html w/ toplevel placeholder", () => {
            const gretee = "world";

            updateElement(document.body, html`<p>Hello</p>${gretee}`)

            expect(document.body.innerHTML).toMatch(/^<p>Hello<\/p><!--{{wecco:0\/start}}-->world<!--{{wecco:0\/end}}-->/)
        })

        it("should create html w/ multiple adjecent placeholder", () => {
            const message = "Hello, ";
            const gretee = "world";

            updateElement(document.body, html`<p>${message}${gretee}</p>`)

            expect(document.body.innerHTML).toMatch(/^<p data-wecco-id="\d"><!--{{wecco:0\/start}}-->Hello, <!--{{wecco:0\/end}}--><!--{{wecco:1\/start}}-->world<!--{{wecco:1\/end}}--><\/p>/)
        })

        it("should create html w/ attribute placeholder", () => {
            const classes = "hero small"

            const template = (html`<p class=${classes}>Hello, world</p>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toMatch(/^<p class="hero small" data-wecco-id="\d">Hello, world<\/p>$/)
        })

        it("should create html w/ boolean attribute placeholder set to false", () => {
            const disabled = false
            const template = (html`<a ?disabled=${disabled}>Hello, world</a>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toMatch(/^<a data-wecco-id="\d">Hello, world<\/a>$/)
        })

        it("should create html w/ boolean attribute placeholder set to true", () => {
            const disabled = true
            const template = (html`<a ?disabled=${disabled}>Hello, world</a>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toMatch(/^<a data-wecco-id="\d" disabled="disabled">Hello, world<\/a>$/)
        })

        it("should create html w/ event placeholder", () => {
            let clicked = false
            const callback = () => { clicked = true }

            const template = (html`<a @click=${callback}>Hello, world</a>`)
            updateElement(document.body, template)

            expect(document.body.innerHTML).toMatch(/^<a data-wecco-id="\d">Hello, world<\/a>$/)

            document.querySelector("a").dispatchEvent(new MouseEvent("click"))
            expect(clicked).toBe(true)
        })

        it("should render nested html template and propagate @mount event", () => {
            let mountCalled = false
            updateElement(document.body, html`<div>${html`<span @mount=${() => { mountCalled = true }}></span>`}</div>`)        
            expect(mountCalled).toBe(true)
        })

        it("should re-render nested html template and propagate @mount event", () => {
            let mountCalled = 0

            updateElement(document.body, html`<div>${html`<span @mount=${() => { mountCalled++ }}></span>`}</div>`)
            expect(mountCalled).toBe(1)
            
            updateElement(document.body, html`<div>${html`<span @mount=${() => { mountCalled++ }}></span>`}</div>`)
            expect(mountCalled).toBe(2)
        })
    })
})