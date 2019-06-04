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

import { expect } from "iko"
import { define, component, WeccoElement, ComponentFactory } from "../src/element"

interface ComponentData {
    s: string
    n: number
}

describe("element.ts", () => {
    let oldCreateElement: (tagName: string, options?: ElementCreationOptions) => HTMLElement

    beforeEach(() => {
        const definedElements: { [key: string]: Function } = {}
        window.customElements = {
            define(name, ctor) {
                definedElements[name] = ctor
            },

            get(name) {
                return definedElements[name]
            },

            upgrade(root) {
            },

            whenDefined(name) {
                return Promise.resolve()
            }
        }

        oldCreateElement = document.createElement
        document.createElement = (tagName: string, options?: ElementCreationOptions) => {
            const e = window.customElements.get(tagName)
            if (!e) {
                return oldCreateElement(tagName, options)
            }

            console.log(e)

            return new e()
        }

    })
    afterEach(() => {
        document.body.innerHTML = ""
        document.createElement = oldCreateElement
    })

    describe("define", () => {
        let component: ComponentFactory<ComponentData>
        beforeEach(() => {
            component = define("test-component", (data: ComponentData, notifyUpdate) => {
                return `<p>${data.s}: ${data.n}</p>`
            })
        })

        it("should register component", () => {
            expect(window.customElements.get("test-component")).toBeFunction()
        })

        it("should return factory for defined elements", () => {
            expect(component).toBeFunction()
        })
    })
})
