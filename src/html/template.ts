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

import { moveAllChildren, removeAllChildren } from "../dom"
import { ElementUpdater, UpdateTarget } from "../update"
import { applyBindings, Binding, determineBindings } from "./binding"
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
    private readonly templateString: string
    private readonly data: Array<any>
    private readonly bindings: Array<Binding>
    private readonly templateElement: HTMLTemplateElement

    static fromTemplateString(strings: TemplateStringsArray, args: any[]): HtmlTemplate {
        const templateString = generateHtml(strings)
        const templateElement = HtmlTemplate.createTemplateElement(templateString)

        return new HtmlTemplate(templateString, args, templateElement, determineBindings(templateElement.content))
    }

    private static createTemplateElement(templateString: string): HTMLTemplateElement {
        const tpl = document.createElement("template")
        tpl.innerHTML = templateString
        return tpl
    }

    private constructor(templateString: string, data: any[], templateElement: HTMLTemplateElement, inserts: Array<Binding>) {
        this.templateString = templateString
        this.data = data
        this.templateElement = templateElement
        this.bindings = inserts
    }

    clone(args: Array<any>): HtmlTemplate {
        return new HtmlTemplate(this.templateString, args, this.templateElement, this.bindings)
    }

    updateElement(host: UpdateTarget) {
        // if (elementTemplateMap.has(host)) {
        //     const tpl = elementTemplateMap.get(host)                    
            
        //     if (tpl.templateElement === this.templateElement) {
        //         applyBindings(host, this.bindings, this.data)
        //         elementTemplateMap.set(host, this)
        
        //         return
        //     }
        // }        

        removeAllChildren(host)
        moveAllChildren(this.templateElement.content.cloneNode(true), host)
        applyBindings(host, this.bindings, this.data)
        
        // elementTemplateMap.set(host, this)
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