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

import { moveAllChildren } from "../dom"
import { isElementUpdate, updateElement, UpdateTarget } from "../update"
import { EventRegistry } from "./eventregistry"

export interface Binding {
    applyBinding(root: UpdateTarget, data: any[]): void
}

export class ElementSelector {
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

export const ElementNotFound = "element not found"

export class CommentNodeBinding implements Binding {
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

export class AttributeBinding implements Binding {
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
