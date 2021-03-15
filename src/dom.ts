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

/**
 * Moves all children from source to target.
 * @param source source element to remove nodes from
 * @param target target element to append nodes to
 */
export function moveAllChildren(source: Node, target: Node, insertBefore?: Node) {
    while(source.firstChild) {
        target.insertBefore(source.removeChild(source.firstChild), insertBefore)
    }
}
