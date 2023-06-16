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

import { ElementUpdater } from "../update"
import { HtmlTemplate } from "./template"
export { HtmlTemplate } from "./template"

/**
 * `html` is a string tag used to create dynamic html. The tag generates
 * an `ElementUpdater` that can be used to update another Element's content.
 * 
 * Applying a `html`-generated content to an element repeatedly only updates
 * the changed parts.
 * 
 * @param strings the string parts of the template
 * @param args the arguments of the template
 */
export function html(strings: TemplateStringsArray, ...args: any): ElementUpdater {
    return new HtmlTemplate(strings, args)
}
