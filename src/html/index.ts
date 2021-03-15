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
import { WeccoElement } from "../element"
import { ElementUpdater, UpdateTarget } from "../update"
import { AttributeBinding, Binding, CommentNodeBinding, ElementNotFound, ElementSelector } from "./binding"
import { md5 } from "./md5"

/**
 * `html` is a string tag to be used with string templates. The tag generates
 * an `ElementUpdater` that can be used as a return from a wecco element's render
 * callback.
 * @param strings the string parts of the template
 * @param args the arguments of the template
 */
export function html(strings: TemplateStringsArray, ...args: any): ElementUpdater {
    const key = HtmlTemplateCache.calculateCacheKey(strings)

    if (HtmlTemplateCache.instance.has(key)) {
        return HtmlTemplateCache.instance.get(key).clone(args)
    }

    const result = HtmlTemplate.fromTemplateString(strings, args)
    HtmlTemplateCache.instance.set(key, result)

    return result
}

class HtmlTemplateCache {
    static readonly instance = new HtmlTemplateCache()

    static calculateCacheKey(strings: TemplateStringsArray): string {
        return md5(strings.join(""))
    }

    private readonly entries = new Map<string, HtmlTemplate>()

    has(key: string): boolean {
        return this.entries.has(key)
    }

    get(key: string): HtmlTemplate {
        return this.entries.get(key)
    }

    set(key: string, value: HtmlTemplate) {
        this.entries.set(key, value)
    }
}

const PlaceholderAttributeRegex = /[a-z0-9-_@]+\s*=\s*$/i;
const PlaceholderSingleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*'[^']*$/i;
const PlaceholderDoubleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*"[^"]*$/i;

class HtmlTemplate implements ElementUpdater {
    private readonly templateString: string
    private readonly data: any[]

    private readonly template: HTMLTemplateElement
    private readonly bindings: Binding[] = []

    static calculateId(strings: TemplateStringsArray): string {
        return md5(HtmlTemplate.generateHtml(strings))
    }

    static fromTemplateString(strings: TemplateStringsArray, args: any[]): HtmlTemplate {
        const templateString = HtmlTemplate.generateHtml(strings)

        const template = document.createElement("template")
        template.innerHTML = templateString
        return new HtmlTemplate(HtmlTemplate.calculateId(strings), templateString, args, template)
    }

    private constructor(private readonly id: string, templateString: string, data: any[], template: HTMLTemplateElement) {
        this.templateString = templateString
        this.data = data
        this.template = template
        this.determineBindings(this.template.content)
    }

    clone(args: any): HtmlTemplate {
        return new HtmlTemplate(this.id, this.templateString, args, this.template)
    }

    createContentElements(): Node[] {
        const content = this.template.content.cloneNode(true) as DocumentFragment
        this.bindings.forEach(b => b.applyBinding(content, this.data))
        return Array.prototype.slice.call(content.childNodes)
    }

    updateElement(host: UpdateTarget) {
        if (host instanceof Element && host.getAttribute("data-wecco-template-id") === this.id) {
            try {
                this.bindings.forEach(b => b.applyBinding(host, this.data))
                if (host.isConnected) {
                    this.notifyMounted(host.childNodes)
                }
                return
            } catch (e) {
                if (e !== ElementNotFound) {
                    throw e
                }
                // Some external DOM manipulation occured after this template has been
                // rendered the last time. Continue by re-rendering the template to
                // ensure consistency.
                console.warn("Element has been modified. Rerendering", host)
            }
        }

        removeAllChildren(host)
        this.createContentElements().forEach(e => {
            host.appendChild(e)
        })

        if (host instanceof Element) {
            host.setAttribute("data-wecco-template-id", this.id)
        }

        if (host.isConnected) {
            this.notifyMounted(host.childNodes)
        }
    }

    private notifyMounted(nodes: NodeList) {
        nodes.forEach(n => {
            if (!(n instanceof EventTarget)) {
                return
            }

            n.dispatchEvent(new CustomEvent("mount", {
                bubbles: false,
            }))

            if (n instanceof WeccoElement) {
                // Do not apply mount events on children of wecco custom elements.
                // These emit their own mount event.
                return
            }

            this.notifyMounted(n.childNodes)
        })
    }

    private determineBindings(root: Node) {
        this.determineNodeBindings(root, root)
    }

    private determineNodeBindings(node: Node, root: Node) {
        if (node instanceof WeccoElement) {
            // Do not visit bindings in custom elements.
            // Custom Elements have their own lifecycle and 
            // are excluded from the normal render cycle.
            return
        }

        if (node instanceof Comment) {
            const pattern = /^\{\{wecco:([0-9]+)(\/[a-z]+)?\}\}$/g
            while (true) {
                const match = pattern.exec(node.textContent || "")
                if (!match) {
                    break
                }

                let selector: ElementSelector
                if (!node.parentElement || node.parentElement === root) {
                    selector = ElementSelector.root()
                } else {
                    let weccoId = node.parentElement.getAttribute("data-wecco-id")
                    if (!weccoId) {
                        weccoId = HtmlTemplate.generateId()
                        node.parentElement.setAttribute("data-wecco-id", weccoId)
                    }
                    selector = new ElementSelector(`[data-wecco-id="${weccoId}"]`)
                }

                this.bindings.push(new CommentNodeBinding(selector, parseInt(match[1])))
            }

            return
        }

        if (node instanceof Element) {
            node.getAttributeNames().forEach(attr => {
                const value = node.getAttribute(attr)
                const pattern = /\{\{wecco:([0-9]+)\}\}/g

                while (true) {
                    const match = pattern.exec(value)
                    if (!match) {
                        break
                    }

                    let weccoId = node.getAttribute("data-wecco-id")
                    if (!weccoId) {
                        weccoId = HtmlTemplate.generateId()
                        node.setAttribute("data-wecco-id", weccoId)
                    }

                    this.bindings.push(new AttributeBinding(attr, new ElementSelector(`[data-wecco-id="${weccoId}"]`), parseInt(match[1])))
                }
            })
        }

        node.childNodes.forEach(c => {
            this.determineNodeBindings(c, root)
        })
    }

    private static generateHtml(strings: TemplateStringsArray) {
        let html = ""

        strings.forEach((s, i) => {
            html += s
            if (i < strings.length - 1) {
                if (PlaceholderAttributeRegex.test(html) || PlaceholderSingleQuotedAttributeRegex.test(html) || PlaceholderDoubleQuotedAttributeRegex.test(html)) {
                    // Placeholder is used as an attribute value. Insert placeholder
                    html += `{{wecco:${i}}}`
                } else {
                    // Placeholder is used as text content. Insert a comment node
                    html += `<!--{{wecco:${i}/start}}--><!--{{wecco:${i}/end}}-->`
                }
            }
        })

        return html.trim()
    }

    private static idCounter = 0

    private static generateId(): string {
        return `${this.idCounter++}`
    }
}
