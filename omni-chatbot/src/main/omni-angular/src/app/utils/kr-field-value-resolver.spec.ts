import { KrFieldValueResolver } from './kr-field-value-resolver';

// ---------------------------------------------------------------------------
// Helpers — build krista-field tags exactly as the server would generate them
// ---------------------------------------------------------------------------

/** Wraps content in a minimal krista-field tag using the server's attribute order */
function field(value: string, name = 'f1'): string {

  return `<krista-field ref="r1" value="${value}" name="${name}" fieldtype="Text"></krista-field>`;
}

// ---------------------------------------------------------------------------

describe('KrFieldValueResolver', () => {

  // ─────────────────────────────────────────────────────────────────────────
  //  resolveToText
  // ─────────────────────────────────────────────────────────────────────────

  describe('resolveToText', () => {

    it('returns an empty string for null input', () => {

      expect(KrFieldValueResolver.resolveToText(null as unknown as string)).toBe('');
    });

    it('returns an empty string for undefined input', () => {

      expect(KrFieldValueResolver.resolveToText(undefined as unknown as string)).toBe('');
    });

    it('returns plain text unchanged when there are no krista-field tags', () => {

      expect(KrFieldValueResolver.resolveToText('Hello World')).toBe('Hello World');
    });

    it('strips HTML tags from plain HTML (no krista-field)', () => {

      expect(KrFieldValueResolver.resolveToText('<p>Hello</p>')).toBe('Hello');
    });

    it('resolves a single-level krista-field tag to its value', () => {

      const input = `Hello ${field('World')}`;
      expect(KrFieldValueResolver.resolveToText(input)).toBe('Hello World');
    });

    it('resolves two levels of nesting', () => {

      // Level 2: outer wraps inner — server escapes inner quotes with \"
      const inner = `<krista-field ref="r2" value="Inner" name="f2" fieldtype="Text"></krista-field>`;
      const escapedInner = inner.replace(/"/g, '\\"');
      const outer = `<krista-field ref="r1" value="${escapedInner}" name="f1" fieldtype="Text"></krista-field>`;
      expect(KrFieldValueResolver.resolveToText(outer)).toBe('Inner');
    });

    it('resolves three levels of nesting', () => {

      // Build level 1 tag, then escape and wrap it in level 2, then again for level 3
      const level1 = `<krista-field ref="r1" value="Leaf" name="f1" fieldtype="Text"></krista-field>`;
      const level1Escaped = level1.replace(/"/g, '\\"');
      const level2 = `<krista-field ref="r2" value="${level1Escaped}" name="f2" fieldtype="Text"></krista-field>`;
      const level2Escaped = level2.replace(/"/g, '\\\\"');
      const level3 = `<krista-field ref="r3" value="${level2Escaped}" name="f3" fieldtype="Text"></krista-field>`;
      expect(KrFieldValueResolver.resolveToText(level3)).toBe('Leaf');
    });

    it('cleans up krista-link tags embedded inside a field value', () => {

      // A field whose value contains a krista-link tag (backslashes in the link)
      const input = `<krista-field ref="r1" value="<krista-link href=\\"http://x.com\\">link</krista-link>" name="f1" fieldtype="Text"></krista-field>`;
      const result = KrFieldValueResolver.resolveToText(input);
      // Should resolve to the link text without backslashes
      expect(result).toContain('link');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  resolveToHtml
  // ─────────────────────────────────────────────────────────────────────────

  describe('resolveToHtml', () => {

    it('returns an empty string for null input', () => {

      expect(KrFieldValueResolver.resolveToHtml(null as unknown as string)).toBe('');
    });

    it('returns an empty string for undefined input', () => {

      expect(KrFieldValueResolver.resolveToHtml(undefined as unknown as string)).toBe('');
    });

    it('preserves HTML tags when no krista-field is present', () => {

      const input = '<b>Bold</b> and <p>paragraph</p>';
      expect(KrFieldValueResolver.resolveToHtml(input)).toBe(input);
    });

    it('resolves krista-field tags while keeping surrounding HTML markup', () => {

      const input = `<p>Hello ${field('World')}</p>`;
      const result = KrFieldValueResolver.resolveToHtml(input);
      expect(result).toContain('World');
      expect(result).toContain('<p>');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  normalizeNestedFieldQuotes
  // ─────────────────────────────────────────────────────────────────────────

  describe('normalizeNestedFieldQuotes', () => {

    it('returns an empty string for null/undefined/empty input', () => {

      expect(KrFieldValueResolver.normalizeNestedFieldQuotes(null as unknown as string)).toBe('');
      expect(KrFieldValueResolver.normalizeNestedFieldQuotes(undefined as unknown as string)).toBe('');
      expect(KrFieldValueResolver.normalizeNestedFieldQuotes('')).toBe('');
    });

    it('returns a string without escapes unchanged', () => {

      const plain = 'No escaping here, just text.';
      expect(KrFieldValueResolver.normalizeNestedFieldQuotes(plain)).toBe(plain);
    });

    it('converts level-1 backslash-escaped quotes (\\" → &quot;)', () => {

      const input = 'value=\\"hello\\"';
      const result = KrFieldValueResolver.normalizeNestedFieldQuotes(input);
      expect(result).toContain('&quot;');
      expect(result).not.toContain('\\"');
    });

    it('converts level-2 backslash-escaped quotes (\\\\\" → &quot;)', () => {

      // Three backslashes before the quote = level 2
      const input = 'value=\\\\\\"nested\\\\\\"';
      const result = KrFieldValueResolver.normalizeNestedFieldQuotes(input);
      expect(result).toContain('&quot;');
    });

    it('replaces empty <p> tags with <br/>', () => {

      const input = '<p></p>';
      const result = KrFieldValueResolver.normalizeNestedFieldQuotes(input);
      expect(result).toBe('<br/>');
    });

    it('replaces <p> containing only &nbsp; with <br/>', () => {

      const input = '<p>&nbsp;</p>';
      const result = KrFieldValueResolver.normalizeNestedFieldQuotes(input);
      expect(result).toBe('<br/>');
    });

    it('replaces <p> containing only whitespace with <br/>', () => {

      const input = '<p>   </p>';
      const result = KrFieldValueResolver.normalizeNestedFieldQuotes(input);
      expect(result).toBe('<br/>');
    });
  });
});
