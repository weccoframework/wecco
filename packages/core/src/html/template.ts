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

import { removeAllChildren, removeNodes } from "../dom"
import { ElementUpdate, ElementUpdater, isElementUpdate, updateElement, UpdateTarget } from "../update"
import { extractPlaceholderId, generatePlaceholder, isPlaceholder, splitAtPlaceholders } from "./placeholder"

/**
 * A cache for re-using instances of `HtmlTemplate` to update only
 * changed parts.
 */
class ElementTemplateCacheEntry {
    constructor (readonly template: HtmlTemplate, readonly bindings: Array<Binding>) {}
}

const elementTemplateMap = new WeakMap<UpdateTarget, ElementTemplateCacheEntry>()

/**
 * An `ElementUpdater` that is created by the `html` string tag
 * function.
 * 
 * `HtmlTemplate`s implement DOM subtrees, that contain dynamic 
 * parts and that can be updated efficiently. 
 */
export class HtmlTemplate implements ElementUpdater {
    private _templateString: string | undefined
    private _attributeMappings: Map<string, string>
    private _templateElement: HTMLTemplateElement | undefined
    private _bindingDescriptors: Array<BindingDescriptor> | undefined

    /**
     * Constructs a `HtmlTemplate` from an array of static strings and an
     * array of dynamic data elements.
     * @param strings the strings as passed to the `html` string tag
     * @param data the data arguments as passed to the `html` string tag
     */
    constructor(private readonly strings: TemplateStringsArray, public data: ReadonlyArray<unknown>) { }

    /**
     * Generates a string containing the HTML markup as described by the strings array
     * as well as special placeholder marker.
     */
    get templateString(): string {
        if (typeof this._templateString === "undefined") {
            [this._templateString, this._attributeMappings] = generateHtml(this.strings)
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
            this._bindingDescriptors = determineBindingDescriptors(this._templateElement.content, this)
        }
        return this._templateElement
    }

    /**
     * Returns all `Binding`s used to update the dynamic parts of this template. 
     */
    get bindingDescriptors(): ReadonlyArray<BindingDescriptor> {
        if (typeof this._bindingDescriptors === "undefined") {
            return []
        }

        return this._bindingDescriptors
    }

    /**
     * Called to apply the DOM described by this template to the given target.
     * @param host the update target to apply the update to
     */
    updateElement(host: UpdateTarget) {
        if (elementTemplateMap.has(host)) {
            const cacheEntry = elementTemplateMap.get(host)

            if (cacheEntry.template.strings === this.strings) {                
                applyData(cacheEntry.bindings, this.data)
                return
            }
        }

        removeAllChildren(host)
        host.appendChild(this.templateElement.content.cloneNode(true))
        const bindings = bindBindings(this.bindingDescriptors, host)
        applyData(bindings, this.data)

        elementTemplateMap.set(host, new ElementTemplateCacheEntry(this, bindings))
    }

    /**
     * Returns the name of the attribute the given placeholder is used with in
     * the exact casing used in the template source. Most browsers convert attributes
     * to lower case when making them accessible via Javascript so this method
     * returns the original casing used in the template source.
     * @param placeholder the placeholder
     * @returns the attribute name or `null` if the placeholder is not used as part
     * of an attribute.
     */
    attributeName(placeholder: string): string | null {
        return this._attributeMappings.get(placeholder)
    }
}

const PlaceholderAttributeRegex = /([.?@]?[a-z0-9-_@]+)\s*=\s*$/i
const PlaceholderSingleQuotedAttributeRegex = /([.?@]?[a-z0-9-_@]+)\s*=\s*'[^']*$/i
const PlaceholderDoubleQuotedAttributeRegex = /([.?@]?[a-z0-9-_@]+)\s*=\s*"[^"]*$/i

/**
 * Generates a HTML markup string from the given static string parts.
 * Inserts placeholder strings between the static parts. In addition, this method
 * returns a map from placeholder to attribute name. 
 * @param strings the strings array
 * @returns the HTML markup as well as a map from placeholder to property name
 */
function generateHtml(strings: TemplateStringsArray): [string, Map<string, string>] {
    let html = ""

    const attributeMappings = new Map<string, string>()

    strings.forEach((s, i) => {
        html += s
        if (i < strings.length - 1) {
            const attributeMatch = PlaceholderAttributeRegex.exec(html) || PlaceholderSingleQuotedAttributeRegex.exec(html) || PlaceholderDoubleQuotedAttributeRegex.exec(html)
            if (attributeMatch) {
                // Placeholder is used as (part of) an attribute value. Insert placeholder.
                const placeholder = generatePlaceholder(i)
                html += placeholder
                attributeMappings.set(placeholder, attributeMatch[1])
            } else {
                // Placeholder is used as text content. Insert a comment node
                html += `<!--${generatePlaceholder(i)}-->`
            }
        }
    })

    return [html.trim(), attributeMappings]
}

/**
 * An error thrown in case an `Insert` discovers some inconsistency in the
 * DOM. This situation most commonly arises, when a template has been rendered
 * into an element but the rendered content is modified by some external DOM
 * operations when applying the insert.
 */
const DomInconsistencyError = "DOM inconsistency error"

/**
 * A factory for `Binding` objects. A BindingDescriptor is create during template
 * creation and holds the corresponding binding index. When the a template
 * get's applied to an element, each BindingDescriptor creates a Binding.
 */
interface BindingDescriptor {
    /**
     * Create a new Binding iff `nodeIndex` matches the index managed by this
     * descriptor. Use `node` for that binding. If index doesn't match, return
     * undefined.
     * @param node 
     * @param nodeIndex 
     */
    createBinding(node: Node, nodeIndex: number): Binding | undefined
}

class NodeBindingDescriptor implements BindingDescriptor {
    constructor(private readonly nodeIndex: number, private readonly dataIndex: number) {}

    createBinding(node: Node, nodeIndex: number): Binding | undefined {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        return new NodeBinding(node, this.dataIndex)
    }
}

class BooleanAttributeBindingDescriptor implements BindingDescriptor {
    constructor(
        private readonly nodeIndex: number, 
        private readonly attributeName: string, 
        private readonly dataIndex: number) {}

    createBinding(node: Node, nodeIndex: number): Binding | undefined {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        return new BooleanAttributeBinding(node, this.attributeName, this.dataIndex)
    }
}

class PropertyBindingDescriptor implements BindingDescriptor {
    constructor(
        private readonly nodeIndex: number, 
        private readonly propertyName: string, 
        private readonly dataIndex: number) {}

    createBinding(node: Node, nodeIndex: number): Binding | undefined {
        if (nodeIndex !== this.nodeIndex) {
            return            
        }
        return new PropertyBinding(node, this.propertyName, this.dataIndex)
    }
}

class EventListenerAttributeBindingDescriptor implements BindingDescriptor {
    constructor(
        private readonly nodeIndex: number, 
        private readonly eventName: string, 
        private readonly dataIndex: number,
        private readonly directives: EventListenerAttributeDirectives) {}

    createBinding(node: Node, nodeIndex: number): Binding | undefined {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        return new EventListenerAttributeBinding(node, this.eventName, this.dataIndex, this.directives)
    }
}

class AttributeBindingDescriptor implements BindingDescriptor {
    constructor(
        private readonly nodeIndex: number, 
        private readonly attributeName: string, 
        private readonly valueInstructions: Array<string | number>,
        private readonly directives: AttributeBindingDirectives) {}

    createBinding(node: Node, nodeIndex: number): Binding | undefined {
        if (nodeIndex !== this.nodeIndex) {
            return
        }

        return new AttributeBinding(node, this.attributeName, this.valueInstructions, this.directives)
    }
}


// ---

/**
 * A `Binding` defines how to apply a placeholder's value to the DOM.
 */
interface Binding {
    /**
     * Applies the given data to the node managed by this binding.
     * @param data all placeholder values
     */
    applyData(data: ReadonlyArray<unknown>): void
}

/**
 * Base implementation for `Binding`s that handle a single data
 * index. This implementation provides checks to update the DOM
 * only when data changes.
 */
abstract class SingleDataIndexBindingBase implements Binding {
    protected boundData: unknown

    constructor(protected readonly node: Node, protected readonly dataIndex: number) {}

    /**
     * Performs a check if the already bound data is equal to
     * the passed data. Calls `applyChangedData` to handle
     * data updates.
     * @param data the data array
     */
    applyData(data: Array<unknown>): void {
        const dataItem = data[this.dataIndex]

        if (this.boundData === dataItem) {
            return
        }

        this.applyChangedData(dataItem)

        this.boundData = dataItem
    }

    /**
     * Called by `applyData` when a change in data is detected.
     * @param dataItem the single element from the data array selected by data index
     */
    protected abstract applyChangedData(dataItem: unknown): void
}

/**
 * An implementation of `Binding` which modifies `Node`s in the DOM.
 * Modifications can be constrained to a single `TextNode` or they
 * can include whole subtrees.
 */
class NodeBinding implements Binding {
    private startMarker: Node | undefined
    private endMarker: Node | undefined
    private boundData: unknown

    constructor(protected node: Node, protected readonly dataIndex: number) {
        // Use the node as the end marker.
        // Simplify the comment for that purpose
        (node as Comment).data = ""
        this.endMarker = node

        // Create a start marker comment and insert it
        // directly before the end marker
        this.startMarker = node.parentNode.insertBefore(createMarker(), node)
    }

    applyData(data: ReadonlyArray<unknown>): void {
        const dataItem = data[this.dataIndex]

        if (this.boundData === dataItem) {
            return
        }

        if (typeof (dataItem) === "undefined" || dataItem === null) {
            // undefined/null are special and should be rendered as no content.
            this.applyText("")
        } else if (typeof dataItem === "string") {
            // Check strings first, as strings are also iterable and
            // ElementUpdates. As we need some special string handling,
            // we check this first.
            this.applyText(dataItem)
        } else if (isIterable(dataItem)) {
            this.applyIterable(dataItem)
        } else if (isElementUpdate(dataItem)) {
            this.applyElementUpdate(dataItem)
        } else {
            // As a fallback, convert everything else to a string (i.e. numbers)
            // and render them as text content.
            this.applyText(String(dataItem))
        }
    }

    private applyIterable(dataItem: Iterable<unknown>) {
        const dataArray = Array.from(dataItem)

        if (Array.isArray(this.boundData)) {
            const previousBindings = this.boundData as Array<NodeBinding>

            // There has been data applied previously and that also was an array.
            // So we try to reuse these bindings

            if (dataArray.length < previousBindings.length) {
                // The previous render cycle produced more elements.
                // Remove superfluous elements
                removeNodes(previousBindings[dataArray.length].startMarker, this.endMarker)

                // Now shorten the array of bindings
                this.boundData = previousBindings.slice(0, dataArray.length)
            } else if (dataArray.length > previousBindings.length) {
                // The previous render cycle produced less elements.
                // Append the missing ones.
                this.createBindingsFromIterable(dataArray, previousBindings.length)
            }
        } else {
            // Previously, no iterable has been rendered.

            // First, clear the content
            this.clear()

            // Now, for every element in the iterable, we create a new 
            // and dedicated NodeBinding and store these as this.boundData.
            this.boundData = []
            this.createBindingsFromIterable(dataArray)
        }

        // Now apply all bindings
        (this.boundData as Array<Binding>).forEach(b => b.applyData(dataArray))
    }

    private createBindingsFromIterable(dataArray: Array<unknown>, startIndex = 0) {
        for (let idx = startIndex; idx < dataArray.length; ++idx) {
            const endMarker = this.endMarker.parentNode.insertBefore(createMarker(), this.endMarker)
            const binding = new NodeBinding(endMarker, idx);
            (this.boundData as Array<unknown>).push(binding)
        }
    }

    private applyElementUpdate(update: ElementUpdate) {
        // TODO: Do we need some optimized code in case update is a HtmlTemplate?
        // if ((update instanceof HtmlTemplate) && (this.boundData instanceof HtmlTemplate)) {
        //     if (update.templateString === this.boundData.templateString) {
        //     }
        // }

        // Remove all nodes between start and end in case a previous render run
        // has created data
        this.clear()

        // Apply the update to sideboard template element, then move
        // all nodes before node.
        const fragment = document.createDocumentFragment()
        updateElement(fragment, update, false)
        this.endMarker.parentNode.insertBefore(fragment, this.endMarker)

        this.boundData = update
    }

    private applyText(text: string) {
        if (this.endMarker.previousSibling.nodeType === Node.TEXT_NODE) {
            // Got text element from previous render call. Reuse that 
            (this.endMarker.previousSibling as Text).data = text
            this.boundData = text
            return
        }

        // Got some other content (i.e. a nested HtmlTemplate).
        // Clear the insert spot and insert a fresh text node.
        this.clear()
        this.node = this.endMarker.parentNode.insertBefore(document.createTextNode(text), this.endMarker)
        this.boundData = text
    }

    private clear(): void {
        const firstNodeToRemove = this.startMarker
            ? this.startMarker.nextSibling
            : this.node.parentNode.firstChild

        removeNodes(firstNodeToRemove, this.endMarker ?? this.node)
    }
}

/**
 * Defines the directives applicable for attribute values.
 */
interface AttributeBindingDirectives {
    omitEmpty?: boolean
}

/**
 * An implementation of `Binding` which modifies a single attribute of a DOM `Element`.
 */
class AttributeBinding implements Binding {
    private element: Element
    private boundAttributeValue: string | undefined

    constructor(node: Node,
        private readonly attributeName: string,
        private readonly valueInstructions: Array<string | number>,
        private readonly directives: AttributeBindingDirectives) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element        
    }

    applyData(data: ReadonlyArray<unknown>): void {
        let gotEmptyValue = false
        const attributeValue = this.valueInstructions.map(vi => {
            if (typeof vi === "string") {
                // If value instruction is a string it is a static
                // string part and used "as is".
                return vi
            }

            // Otherwise it must be a number and refers to a
            // data item.
            const d = data[vi]

            if (typeof d === "undefined" || d === null) {
                // If the data item is undefined or null we
                // set the empty value flag. 
                gotEmptyValue = true
            }

            // No further conversion is needed here, as the elements
            // are joined and Array.prototype.join handles the string 
            // conversion for every array item as well as replacing
            // undefined and null with an empty string.
            return d
        }).join("")

        if (gotEmptyValue && this.directives.omitEmpty) {
            // We got at least on empty value and the omitEmpty
            // directive has been set. Remove the attribute.
            this.element.removeAttribute(this.attributeName)
            // Use undefined as a marker for the cached value.
            this.boundAttributeValue = undefined
            return
        }

        // Either the attribute's value should be set no matter if
        // an empty value was used or no empty value has been produced.
        if (attributeValue !== this.boundAttributeValue) {
            // The attribute's value is different compared to the one used
            // before. Update the element's attribute...
            this.element.setAttribute(this.attributeName, attributeValue)
            // ... and remember the attribute's value for the next render cycle.
            this.boundAttributeValue = attributeValue
        }
    }
}

/**
 * An implementation of `Binding` which handles the special boolean attributes, that are prefixed with `?`.
 */
class BooleanAttributeBinding extends SingleDataIndexBindingBase {
    private element: Element

    constructor(node: Node, private readonly attributeName: string, dataIndex: number) {
        super(node, dataIndex)
        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.attributeName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
    }

    protected applyChangedData(dataItem: unknown): void {
        if (dataItem) {
            this.element.setAttribute(this.attributeName, this.attributeName)
        } else {
            this.element.removeAttribute(this.attributeName)
        }
    }
}

/**
 * Defines the directives to apply to a registered event listeners. The directives
 * extend `AddEventListenerOptions` and passes these values to the `addEventListener`
 * method. The remaining directives are implemented by wrapping the event listener
 * prio to registering.
 */
export interface EventListenerAttributeDirectives extends AddEventListenerOptions {
    stopPropagation?: boolean
    stopImmediatePropagation?: boolean
    preventDefault?: boolean
}

/**
 * An implemenation of `Binding` which attaches eventlisteners to nodes.
 */
class EventListenerAttributeBinding extends SingleDataIndexBindingBase {
    private element: Element
    private boundListener: EventListenerOrEventListenerObject

    constructor(node: Node, 
        private readonly eventName: string, dataIndex: number, 
        private readonly directives: EventListenerAttributeDirectives) {
        super(node, dataIndex)

        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set attribute ${this.eventName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
    }

    protected applyChangedData(dataItem: unknown): void {
        if (this.boundListener) {
            this.element.removeEventListener(this.eventName, this.boundListener)
        }

        this.boundListener = this.createListener(dataItem as EventListenerOrEventListenerObject)

        this.element.addEventListener(this.eventName, this.boundListener, this.directives)
    }

    private createListener(dataItem: EventListenerOrEventListenerObject): EventListenerOrEventListenerObject {
        if (!this.directives.stopPropagation && !this.directives.stopImmediatePropagation && !this.directives.preventDefault) {
            return dataItem
        }

        return (e: Event) => {
            if (this.directives.stopPropagation) {
                e.stopPropagation()
            }

            if (this.directives.stopImmediatePropagation) {
                e.stopImmediatePropagation()
            }

            if (this.directives.preventDefault) {
                e.preventDefault()
            }

            if ("handleEvent" in dataItem) {
                dataItem.handleEvent(e)
            } else {
                dataItem(e)
            }
        }
    }
}

/**
 * An implementation of `Binding` which updates a DOM elements
 * javascript property, i.e. `value`.
 */
class PropertyBinding extends SingleDataIndexBindingBase {
    private element: Element

    constructor(node: Node, private readonly propertyName: string, dataIndex: number) {
        super(node, dataIndex)

        if (node.nodeType !== Node.ELEMENT_NODE) {
            console.error(`Expected element to set property ${this.propertyName} but got ${node}`)
            throw DomInconsistencyError
        }
        this.element = node as Element
    }

    protected applyChangedData(dataItem: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.element as any)[this.propertyName] = dataItem
    }
}

/**
 * Applies the given data to all given `Binding`s.
 * @param bindings the bindings
 * @param data the data
 */
export function applyData(bindings: ReadonlyArray<Binding>, data: ReadonlyArray<unknown>): void {
    bindings.forEach(b => b.applyData(data))
}

/**
 * Binds a set of `BindingDescriptors`s to a DOM subtree rooted at `root`. Returns the resulting
 * `Bindings`s.
 * @param bindings the bindings to apply
 * @param root the root of the DOM subtree to apply bindings to
 */
export function bindBindings(bindings: ReadonlyArray<BindingDescriptor>, root: Node): Array<Binding> {
    let result: Array<Binding> = []

    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null)

    let nodeIndex = -1
    let node: Node

    while ((node = treeWalker.nextNode()) !== null) {
        nodeIndex++
        result = result.concat(bindings.map(b => b.createBinding(node, nodeIndex)).filter(b => typeof b !== "undefined"))
    }

    return result
}

/**
 * Determines the bindings described by the placeholders nested below `root`.
 * Walks the DOM subtree and collects `BindingDescriptors` and returns the list
 * @param root the root of the DOM subtree
 * @param template the instance of HtmlTemplate to determine bindings for
 * @returns the determined binding descriptors
 */
export function determineBindingDescriptors(root: Node, template: HtmlTemplate): Array<BindingDescriptor> {
    const bindings: Array<BindingDescriptor> = []
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null)
    let nodeIndex = -1
    let node: Node

    while ((node = treeWalker.nextNode()) !== null) {
        // Walk the whole DOM subtree and detect nodes with a binding marker on it.
        // Use the nodeIndex as a pointer to this node
        nodeIndex++

        if (node.nodeType === Node.COMMENT_NODE) {
            const comment = node as Comment
            if (isPlaceholder(comment.data)) {
                bindings.push(new NodeBindingDescriptor(nodeIndex, extractPlaceholderId(comment.data)))
            }

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            for (const name of element.getAttributeNames()) {
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

                    bindings.push(new BooleanAttributeBindingDescriptor(nodeIndex, name.substring(1), extractPlaceholderId(parts[0])))
                    continue
                }

                if (name.startsWith(".")) {
                    // A . starts a property binding.
                    // A property binding must use a single marker as its value as the value
                    // is only used via javascript.
                    // Otherwise it is considered a syntax error. In any case
                    // the attribute is removed from the element as it is
                    // syntactically not correct.
                    element.removeAttribute(name)

                    // Make sure the binding consist of a single placeholder.
                    if (parts.length !== 1 || !isPlaceholder(parts[0])) {
                        console.error(`Got syntax error using property ${name}: Only single placeholder is allowed as value. Found at ${element}.`)
                        continue
                    }

                    const propertyName = template.attributeName(parts[0])

                    bindings.push(new PropertyBindingDescriptor(nodeIndex, propertyName.substring(1), extractPlaceholderId(parts[0])))
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

                    const directives: EventListenerAttributeDirectives = {}
                    const [eventName, ...directive] = name.substring(1).split("+")
                    directive.forEach(optName => {
                        switch (optName.toLocaleLowerCase()) {
                            case "capture":
                                directives.capture = true
                                break
                            case "passive":
                                directives.passive = true
                                break
                            case "once":
                                directives.once = true
                                break
                            case "stoppropagation":
                                directives.stopPropagation = true
                                break
                            case "stopimmediatepropagation":
                                directives.stopImmediatePropagation = true
                                break
                            case "preventdefault":
                                directives.preventDefault = true
                                break
                            default:
                                console.warn(`unrecognized event binding directive: "${optName}"`)
                        }
                    })

                    bindings.push(new EventListenerAttributeBindingDescriptor(nodeIndex, eventName, extractPlaceholderId(parts[0]), directives))
                    continue
                }

                // This fallback branch handles regular attributes.

                // Check if the attribute contains a marker to be replaced later.
                if (parts.length === 1 && !isPlaceholder(parts[0])) {
                    // The single value part contains no marker. There is no need to create a binding.
                    // We simply leave the attribute in place.
                    continue
                }

                // The attribute contains at least one placeholder. It may contain a mixture of 
                // (more than one) placeholder and static text.

                // Remove the attribute from the DOM element as it might be syntactically wrong. It
                // will be added later when the binding is applied.
                element.removeAttribute(name)

                // Collect the value instructions to form the attribute's value. A value instruction
                // is either the static text segment or an index number referring to a placeholder.
                const valueInstructions: Array<string | number> = parts.map(part => {
                    if (isPlaceholder(part)) {
                        return extractPlaceholderId(part)
                    }
                    return part
                })

                const directives: AttributeBindingDirectives = {}
                const [attributeName, ...directive] = name.split("+")
                directive.forEach(optName => {
                    switch (optName.toLocaleLowerCase()) {
                        case "omitempty":
                            directives.omitEmpty = true
                            break
                        default:
                            console.warn(`unrecognized attribute binding directive: "${optName}"`)
                    }
                })

                // Finally, create the binding and append it to the list of bindings.
                bindings.push(new AttributeBindingDescriptor(nodeIndex, attributeName, valueInstructions, directives))
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

/**
 * Type guard that checks if the given value implements the `Iterable` protocol.
 * This is true for Arrays as well as values that have a special
 * `Symbol.iterator` method.
 * @param value the value
 * @returns whether the given value is iterable
 */
function isIterable(value: unknown): value is Iterable<unknown> {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && (value as any)[Symbol.iterator])
}