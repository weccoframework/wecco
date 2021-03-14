/*
 * This file is part of wecco.
 * 
 * Copyright (c) 2019 - 2020 The wecco authors.
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

import { md5 } from "./md5"
import { ElementUpdater, isElementUpdate, moveAllChildren, removeAllChildren, updateElement, UpdateTarget } from "./dom"
import { EventRegistry } from "./eventregistry"
import { WeccoElement } from "./element"

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

interface Binding {
    applyBinding(root: UpdateTarget, data: any[]): void
}

class ElementSelector {
    static root(): ElementSelector {
        return new ElementSelector()
    }

    static build(target: Node, root: Node): ElementSelector {
        const parts = []

        while (target) {
            if (target === root) {
                break
            }
            parts.push(`${target.nodeName.toLowerCase()}:nth-of-type(${ElementSelector.countPreviousSiblingsOfSameType(target) + 1})`)
            target = target.parentNode
        }

        return new ElementSelector(parts.reverse().join(">"))
    }

    private static countPreviousSiblingsOfSameType(node: Node): number {
        let count = 0
        let sibling = node.previousSibling
        while (sibling) {
            if (sibling.nodeName === node.nodeName) {
                count++
            }
            sibling = sibling.previousSibling
        }

        return count
    }

    constructor(private readonly selector?: string) { }

    resolve(root: UpdateTarget): Node {
        if (!this.selector) {
            return root
        }
        return root.querySelector(this.selector)
    }

    toString(): string {
        return this.selector ?? ""
    }
}

const ElementNotFound = "element not found"

class CommentNodeBinding implements Binding {
    constructor(private location: ElementSelector, private index: number) { }

    applyBinding(root: UpdateTarget, data: any[]): void {
        const [insertPoint, startComment, endComment] = this.findNode(root)

        const nodesToRemove: Array<Node> = []
        let startSeen = false
        for (let child of Array.from(insertPoint.childNodes)) {
            if (child === startComment) {
                startSeen = true
            } else if (child === endComment) {
                break
            } else if (startSeen) {
                nodesToRemove.push(child)
            }
        }
        nodesToRemove.forEach(insertPoint.removeChild.bind(insertPoint))

        const d = data[this.index]
        let dataArray: any[]

        if (Array.isArray(d)) {
            dataArray = d
        } else {
            dataArray = [d]
        }

        dataArray.forEach(d => {
            if (isElementUpdate(d)) {
                const tpl = document.createElement("div")
                updateElement(tpl, d)
                moveAllChildren(tpl, insertPoint, endComment)
            } else {
                insertPoint.insertBefore(document.createTextNode(d), endComment)
            }
        })
    }

    private findNode(root: UpdateTarget): [Node, Comment | undefined, Comment | undefined] {
        let parent = this.location.resolve(root)

        if (parent) {
            const startCommentText = `{{wecco:${this.index}/start}}`
            const endCommentText = `{{wecco:${this.index}/end}}`
            let startComment: Comment | undefined = undefined
            let endComment: Comment | undefined = undefined

            for (let child of Array.from(parent.childNodes)) {
                if (child instanceof Comment) {
                    if (child.data === startCommentText) {
                        startComment = child
                    } else if (child.data === endCommentText) {
                        endComment = child
                    }

                    if ((typeof startComment !== "undefined") && (typeof endComment !== "undefined")) {
                        return [parent, startComment, endComment]
                    }
                }
            }
        }

        console.warn(`No such element with selector "${this.location}" nested under `, root)

        throw ElementNotFound
    }
}

class AttributeBinding implements Binding {
    constructor(private attributeName: string, private location: ElementSelector, private dataIndex: number) { }

    applyBinding(root: UpdateTarget, data: any[]): void {
        const node = this.location.resolve(root)

        if (!(node instanceof Element)) {
            console.warn(`No such element with selector "${this.location}" nested under `, root)
            throw ElementNotFound
        }

        const element = node as Element

        if (this.attributeName.startsWith("@")) {
            // If this is the first time this binding is applied, remove the @... attribute
            // from the DOM.
            element.removeAttribute(this.attributeName)

            const eventName = this.attributeName.substr(1)

            EventRegistry.instance.removeAllEventListeners(element, eventName)

            let callback: any
            if (eventName === "mount") {
                // The "mount" event is special to HtmlTemplates. It allows a listener to 
                // work on the actual DOM element, once it has been mounted. Thus, we 
                // bind the supplied listener to receive the element.
                callback = data[this.dataIndex].bind(null, element)
            } else {
                callback = data[this.dataIndex]
            }
            EventRegistry.instance.addEventListener(element, eventName, callback)
            return
        }

        if (this.attributeName.startsWith("?")) {
            element.removeAttribute(this.attributeName)
            if (data[this.dataIndex]) {
                const name = this.attributeName.substr(1)
                element.setAttribute(name, name)
            }

            return
        }

        let valueFromData = data[this.dataIndex] ?? ""

        let value = element.getAttribute(this.attributeName)
        value = value.replace(`{{wecco:${this.dataIndex}}}`, valueFromData)

        if (this.attributeName === "value" && element instanceof HTMLTextAreaElement) {
            element.innerText = value
        } else {
            element.setAttribute(this.attributeName, value)
        }
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
