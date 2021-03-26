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

import { removeAllChildren } from "../dom"
import { ElementUpdater, UpdateTarget } from "../update"
import { applyData, bindBindings, Binding, determineBindings } from "./binding"
import { generatePlaceholder } from "./placeholder"

/**
 * A cache for re-using instances of `HtmlTemplate` to update only
 * changed parts.
 */
const elementTemplateMap = new WeakMap<UpdateTarget, HtmlTemplate>()

/**
 * An `ElementUpdater` that is created by the `html` string tag
 * function.
 * 
 * `HtmlTemplate`s implement DOM subtrees, that contain dynamic 
 * parts and that can be updated efficiently. 
 */
export class HtmlTemplate implements ElementUpdater {
    private _templateString: string | undefined
    private _templateElement: HTMLTemplateElement | undefined
    private _bindings: Array<Binding> | undefined

    /**
     * Constructs a `HtmlTemplate` from an array of static strings and an
     * array of dynamic data elements.
     * @param strings the strings as passed to the `html` string tag
     * @param data the data arguments as passed to the `html` string tag
     */
    constructor(private readonly strings: TemplateStringsArray, public data: ReadonlyArray<any>) { }

    /**
     * Generates a string containing the HTML markup as described by the strings array
     * as well as special placeholder marker.
     */
    get templateString(): string {
        if (typeof this._templateString === "undefined") {
            this._templateString = generateHtml(this.strings)
        }
        return this._templateString
    }

    /**
     * Create a `HTMLTemplateElement` containing the `templateString`.
     */
    get templateElement(): HTMLTemplateElement {
        if (typeof this._templateElement === "undefined") {
            this._templateElement = document.createElement("template")
            this._templateElement.innerHTML = this.templateString
            this._bindings = determineBindings(this._templateElement.content)
        }
        return this._templateElement
    }

    /**
     * Returns all `Binding`s used to update the dynamic parts of this template. 
     */
    get bindings(): ReadonlyArray<Binding> {
        if (typeof this._bindings === "undefined") {
            return []
        }

        return this._bindings
    }

    /**
     * Called to apply the DOM described by this template to the given target.
     * @param host the update target to apply the update to
     */
    updateElement(host: UpdateTarget) {
        if (elementTemplateMap.has(host)) {
            const tpl = elementTemplateMap.get(host)
            
            if (tpl.strings === this.strings) {
                tpl.data = this.data
                applyData(tpl.bindings, this.data)
                return
            }
        }        

        removeAllChildren(host)
        host.appendChild(this.templateElement.content.cloneNode(true))
        bindBindings(this.bindings, host)
        applyData(this.bindings, this.data)
        
        elementTemplateMap.set(host, this)
    }
}

const PlaceholderAttributeRegex = /[a-z0-9-_@]+\s*=\s*$/i;
const PlaceholderSingleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*'[^']*$/i;
const PlaceholderDoubleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*"[^"]*$/i;

/**
 * Generates a HTML markup string from the given static string parts.
 * Inserts placeholder strings between the static parts.
 * @param strings the strings array
 * @returns the HTML markup
 */
function generateHtml(strings: TemplateStringsArray) {
    let html = ""

    strings.forEach((s, i) => {
        html += s
        if (i < strings.length - 1) {
            if (PlaceholderAttributeRegex.test(html) || PlaceholderSingleQuotedAttributeRegex.test(html) || PlaceholderDoubleQuotedAttributeRegex.test(html)) {
                // Placeholder is used as an attribute value. Insert placeholder
                html += generatePlaceholder(i)
            } else {
                // Placeholder is used as text content. Insert a comment node
                html += `<!--${generatePlaceholder(i)}-->`
            }
        }
    })

    return html.trim()
}