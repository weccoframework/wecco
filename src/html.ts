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

import { ContentProducer } from "./element"

/**
 * `html` is a string tag to be used with string templates. The tag generates
 * a `ContentProducer` that can be used as a return from a wecco element's render
 * callback.
 * @param strings the string parts of the template
 * @param args the arguments of the template
 */
export function html(strings: TemplateStringsArray, ...args: any): ContentProducer {
    const key = HtmlTemplateContentProducerCache.calculateCacheKey(strings)
    if (HtmlTemplateContentProducerCache.instance.has(key)) {
        return HtmlTemplateContentProducerCache.instance.get(key).clone(args)
    }

    const result = HtmlTemplateContentProducer.fromTemplateString(strings, args)
    HtmlTemplateContentProducerCache.instance.set(key, result)

    return result
}

class HtmlTemplateContentProducerCache {
    static readonly instance = new HtmlTemplateContentProducerCache()

    static calculateCacheKey(strings: TemplateStringsArray): string {
        let result = ""

        strings.forEach((s, i) => {
            result += s
            if (i < strings.length - 1) {
                result += `\${${i}}`
            }
        })

        return result
    }

    private readonly entries = new Map<string, HtmlTemplateContentProducer>()

    has(key: string): boolean {
        return this.entries.has(key)
    }

    get(key: string): HtmlTemplateContentProducer {
        return this.entries.get(key)
    }

    set(key: string, value: HtmlTemplateContentProducer) {
        this.entries.set(key, value)
    }
}

const WeccoHtmlIdDataAttributeName = "data-wecco-html-id"

interface Binding {
    applyBinding(root: DocumentFragment, data: any[]): void
}

class CommentNodeBinding implements Binding {
    constructor(private id: string | null, private index: number) { }

    applyBinding(root: DocumentFragment, data: any[]): void {
        const [insertPoint, comment] = this.findNode(root)

        const d = data[this.index]
        let dataArray: any[]

        if (Array.isArray(d)) {
            dataArray = d
        } else {
            dataArray = [d]
        }

        dataArray.forEach(d => {
            if (d instanceof Element) {
                insertPoint.insertBefore(d, comment)
            } else if (d instanceof HtmlTemplateContentProducer) {
                d.createContentElements().forEach(n => insertPoint.insertBefore(n, comment))
            } else {
                insertPoint.insertBefore(document.createTextNode(d), comment)
            }
        })
        insertPoint.removeChild(comment)
    }

    private findNode(root: DocumentFragment): [Element | DocumentFragment, Comment | null] {
        let parentElement: Element | DocumentFragment

        if (this.id === null) {
            parentElement = root
        } else {
            parentElement = root.querySelector(`[${WeccoHtmlIdDataAttributeName}="${this.id}"]`)
        }

        if (parentElement) {
            for (let child of Array.from(parentElement.childNodes)) {
                if ((child instanceof Comment) && (<Comment>child).data === `{{wecco-html-${this.index}}}`) {
                    return [parentElement, child]
                }
            }
        }

        console.error(`No such element with ${WeccoHtmlIdDataAttributeName}=${this.id} nested under `, root)
        return [parentElement, null]
    }
}

class AttributeBinding implements Binding {
    constructor(private attributeName: string, private elementId: string, private dataIndex: number) { }

    applyBinding(root: DocumentFragment, data: any[]): void {
        const node = root.querySelector(`[${WeccoHtmlIdDataAttributeName}="${this.elementId}"]`)

        if (!(node instanceof Element)) {
            console.error(`No such element with ${WeccoHtmlIdDataAttributeName}=${this.elementId} nested under `, root)
            return
        }

        const element = node as Element

        if (this.attributeName.startsWith("@")) {
            if (element.getAttribute(this.attributeName) !== `{{wecco-html-${this.dataIndex}}}`) {
                console.error("Invalid event listener binding:", element, this.attributeName)
                return
            }
            element.removeAttribute(this.attributeName)
            const eventName = this.attributeName.substr(1)
            if (eventName !== "mount") {
                element.addEventListener(eventName, data[this.dataIndex])
            } else {
                element.addEventListener(eventName, data[this.dataIndex].bind(null, element))
            }
        } else if (this.attributeName.startsWith("?")) {
            element.removeAttribute(this.attributeName)
            if (data[this.dataIndex]) {
                const name = this.attributeName.substr(1)
                element.setAttribute(name, name)
            }

        } else if (this.attributeName === "value" && element instanceof HTMLTextAreaElement) {
            let value = element.getAttribute(this.attributeName)
            value = value.replace(`{{wecco-html-${this.dataIndex}}}`, data[this.dataIndex])
            element.innerText = value
        } else {
            let value = element.getAttribute(this.attributeName)
            value = value.replace(`{{wecco-html-${this.dataIndex}}}`, data[this.dataIndex])
            element.setAttribute(this.attributeName, value)
        }
    }
}

const PlaceholderAttributeRegex = /[a-z0-9-_@]+\s*=\s*$/i;
const PlaceholderSingleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*'[^']*$/i;
const PlaceholderDoubleQuotedAttributeRegex = /[a-z0-9-_@]+\s*=\s*"[^"]*$/i;

class HtmlTemplateContentProducer implements ContentProducer {
    private readonly templateString: string
    private readonly data: any[]

    private readonly template: HTMLTemplateElement
    private readonly bindings: Binding[] = []

    static fromTemplateString(strings: TemplateStringsArray, args: any[]): HtmlTemplateContentProducer {
        const templateString = HtmlTemplateContentProducer.generateHtml(strings)

        const template = document.createElement("template")
        template.innerHTML = templateString
        return new HtmlTemplateContentProducer(templateString, args, template)
    }

    private constructor(templateString: string, data: any[], template: HTMLTemplateElement) {
        this.templateString = templateString
        this.data = data
        this.template = template
        this.determineBindings(this.template.content)
    }

    clone(args: any): HtmlTemplateContentProducer {
        return new HtmlTemplateContentProducer(this.templateString, args, this.template)
    }

    createContentElements(): Node[] {
        const content = this.template.content.cloneNode(true) as DocumentFragment
        this.bindings.forEach(b => b.applyBinding(content, this.data))
        return Array.prototype.slice.call(content.childNodes)
    }

    render(host: HTMLElement) {
        this.createContentElements().forEach(e => {
            host.appendChild(e)
            this.notifyMounted(e)
        })
    }

    private notifyMounted(e: Node) {
        e.childNodes.forEach(this.notifyMounted.bind(this))
        e.dispatchEvent(new CustomEvent("mount", {
            bubbles: false,
        }))
    }

    private determineBindings(node: Node) {
        if (node instanceof Comment) {
            const pattern = /^\{\{wecco-html-([0-9]+)\}\}$/g
            while (true) {
                const match = pattern.exec(node.textContent || "")
                if (!match) {
                    break
                }

                let id: string | null
                if (!node.parentElement) {
                    id = null
                } else if (node.parentElement.hasAttribute(WeccoHtmlIdDataAttributeName)) {
                    id = node.parentElement.getAttribute(WeccoHtmlIdDataAttributeName)
                } else {
                    id = HtmlTemplateContentProducer.generateId()
                    node.parentElement.setAttribute(WeccoHtmlIdDataAttributeName, id)
                }

                this.bindings.push(new CommentNodeBinding(id, parseInt(match[1])))
            }
        }

        if (node instanceof Element) {
            node.getAttributeNames().forEach(attr => {
                const value = node.getAttribute(attr)
                const pattern = /\{\{wecco-html-([0-9]+)\}\}/g

                while (true) {
                    const match = pattern.exec(value)
                    if (!match) {
                        break
                    }

                    let id: string
                    if (node.hasAttribute(WeccoHtmlIdDataAttributeName)) {
                        id = node.getAttribute(WeccoHtmlIdDataAttributeName)
                    } else {
                        id = HtmlTemplateContentProducer.generateId()
                        node.setAttribute(WeccoHtmlIdDataAttributeName, id)
                    }

                    this.bindings.push(new AttributeBinding(attr, id, parseInt(match[1])))
                }
            })
        }

        node.childNodes.forEach((c, i) => {
            this.determineBindings(c)
        })
    }

    private static generateHtml(strings: TemplateStringsArray) {
        let html = ""

        strings.forEach((s, i) => {
            html += s
            if (i < strings.length - 1) {
                if (PlaceholderAttributeRegex.test(html) || PlaceholderSingleQuotedAttributeRegex.test(html) || PlaceholderDoubleQuotedAttributeRegex.test(html)) {
                    // Placeholder is used as an attribute value. Insert placeholder
                    html += `{{wecco-html-${i}}}`
                } else {
                    // Placeholder is used as text content. Insert a comment node
                    html += `<!--{{wecco-html-${i}}}-->`
                }
            }
        })

        return html
    }

    private static generateId() {
        const firstPart = (Math.random() * 46656) | 0
        const secondPart = (Math.random() * 46656) | 0
        return ("000" + firstPart.toString(36)).slice(-3) + ("000" + secondPart.toString(36)).slice(-3)
    }
}
