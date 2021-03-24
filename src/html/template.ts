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


export class HtmlTemplateCache {
    static readonly instance = new HtmlTemplateCache()

    private readonly entries = new WeakMap<TemplateStringsArray, HtmlTemplate>()

    has(strings: TemplateStringsArray): boolean {
        return this.entries.has(strings)
    }

    get(strings: TemplateStringsArray): HtmlTemplate {
        return this.entries.get(strings)
    }

    set(strings: TemplateStringsArray, value: HtmlTemplate) {
        this.entries.set(strings, value)
    }
}

const elementTemplateMap = new WeakMap<UpdateTarget, HtmlTemplate>()

export class HtmlTemplate implements ElementUpdater {
    private _templateString: string | undefined
    private _templateElement: HTMLTemplateElement | undefined
    private bindings: Array<Binding> | undefined

    constructor(private readonly strings: TemplateStringsArray, private data: ReadonlyArray<any>) { }

    get templateString(): string {
        if (typeof this._templateString === "undefined") {
            this._templateString = generateHtml(this.strings)
        }
        return this._templateString
    }

    get templateElement(): HTMLTemplateElement {
        if (typeof this._templateElement === "undefined") {
            this._templateElement = document.createElement("template")
            this._templateElement.innerHTML = this.templateString
            this.bindings = determineBindings(this._templateElement.content)
        }
        return this._templateElement
    }

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