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

import { removeNodes } from "../dom"
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
     * Bind this binding to the node given.
     * Is called once after the template's content has been cloned
     * when nodes are iterated.
     * 
     * Implementations are responsible for checking if the node and
     * traversal index should be handled.
     * 
     * @param node the node
     * @param nodeIndex the traversal index
     */
    bind(node: Node, nodeIndex: number): void

    /**
     * Applies the given data to the bound node.
     * 
     * Called multiple times to update the bound data.s
     * 
     * @param data all placeholder values
     */
    applyData(data: Array<any>): void
}

/**
 * Base class for implementing `Binding`s that handle a single data index.
 */
abstract class BindingBase implements Binding {
    protected node: Node
    protected boundData: any
    
    constructor (protected readonly nodeIndex: number) {}

    // Base implementation which handes nodeIndex check and data changed check.
    // Calls doApply in case an update is needed
    bind(node: Node, nodeIndex: number): void {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        this.bindNode(node)
    }
    
    protected bindNode(node: Node): void {
        this.node = node
    }

    applyData(data: Array<any>): void {
        if (this.boundData === data) {
            return
        }

        this.applyChangedData(data)

        this.boundData = data
    }
    
    protected abstract applyChangedData(data: Array<any>): void
}

/**
 * An implementation of `Insert` which modifies `Node`s in the DOM.
 * Modifications can be constrained to a single `TextNode` or they
 * can include whole subtrees.
 */
class NodeBinding extends BindingBase {
    private startMarker: Node | undefined
    private endMarker: Node | undefined

    constructor (nodeIndex: number, private readonly dataIndex: number) {
        super(nodeIndex)
    }

    protected bindNode(node: Node): void {        
        super.bindNode(node);

        // Use the node as the end marker.
        // Simplify the comment for that purpose
        (node as Comment).data = ""
        this.endMarker = node

        // Create a start marker comment and insert it
        // directly before the end marker
        this.startMarker = document.createComment("")
        node.parentElement.insertBefore(this.startMarker, node)
    }

    protected applyChangedData(data: Array<any>): void {
        const dataItem = data[this.dataIndex]
        // if (isIterable(dataItem)) {
        //     this.applyIterable(node, dataItem, previousDataItem)
        // } else if (isElementUpdate(dataItem)) {
        if (isElementUpdate(dataItem)) {
            this.applyElementUpdate(dataItem)
        } else {
            this.applyText(String(dataItem))
        }
    }

    private applyElementUpdate(update: ElementUpdate) {        
        // Remove all nodes between start and end in case a previous render run
        // has created data
        this.clear()

        // Apply the update to sideboard template element, then move
        // all nodes before node.
        const fragment = document.createDocumentFragment()
        updateElement(fragment, update, false)
        this.node.parentElement.insertBefore(fragment, this.node)
    }

    private applyText(text: string) {
        if (isMarker(this.node)) {
            // The actual node is a marker node (a comment with the {{wecco:...}} content).
            // Insert a new text node before the marker, remove the marker
            // and update this node to point to the text node

            const textNode = document.createTextNode(text)
            this.node.parentElement.insertBefore(textNode, this.endMarker)

            if ((typeof this.startMarker === "undefined") && (typeof this.endMarker === "undefined")) {
                // If the marker was the only child, remove it as we keep track of the insert point
                // using the create text node
                this.node.parentElement.removeChild(this.node)
            }

            this.node = textNode
            return
        }

        if (this.node.nodeType === Node.TEXT_NODE) {
            (this.node as Text).data = text
            return
        }

        console.error(`Expected ${this.node} to be of type Text`)
        throw DomInconsistencyError
    }

    private clear (): void {
        const firstNodeToRemove = this.startMarker
            ? this.startMarker.nextSibling
            : this.node.parentElement.firstChild

        removeNodes(firstNodeToRemove, this.endMarker ?? this.node)
    }
}

/**
 * An implementation of `Binding` which modifies a single attribute of a DOM `Element`.
 */
class AttributeBinding extends BindingBase {
    private element: Element

    constructor(nodeIndex: number, private readonly attributeName: string, private readonly valueInstructions: Array<string | number>) { 
        super(nodeIndex)
    }

    protected bindNode (node: Node): void {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
        super.bindNode(node)
    }

    protected applyChangedData(data: Array<any>): void {
        this.element.setAttribute(this.attributeName, this.valueInstructions.map(vi => (typeof vi === "string") ? vi : data[vi]).join(""))
    }
}

/**
 * An implementation of `Binding` which handles the special boolean attributes, that are prefixed with `?`.
 */
class BooleanAttributeBinding extends BindingBase {
    private element: Element

    constructor(nodeIndex: number, private readonly attributeName: string, private readonly dataIndex: number) {
        super(nodeIndex)
    }

    protected bindNode (node: Node): void {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
        super.bindNode(node)
    }

    protected applyChangedData(data: Array<any>): void {
        const dataItem = data[this.dataIndex]
        if (!!dataItem) {
            this.element.setAttribute(this.attributeName, this.attributeName)
        } else {
            this.element.removeAttribute(this.attributeName)
        }
    }
}

/**
 * An implemenation of `Binding` which attaches eventlisteners to nodes.
 */
class EventListenerAttributeBinding extends BindingBase {
    private element: Element

    constructor(nodeIndex: number, private readonly eventName: string, private readonly dataIndex: number) { 
        super(nodeIndex)
    }

    protected bindNode (node: Node): void {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.eventName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
        super.bindNode(node)
    }

    protected applyChangedData(data: Array<any>): void {
        const listener = data[this.dataIndex]

        if (typeof listener !== "function") {
            console.error(`Cannot add ${listener} as event listener for ${this.eventName} to ${this.element}`)
        }

        EventRegistry.instance.removeAllEventListeners(this.element, this.eventName)
        EventRegistry.instance.addEventListener(this.element, this.eventName, listener)
    }
}

/**
 * Applies the given data to all given `Binding`s.
 * @param bindings the bindings
 * @param data the data
 */
export function applyData(bindings: Array<Binding>, data: Array<any>): void {
    bindings.forEach(b => b.applyData(data))
}

/**
 * Binds a set of `Binding`s to a DOM subtree rooted at `root` with the values provided as `data`.
 * @param bindings the bindings to apply
 * @param root the root of the DOM subtree to apply bindings to
 */
export function bindBindings(bindings: Array<Binding>, root: Node) {
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null)

    let nodeIndex = -1
    let node: Node

    while (node = treeWalker.nextNode()) {
        nodeIndex++
        bindings.forEach(b => b.bind(node, nodeIndex))
    }
}

/**
 * Determines the bindings described by the placeholders nested below `root`.
 * Walks the DOM subtree and collects `Bindings` returning the list of unbound
 * bindings.
 * @param root the root of the DOM subtree
 * @returns the determined bindings
 */
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
    if (node.nodeType !== Node.COMMENT_NODE) {
        return false
    }

    const comment = node as Comment
    return comment.data === "" || isPlaceholder(comment.data)
}

function isIterable (value: unknown): value is Iterable<unknown> {
    return Array.isArray(value) ||
        !!(value && (value as any)[Symbol.iterator])
}