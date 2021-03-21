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
import { ElementUpdate, isElementUpdate, updateElement } from "../update"
import { EventRegistry } from "./eventregistry"
import { extractPlaceholderId, isPlaceholder, splitAtPlaceholders } from "./placeholder"

/**
 * An error thrown in case an `Insert` discovers some inconsistency in the
 * DOM. This situation most commonly arises, when a template has been rendered
 * into an element but the rendered content is modified by some external DOM
 * operations when applying the insert.
 */
export const DomInconsistencyError = `DOM inconsistency error`

/**
 * A `Binding` defines how to apply a placeholder's value to the DOM.
 */
export interface Binding {
    /**
     * Applies this binding to the given `node` with traversal index
     * of `nodeIndex`. 
     * 
     * Every implementation is responsible for checking whether it
     * is bound for that given node or not.
     * 
     * @param node the node to apply a binding to
     * @param nodeIndex the node's traversal index
     * @param data all placeholder values
     * @param previousBinding optional binding produced by the same insert in a previous insert application for the given node
     */
    apply(node: Node, nodeIndex: number, data: Array<any>): void
}

/**
 * Base class for implementing `Binding`s that handle a single data index.
 */
abstract class BindingBase implements Binding {
    constructor (protected readonly nodeIndex: number, protected readonly dataIndex: number) {}

    // Base implementation which handes nodeIndex check and data changed check.
    // Calls doApply in case an update is needed
    apply(node: Node, nodeIndex: number, data: Array<any>): void {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        // if (data[this.dataIndex] === previousBinding?.data) {
        //     return
        // }

        this.doApply(node, nodeIndex, data[this.dataIndex])
    }

    /**
     * Applies the data. No further "is needed" checks are required as this method is 
     * only called, if nodeIndex matches and data has changed (or there is no previous)
     * data.
     * 
     * @param node the node
     * @param nodeIndex the node index
     * @param data the actual data
     */
    protected abstract doApply(node: Node, nodeIndex: number, data: unknown): void
}

/**
 * An implementation of `Insert` which modifies `Node`s in the DOM.
 * Modifications can be constrained to a single `TextNode` or they
 * can include whole subtrees.
 */
class NodeBinding extends BindingBase {
    protected doApply(node: Node, nodeIndex: number, dataItem: unknown): void {
        // if (isIterable(dataItem)) {
        //     this.applyIterable(node, dataItem, previousDataItem)
        // } else if (isElementUpdate(dataItem)) {
        if (isElementUpdate(dataItem)) {
            this.applyElementUpdate(node, dataItem)
        } else {
            this.applyText(node, String(dataItem))
        }
    }

    private applyIterable(node: Node, update: Iterable<unknown>) {
        if (!isMarker(node)) {
            // node.parentElement.insertBefore(createMarker(), node)
            // node.parentElement.removeChild(node)
        }        
        for (let u of update) {
            this.doApply(node, this.nodeIndex, u)
        }
    }

    private applyElementUpdate(node: Node, update: ElementUpdate) {
        // Apply the update to sideboard template element, then move
        // all nodes before node.
        // Finally remove node, as it is not needed anymore
        const tpl = document.createElement("template") as HTMLTemplateElement
        updateElement(tpl.content, update, false)
        moveAllChildren(tpl.content, node.parentNode, node)
        node.parentNode.removeChild(node)
    }

    private applyText(node: Node, text: string) {
        if (isMarker(node)) {
            // The actual node is a marker node (a comment with the {{wecco:...}} content).
            // First, simplify the comment by removing the placeholder id, 
            // then insert a text node directly before the marker comment.
            (node as Comment).data = ""
            node.parentElement.insertBefore(document.createTextNode(text), node)            
            return
        }

        if (node.nodeType === Node.TEXT_NODE) {
            (node as Text).data = text
            return
        }

        console.error(`Expected ${node} to be of type Text`)
        throw DomInconsistencyError
    }
}

/**
 * An implementation of `Binding` which modifies a single attribute of a DOM `Element`.
 */
class AttributeBinding implements Binding {
    constructor(private readonly nodeIndex: number, private readonly attributeName: string, private readonly valueInstructions: Array<string | number>) { }

    apply(node: Node, nodeIndex: number, data: Array<any>): void {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }

        (node as Element).setAttribute(this.attributeName, this.valueInstructions.map(vi => (typeof vi === "string") ? vi : data[vi]).join(""))
    }
}

/**
 * An implementation of `Binding` which handles the special boolean attributes, that are prefixed with `?`.
 */
class BooleanAttributeBinding extends BindingBase {
    constructor(nodeIndex: number, private readonly attributeName: string, dataIndex: number) { 
        super(nodeIndex, dataIndex)
    }

    doApply(node: Node, nodeIndex: number, dataItem: unknown): void {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }

        if (!!dataItem) {
            (node as Element).setAttribute(this.attributeName, this.attributeName)
        } else {
            (node as Element).removeAttribute(this.attributeName)
        }
    }
}

/**
 * An implemenation of `Binding` which attaches eventlisteners to nodes.
 */
class EventListenerAttributeBinding extends BindingBase {
    constructor(nodeIndex: number, private readonly eventName: string, dataIndex: number) { 
        super(nodeIndex, dataIndex)
    }

    doApply(node: Node, nodeIndex: number, dataItem: unknown): void {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to add event listener ${this.eventName} but got ${node}`)
            throw DomInconsistencyError
        }

        const listener = dataItem
        if (typeof listener !== "function") {
            console.error(`Cannot add ${listener} as event listener for ${this.eventName} to ${node}`)
        }

        EventRegistry.instance.removeAllEventListeners(node, this.eventName)
        EventRegistry.instance.addEventListener(node, this.eventName, listener)
    }
}

/**
 * Applies a set of `Binding`s to a DOM subtree rooted at `root` with the values provided as `data`.
 * @param root the root of the DOM subtree to apply bindings to
 * @param bindings the bindings to apply
 * @param data the data array
 * @param previousData the data array from the previous update cycle if the same set of inserts - if any
 */
export function applyBindings(root: Node, bindings: Array<Binding>, data: Array<any>) {
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null)

    let nodeIndex = -1
    let node: Node

    while (node = treeWalker.nextNode()) {
        nodeIndex++
        bindings.forEach(b => b.apply(node, nodeIndex, data))
    }
}

export function determineBindings(root: Node): Array<Binding> {
    const bindings: Array<Binding> = []
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null)
    let nodeIndex = -1
    let node: Node

    while (node = treeWalker.nextNode()) {
        // Walk the whole DOM subtree and detect nodes with a binding marker on it.
        // Use the nodeIndex as a pointer to this node
        nodeIndex++

        // if (node.nodeType === Node.TEXT_NODE) {
        //     const textNode = node as Text
        //     const parts = splitAtPlaceholders(textNode.data)

        //     if (parts.length === 1) {
        //         if (isPlaceholder(parts[0])) {
        //             // Text is a single marker. Use this node to later receive the value.
        //             bindings.push(new NodeBinding(nodeIndex, extractPlaceholderId(parts[0])))
        //         }
        //         // If the string does not start with the marker its a bare static text
        //         // and there is no need to create a binding.
        //         continue
        //     }

        //     // The text consists of multiple markers. We need to split the node's original
        //     // text and add comments for each marker
        //     parts.forEach(part => {
        //         if (isPlaceholder(part)) {
        //             // Its a marker. Insert a comment node and use this as the binding's
        //             // target.
        //             textNode.parentNode.insertBefore(createMarker(), textNode)
        //             bindings.push(new NodeBinding(nodeIndex, extractPlaceholderId(part)))
        //             nodeIndex++
        //             return
        //         }

        //         // We have some static text. Insert a text node.
        //         textNode.parentNode.insertBefore(document.createTextNode(part), textNode)
        //         nodeIndex++
        //     })

        //     // Finally, remove the original node
        //     textNode.parentNode.removeChild(textNode)
        //     nodeIndex--

        if (node.nodeType === Node.COMMENT_NODE) {
            const comment = node as Comment
            if (isPlaceholder(comment.data)) {
                bindings.push(new NodeBinding(nodeIndex, extractPlaceholderId(comment.data)))
            }

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            for (let name of element.getAttributeNames()) {
                const value = element.getAttribute(name)
                const parts = splitAtPlaceholders(value)

                if (name.startsWith("?")) {
                    // A ? starts a boolean attribute: one, that is either present or not.
                    // A boolean attribute must use a single marker as its value as the value
                    // is only used via javascript.
                    // Otherwise it is considered a syntax error. In any case
                    // the attribute is removed from the element as it is
                    // syntactically not correct.
                    element.removeAttribute(name)

                    if (parts.length !== 1 || !isPlaceholder(parts[0])) {
                        console.error(`Got syntax error using boolean attribute ${name}: Only single placeholder is allowed as value. Found at ${element}.`)
                        continue
                    }

                    bindings.push(new BooleanAttributeBinding(nodeIndex, name.substr(1), extractPlaceholderId(parts[0])))
                    continue
                }

                if (name.startsWith("@")) {
                    // A @ starts an event listener.
                    // An event listener must use a single marker as its value as the value
                    // is only used via javascript.
                    // Otherwise it is considered a syntax error. In any case
                    // the attribute is removed from the element as it is
                    // syntactically not correct.
                    element.removeAttribute(name)

                    if (parts.length !== 1 || !isPlaceholder(parts[0])) {
                        console.error(`Got syntax error using event listener ${name}: Only single placeholder is allowed as value. Found at ${element}.`)
                        continue
                    }

                    bindings.push(new EventListenerAttributeBinding(nodeIndex, name.substr(1), extractPlaceholderId(parts[0])))
                    continue
                }

                if (parts.length === 1 && !isPlaceholder(parts[0])) {
                    // The single value part contains no marker. Nothing to do.
                    continue
                }

                const valueInstructions: Array<string | number> = parts.map(part => {
                    if (isPlaceholder(part)) {
                        return extractPlaceholderId(part)
                    }
                    return part
                })

                bindings.push(new AttributeBinding(nodeIndex, name, valueInstructions))
            }
        }
    }

    return bindings
}

/**
 * Creates a marker Node to insert into the DOM.
 * @returns a marker node
 */
function createMarker(): Node {
    return document.createComment("")
}

function isMarker(node: Node): boolean {
    return node.nodeType === Node.COMMENT_NODE && isPlaceholder((node as Comment).data)
}

function isIterable (value: unknown): value is Iterable<unknown> {
    return Array.isArray(value) ||
        !!(value && (value as any)[Symbol.iterator])
}