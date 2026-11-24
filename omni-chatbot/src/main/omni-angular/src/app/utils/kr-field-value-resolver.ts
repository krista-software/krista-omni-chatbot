/**
 * KrFieldValueResolver — Resolves nested <krista-field> custom elements.
 *
 * ## Problem
 * The Krista server embeds field references as `<krista-field>` HTML custom elements.
 * When a field's value references another field, the server nests them:
 *
 *   <krista-field value="Text4 + <krista-field value=\"Text3 + ...\" ...>"></krista-field>
 *
 * Each nesting level doubles the backslash escaping on quotes:
 *   Level 1: \"        (1 backslash)
 *   Level 2: \\\"      (3 backslashes)
 *   Level 3: \\\\\\\"  (7 backslashes)
 *
 * ## Two Resolution Paths
 *
 *   ### Path 1 — HTML Rendering (Custom Element Recursion)
 *   When the value is rendered via [innerHTML], the browser creates `<krista-field>`
 *   as a Custom Element (registered via Angular's `createCustomElement`). The component
 *   reads its `value` attribute, escapes nested quotes, and renders via [innerHTML] again.
 *   This recursion continues until the leaf field (no more nested tags).
 *
 *   Method: `normalizeNestedFieldQuotes()` — normalizes backslash-escaped quotes to `&quot;`
 *   so the browser's HTML parser can correctly read nested attribute values.
 *
 *   Used by: KrFieldComponent, chat-item-form, any context rendering field values as HTML.
 *
 *   ### Path 2 — Plain Text Resolution (Iterative Extraction)
 *   When the value must be displayed as plain text (input fields, titles, summaries,
 *   tooltips), custom elements can't fire. We need to programmatically extract
 *   the value from each nested `<krista-field>` tag.
 *
 *   Methods: `resolveToText()` / `resolveToHtml()` — strip backslashes, then iteratively
 *   find top-level tags, extract their `value` attribute, replace, and repeat.
 *
 *   Used by: Execution titles, footer status messages, execution list summaries,
 *   iFieldTransformer (input field values), any context where field values are shown
 *   as text (not rendered as HTML elements).
 *
 * ## Example
 *   Input:  "Hello <krista-field value=\"World\" name=\"f1\" fieldtype=\"...\"></krista-field>"
 *   resolveToText → "Hello World"
 *   resolveToHtml → "Hello World"
 *   normalizeNestedFieldQuotes → "Hello <krista-field value=&quot;World&quot; ...></krista-field>"
 *
 * All methods are static with zero Angular or external dependencies.
 */
export class KrFieldValueResolver {

  // ═══════════════════════════════════════════════════════════════════════
  //  PATH 1 — HTML: Custom Element Recursion
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Normalizes multi-level backslash-escaped quotes in nested krista-field values
   * so the browser's HTML parser can correctly parse them as attribute values.
   *
   * ## Why this is needed
   * When KrFieldComponent renders its `displayValue` via `[innerHTML]`, the HTML
   * may contain inner `<krista-field>` tags. These inner tags have their attribute
   * quotes escaped with backslashes (from the server's JSON serialization).
   * The browser's HTML parser doesn't understand `\"` — it needs `&quot;`.
   *
   * ## How it works
   * 1. `computeNestingDepth()` scans the string for backslash sequences before quotes
   *    and determines the maximum nesting depth.
   * 2. Starting from the DEEPEST level, each level's backslash+quote pattern is
   *    replaced with `&quot;`. Processing deepest-first prevents interference between levels.
   * 3. Empty `<p>` tags are replaced with `<br/>` for cleaner display.
   *
   * ## Example (3 levels deep)
   *   Level 3: \\\\\\\" → &quot;  (7 backslashes + quote → entity)
   *   Level 2: \\\"     → &quot;  (3 backslashes + quote → entity)
   *   Level 1: \"       → &quot;  (1 backslash + quote → entity)
   *
   * After normalizing, the browser can parse:
   *   <krista-field value=&quot;inner value&quot; name=&quot;f1&quot; ...>
   * as a valid custom element with proper attribute values.
   *
   * @param str - The raw value string with backslash-escaped nested quotes
   * @returns The normalized string ready for [innerHTML] rendering
   */
  static normalizeNestedFieldQuotes(str: string): string {
    if (!str || str === "") {
      return "";
    }

    let escapedString = str;
    const maxLevel = this.computeNestingDepth(str);

    // Process from deepest level to shallowest to avoid pattern interference.
    // At each level, the pattern is 2^level backslashes followed by a quote.
    for (let currentLevel = maxLevel; currentLevel >= 1; currentLevel--) {
      const pattern = new RegExp('\\'.repeat(Math.pow(2, currentLevel)) + '"', 'g');
      escapedString = escapedString.replace(pattern, '&quot;');
    }

    // Replace empty paragraph tags with line breaks for cleaner display.
    // Server sometimes generates <p>&nbsp;</p> as spacers.
    return typeof escapedString === "string"
      ? escapedString.replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, '<br/>')
      : escapedString;
  }

  /**
   * Scans a string for backslash sequences before quote characters and determines
   * the maximum nesting depth. This tells normalizeNestedFieldQuotes how many levels
   * of escaping need to be normalized.
   *
   * ## Algorithm
   * 1. Regex finds all runs of consecutive backslashes immediately before a `"`.
   * 2. For each match, if the backslash count is odd (meaning the quote IS escaped),
   *    compute the nesting level: `floor(count / 2) + 1`.
   * 3. Track the maximum level found.
   * 4. Return `log2(maxLevel) + 1` as the number of processing passes needed.
   *
   * ## Why odd backslash counts matter
   * - `\"` (1 backslash) → the `"` is escaped (level 1)
   * - `\\"` (2 backslashes) → `\\` is an escaped backslash, `"` is NOT escaped
   * - `\\\"` (3 backslashes) → `\\` escaped backslash + `\"` escaped quote (level 2)
   *
   * @param str - The string to analyze for nesting depth
   * @returns The number of replacement passes needed (0 if no escaping found)
   */
  private static computeNestingDepth(str: string): number {
    if (!str || str === "") {
      return 0;
    }

    const regex = /(\\+)(?=")/g;
    let match: RegExpExecArray | null;
    let maxLevel = 0;

    while ((match = regex.exec(str)) !== null) {
      const backslashCount = match[1].length;
      if (backslashCount % 2 === 1) {
        const level = Math.floor(backslashCount / 2) + 1;
        maxLevel = Math.max(maxLevel, level);
      }
    }

    return Math.log2(maxLevel) + 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PATH 2 — Text: Iterative Resolution
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolves all nested `<krista-field>` tags to their final **plain text** value.
   *
   * Use this when the resolved value will be displayed in a context where
   * HTML custom elements cannot render:
   * - `<input>` fields (value is text, not HTML)
   * - Execution titles in sidebar lists
   * - Conversation summaries and tooltips
   * - Footer status messages
   * - Any text-only display context
   *
   * ## How it works
   * 1. Strips ALL backslashes (server nesting artifacts, not meaningful content).
   * 2. Iteratively finds outermost `<krista-field>` tags via `replaceFieldTagsWithValues()`.
   * 3. Each pass extracts the `value` attribute and replaces the tag with it.
   * 4. Repeats until no `<krista-field>` tags remain.
   * 5. Strips all HTML tags for plain text output.
   *
   * ## Example (4 levels deep)
   *   Input:  'Text4 + <krista-field value="Text3 + <krista-field value=\"Text2 + <krista-field value=\\\"Likhit\\\" ...>\" ...>" ...>'
   *   Pass 1: 'Text4 + Text3 + <krista-field value="Text2 + <krista-field value="Likhit" ...>" ...>'
   *   Pass 2: 'Text4 + Text3 + Text2 + <krista-field value="Likhit" ...>'
   *   Pass 3: 'Text4 + Text3 + Text2 + Likhit'
   *   Output: 'Text4 + Text3 + Text2 + Likhit'
   *
   * ## Container-level usage pattern (DRY)
   * Call this ONCE at the container boundary (e.g. iFieldTransformer, message processor),
   * not in every child component. All children then receive already-resolved values.
   *
   * @param rawValue - The raw value potentially containing nested krista-field tags
   * @returns Plain text with all krista-field tags resolved and HTML stripped
   */
  static resolveToText(rawValue: string): string {
    return this.resolveNestedFields(rawValue, false);
  }

  /**
   * Resolves all nested `<krista-field>` tags, **preserving HTML markup**.
   *
   * Same resolution logic as `resolveToText()`, but keeps HTML tags like
   * `<b>`, `<p>`, `<a>`, etc. intact. Only `<krista-field>` tags are resolved.
   *
   * Use this for rich text contexts where the value contains formatting
   * that should be preserved, but field references need to be expanded.
   *
   * @param rawValue - The raw value potentially containing nested krista-field tags
   * @returns HTML string with krista-field tags resolved but other markup preserved
   */
  static resolveToHtml(rawValue: string): string {
    return this.resolveNestedFields(rawValue, true);
  }

  /**
   * Core resolution engine shared by resolveToText() and resolveToHtml().
   *
   * ## Steps
   * 1. Guard: return early if input is empty or contains no krista-field tags.
   * 2. Strip ALL backslashes — these are server-generated JSON nesting artifacts.
   *    After stripping, nested krista-field tags become parseable by our tag-matching logic.
   * 3. Loop: call replaceFieldTagsWithValues() which resolves one nesting level per pass.
   *    Each pass finds outermost tags, extracts their value, and replaces.
   *    The loop continues until no more tags remain or no progress is made (safety).
   * 4. Clean up &quot; entities back to real quotes.
   * 5. If plain text requested, strip all remaining HTML tags.
   *
   * @param rawValue - The raw server value with nested krista-field tags
   * @param preserveHtml - true to keep HTML markup, false to strip to plain text
   * @returns The fully resolved value
   */
  private static resolveNestedFields(rawValue: string, preserveHtml: boolean): string {
    if (!rawValue || typeof rawValue !== 'string') {
      return rawValue ?? '';
    }

    // No krista-field tags — still strip HTML if plain text requested (resolveToText path)
    if (!rawValue.includes('<krista-field')) {
      return preserveHtml ? rawValue : this.stripHtml(rawValue);
    }

    // Strip all backslashes. The server adds them for JSON-style nesting at each
    // depth level (e.g. \", \\\", \\\\\\\"). After stripping, the nested tags
    // have unescaped quotes which our indexOf-based parser (extractValueAttribute)
    // can handle using the `value="..."` and `" name` delimiter convention.
    let value = rawValue.replace(/\\/g, '');

    // Each iteration resolves the outermost <krista-field> tags, replacing them
    // with their extracted value attributes. The inner tags (now exposed) are
    // resolved in the next iteration. Continues until fully resolved.
    while (value.includes('<krista-field')) {
      const prev = value;
      value = this.replaceFieldTagsWithValues(value);
      if (value === prev) break; // Safety: prevent infinite loop if tags can't be resolved
    }

    // Convert any remaining &quot; entities back to real quotes
    value = value.replace(/&quot;/g, '"');
    return preserveHtml ? value : this.stripHtml(value);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Shared Utilities
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Matches `<krista-field` followed by any content (non-greedy) and `</krista-field>`.
   * Used by findOuterFieldTags() and as a quick-check for presence of krista-field tags.
   * Non-greedy `*?` ensures we match the NEAREST closing tag, not the furthest.
   */
  private static kristaFieldRegex = new RegExp(/<krista-field((.|\n|\r)*?)<\/krista-field>/g);

  /**
   * Replaces all top-level `<krista-field>` tags in a string with their extracted
   * `value` attribute content. Handles exactly ONE level of nesting per call.
   *
   * ## Algorithm
   * 1. `findOuterFieldTags()` finds all top-level (non-nested) krista-field tags
   *    by counting opening/closing tag pairs.
   * 2. For each tag, `extractValueAttribute()` extracts the `value` attribute
   *    by matching `value="..."` with `" name` as the end delimiter.
   * 3. The krista-link cleanup removes backslashes from embedded link tags.
   * 4. Single-paragraph unwrapping strips `<p>...</p>` wrapper for cleaner output.
   * 5. HTML quote entities are unescaped back to real quotes.
   * 6. The original tag is replaced with the extracted value in the result string.
   *
   * After this call, the result may still contain deeper nested krista-field tags
   * (which were inside the value attribute). The caller (resolveNestedFields()) loops
   * until all levels are resolved.
   *
   * @param input - String containing one or more krista-field tags
   * @returns The string with top-level krista-field tags replaced by their values
   */
  private static replaceFieldTagsWithValues(input: string): string {
    const outerTags = this.findOuterFieldTags(input);
    if (!input?.match(this.kristaFieldRegex) || outerTags.length == 0) {
      return input;
    }
    let result = input;
    for (const tag of outerTags) {
      let resolvedValue = this.extractValueAttribute(tag)
        // Clean backslashes from krista-link tags embedded in the value
        .replace(/<krista-link\b[^>]*?>/g, match => match.replace(/\\/g, ''))
        // Unwrap single <p> wrapper — "<p>text</p>" → "text"
        .replace(/^<p[^>]*>(.*?)<\/p>/, (_, content) => content);
      // Convert &quot; entities back to real quotes for readable output
      resolvedValue = resolvedValue.replace(/&quot;/g, '"');
      result = result.replace(tag, resolvedValue);
    }
    return result;
  }

  /**
   * Finds all top-level `<krista-field>...</krista-field>` tag pairs in a string.
   *
   * "Top-level" means the outermost tags — if field A contains nested field B,
   * only A's full tag (including B inside it) is returned.
   *
   * ## Algorithm (nesting-aware pair matching)
   * 1. Find the first `<krista-field` opening tag.
   * 2. Look for the next `<krista-field` (potential nested open) and the first `</krista-field>`.
   * 3. If a nested open appears before the close, advance both pointers — the close
   *    we found belongs to the nested tag, not our outer tag.
   * 4. Continue until the close tag truly matches our opening tag.
   * 5. Extract the full tag substring, remove it from the search string, and repeat.
   *
   * ## Why not regex?
   * Regex can't reliably match nested structures. The indexOf-based approach
   * correctly handles arbitrary nesting depth by counting open/close pairs.
   *
   * @param strValue - The string to search for krista-field tags
   * @returns Array of complete tag strings, outermost level only
   */
  private static findOuterFieldTags(strValue: string = ""): string[] {
    const kristaFieldList: string[] = [];
    while ((strValue?.match(KrFieldValueResolver.kristaFieldRegex)?.length ?? 0) > 0) {
      const startTagIndex = strValue.indexOf("<krista-field");
      let nextTagIndex = strValue.indexOf("<krista-field", startTagIndex + 1);
      let endTagIndex = strValue.indexOf("</krista-field>");
      // If there's a nested <krista-field before the first </krista-field>,
      // advance both pointers to find the matching outer close tag.
      while (nextTagIndex > 0 && nextTagIndex < endTagIndex) {
        nextTagIndex = strValue.indexOf("<krista-field", nextTagIndex + 1);
        endTagIndex = strValue.indexOf("</krista-field>", endTagIndex + 1);
      }
      kristaFieldList.push(strValue.substring(startTagIndex, endTagIndex + 15));
      strValue = strValue.replace(strValue.substring(startTagIndex, endTagIndex + 15), "");
    }
    return kristaFieldList;
  }

  /**
   * Extracts the `value` attribute content from a `<krista-field>` tag string.
   *
   * ## Convention
   * The server ALWAYS generates krista-field attributes in this order:
   *   `ref="..." value="..." name="..." fieldtype="..." attributes="..."`
   *
   * This method exploits that convention by using `value="` as the start delimiter
   * and `" name` as the end delimiter for the value attribute.
   *
   * ## Handling nested value/name pairs
   * When the value itself contains nested krista-field tags, there will be
   * additional `value="` and `" name` pairs inside. The method handles this
   * by advancing both pointers (like findOuterFieldTags does for nesting):
   * if a nested `value="` appears before `" name`, both pointers advance
   * to skip the nested pair.
   *
   * ## Example
   *   Tag:    '<krista-field ref="r1" value="Hello World" name="f1" fieldtype="Text">'
   *   Result: 'Hello World'
   *
   * @param tagString - The complete krista-field tag string
   * @returns The extracted value attribute content, or empty string if not found
   */
  private static extractValueAttribute(tagString: string): string {
    const startTagIndex = tagString.indexOf("value=\"");
    let nextTagIndex = tagString.indexOf("value=\"", startTagIndex + 1);
    let endTagIndex = tagString.indexOf("\" name");
    // Skip nested value/name pairs — same approach as nesting in findOuterFieldTags
    while (nextTagIndex > 0 && nextTagIndex < endTagIndex) {
      nextTagIndex = tagString.indexOf("value=\"", nextTagIndex + 1);
      endTagIndex = tagString.indexOf("\" name", endTagIndex + 1);
    }
    if (startTagIndex === -1 || endTagIndex === -1) {
      return '';
    }
    // +7 to skip past the `value="` prefix (7 characters)
    return tagString.substring(startTagIndex + 7, endTagIndex);
  }

  /**
   * Strips all HTML tags from a string, returning plain text content only.
   * Uses a simple regex that matches anything between < and >.
   *
   * Note: This is intentionally simple — it handles standard server-generated HTML.
   * For adversarial/user-generated HTML, a proper sanitizer should be used instead.
   *
   * @param text - HTML string to strip tags from
   * @returns Plain text with all HTML tags removed and whitespace trimmed
   */
  private static stripHtml(text: string): string {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, '').trim();
  }
}
