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

const PlaceholderPrefix = "{{wecco:"
const PlaceholderSuffix = "}}"
const PlaceholdersSplitRegex = /(\{\{wecco:\d+\}\})/

/**
 * Splits the string and returns all placeholders and static
 * parts as an array.
 * 
 * Example:
 * 
 * `foo{{wecco:0}}bar{{wecco:1}}` will be split into:
 * 
 * `["foo", "{{wecco:0}}", "bar", "{{wecco:1}}"]`
 * 
 * @param s the string to split
 * @returns the parts
 */
export function splitAtPlaceholders (s: string): Array<string> {
    return s.split(PlaceholdersSplitRegex).filter(p => p.length > 0)
}

/**
 * Returns whether the whole string s is a placeholder.
 * @param s the string to test
 */
export function isPlaceholder (s: string): boolean {
    return !!s.match(PlaceholdersSplitRegex)
}

/**
 * Extracts the placeholder ID from the given string s, which
 * is assumed to contain just a placehilder
 * @param s the string
 */
export function extractPlaceholderId(s: string): number {
    return parseInt(s.substr(PlaceholderPrefix.length))
}

/**
 * Generates a placeholder for the given id.
 * @param id the id
 */
export function generatePlaceholder(id: number): string {
    return PlaceholderPrefix + id.toString() + PlaceholderSuffix
}
