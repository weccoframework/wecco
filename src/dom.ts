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

/**
 * `UpdateTarget` defines the type of a target of an update operation.
 * It may either be a regular HTML `Element` or a `DocumentFragment` which
 * is used as the `content` node for a HTML `template`.
 */
export type UpdateTarget = Element | DocumentFragment

/**
 * `ElementUpdateFunction` defines a type for callable objects that updates a target's content.
 */
export interface ElementUpdateFunction {
    (host: UpdateTarget, insertBefore?: Node): void
}

/** 
 * `ElementUpdater` defines an interface for complex objects (those that carry methods) that
 * perform an update of a given target.
 */
export interface ElementUpdater {
    /**
     * `updateElement` updates the content of the given target at the given `insertPoint`.
     * @param el the target to update
     * @param insertBefore the insert point. Should be used as the second parameter to `Node.insertBefore`. Optional; 
     * if not present, content should be appended.
     */
    updateElement(el: UpdateTarget, insertBefore?: Node): void
}

/**
 * `ElementUpdate` defines the possible types for update requests.
 * - `string`s are used to define `innerHTML`
 * - `Element`s should be inserted/appended
 * - `ElementUpdateFunction` or `ElementUpdater` are applied
 * - arrays of the afore mentioned are applied in sequence
 */
export type ElementUpdate = string | Element | ElementUpdateFunction | ElementUpdater | Array<ElementUpdate>

/**
 * `isElementUpdate` is a type guard that checks whether the given argument is an `ElementUpdate`. 
 * @param arg the argument to check
 */
export function isElementUpdate(arg: any): arg is ElementUpdate {
    return (typeof arg === "string") || (typeof arg === "function") || Array.isArray(arg) || (arg instanceof Element) || isElementUpdater(arg)
}

/**
 * `updateElement` applies the given update request to the given target.
 * @param target the target to update
 * @param request the request
 * @param insertBefore the insertion point
 */
export function updateElement(target: UpdateTarget, request: ElementUpdate, insertBefore?: Node): void {
    if (Array.isArray(request)) {
        request.forEach(r => updateElement(target, r, insertBefore))
    } else if (typeof (request) === "string") {
        const dummy = document.createElement("div")
        dummy.innerHTML = request
        dummy.childNodes.forEach(n => target.insertBefore(dummy.removeChild(n), insertBefore))
    } else if (request instanceof Element) {
        target.insertBefore(request, insertBefore)
    } else if (isElementUpdater(request)) {
        request.updateElement(target, insertBefore)
    } else {
        request(target, insertBefore)
    }
}

function isElementUpdater(request: ElementUpdate): request is ElementUpdater {
    return (typeof request === "object") && ("updateElement" in request)
}

/**
 * Selector to resolve a Node inside the DOM.
 */
export type ElementSelector = string | Element

/**
 * Resolves the Element described by the given selector.
 * @param selector the selector
 * @param parent an optional parent to start resolving from. Defaults to `document.body`
 */
export function resolve(selector: ElementSelector, parent?: Element): Element {
    if (typeof selector !== "string") {
        return selector
    }

    if (!parent) {
        parent = document.body
    }

    return parent.querySelector(selector)
}

/**
 * Removes all child nodes from the given node.
 * @param node the node to remove children from
 */
export function removeAllChildren(node: Node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild)
    }
}