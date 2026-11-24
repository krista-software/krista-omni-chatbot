import { TestBed } from '@angular/core/testing';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SafeHtmlPipe } from './safe-html.pipe';
import { StorageService } from '../services/storage.service';

describe('SafeHtmlPipe', () => {
  let pipe: SafeHtmlPipe;
  let sanitizer: DomSanitizer;
  let storageService: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SafeHtmlPipe,
        {
          provide: StorageService,
          useValue: {
            getClientSessionId: () => 'test-session-id',
            getWorkspaceId: () => 'test-workspace-id'
          }
        }
      ]
    });

    sanitizer = TestBed.inject(DomSanitizer);
    storageService = TestBed.inject(StorageService);
    pipe = new SafeHtmlPipe(sanitizer, storageService);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should return SafeHtml for valid HTML string', () => {
      const html = '<p>Hello World</p>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle empty string', () => {
      const result = pipe.transform('');
      expect(result).toBeTruthy();
    });

    it('should handle HTML with attributes', () => {
      const html = '<a href="https://example.com" target="_blank">Link</a>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with inline styles', () => {
      const html = '<div style="color: red; font-size: 14px;">Styled text</div>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with classes', () => {
      const html = '<span class="highlight bold">Highlighted text</span>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle nested HTML elements', () => {
      const html = '<div><p><strong>Bold</strong> and <em>italic</em></p></div>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle custom elements like krista-button', () => {
      const html = '<krista-button type="primary">Click me</krista-button>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with data attributes', () => {
      const html = '<div data-id="123" data-action="submit">Content</div>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with event handlers (bypassed)', () => {
      const html = '<button onclick="alert(\'test\')">Click</button>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with script tags (bypassed)', () => {
      const html = '<script>console.log("test")</script>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with images', () => {
      const html = '<img src="image.png" alt="Test image" />';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with forms', () => {
      const html = '<form action="/submit"><input type="text" name="field" /></form>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with tables', () => {
      const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with line breaks', () => {
      const html = 'Line 1<br/>Line 2<br>Line 3';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with special characters', () => {
      const html = '<p>&lt;script&gt; &amp; &quot;quotes&quot;</p>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with unicode characters', () => {
      const html = '<p>Hello 世界 🌍</p>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle plain text without HTML tags', () => {
      const text = 'Just plain text without any HTML';
      const result = pipe.transform(text);
      expect(result).toBeTruthy();
    });

    it('should handle whitespace-only string', () => {
      const result = pipe.transform('   \n\t  ');
      expect(result).toBeTruthy();
    });

    it('should handle HTML with iframes (bypassed)', () => {
      const html = '<iframe src="https://example.com"></iframe>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with SVG elements', () => {
      const html = '<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle complex nested HTML structure', () => {
      const html = `
        <div class="container">
          <header>
            <h1>Title</h1>
          </header>
          <main>
            <article>
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
            </article>
          </main>
          <footer>
            <p>Footer content</p>
          </footer>
        </div>
      `;
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });
  });

  describe('Security Considerations', () => {
    it('should bypass security for trusted HTML content', () => {
      spyOn(sanitizer, 'bypassSecurityTrustHtml').and.callThrough();
      const html = '<p>Test</p>';
      pipe.transform(html);
      expect(sanitizer.bypassSecurityTrustHtml).toHaveBeenCalledWith(html);
    });

    it('should use bypassSecurityTrustHtml method', () => {
      const html = '<div>Content</div>';
      const result = pipe.transform(html);
      // The result should be a SafeHtml object
      expect(typeof result).toBe('object');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null-like values gracefully', () => {
      // The pipe expects a string, but we test edge cases
      const result = pipe.transform(null as any);
      expect(result).toBeTruthy();
    });

    it('should handle undefined-like values gracefully', () => {
      const result = pipe.transform(undefined as any);
      expect(result).toBeTruthy();
    });

    it('should handle very long HTML strings', () => {
      const longHtml = '<p>' + 'a'.repeat(10000) + '</p>';
      const result = pipe.transform(longHtml);
      expect(result).toBeTruthy();
    });

    it('should handle malformed HTML', () => {
      const malformedHtml = '<div><p>Unclosed tags';
      const result = pipe.transform(malformedHtml);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with comments', () => {
      const html = '<!-- This is a comment --><p>Content</p>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });

    it('should handle HTML with CDATA sections', () => {
      const html = '<![CDATA[Some content]]>';
      const result = pipe.transform(html);
      expect(result).toBeTruthy();
    });
  });
});

