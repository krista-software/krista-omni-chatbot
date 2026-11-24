import sanitizeHtml, { IOptions } from 'sanitize-html';
import { StorageService } from '../services/storage.service';
import { createMediaUrlDownload } from './media-url.util';

/**
 * Allowed HTML tags and attributes for sanitization
 * (originally ported from the React chatbot)
 */
export const AllowedHtmlTags: IOptions = {
  allowedTags: [
    'a',
    'b',
    'i',
    'u',
    'p',
    'strong',
    'strike',
    's',
    'img',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'li',
    'ol',
    'em',
    'small',
    'sub',
    'sup',
    'code',
    'blockquote',
    'div',
    'span',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    'KristaLinkText',
    'KristaButton',
    'krista-field',
    'krista-button',
    'krista-link',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'style', 'class'],
    img: ['src', 'alt', 'width', 'height', 'style', 'data-mediaid', 'class'],
    // NOTE: 'contenteditable' is intentionally NOT allowed. Server message HTML carries
    // contenteditable="true" (leftover from the platform rich editor); preserving it made
    // the rendered bubble editable — right-clicking a media image drew a browser selection
    // outline, and the text could be edited in place. Stripping it keeps messages read-only.
    div: ['class', 'style', 'layout'],
    figure: ['class', 'style'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    '*': ['style', 'class', 'align', 'alt', 'center', 'bgcolor'],
    KristaLinkText: ['data-filter', 'data-href'],
    KristaButton: ['data-href'],
    'krista-field': ['value', 'attributes', 'fieldtype', 'name'],
    'krista-button': [
      'name',
      'button-type',
      'data-href',
      'wsid',
      'topicid',
      'cid',
      'view',
    ],
    'krista-link': ['title', 'href'],
  },
  disallowedTagsMode: 'discard',
  parseStyleAttributes: false,
  transformTags: {
    a: (tagName: any, attribs: any) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }),
    img: (tagName: any, attribs: any) => {
      return {
        tagName: 'img',
        attribs: {
          ...attribs,
          ...(attribs['data-mediaid'] && {
            src: createMediaUrlDownload(
              (window as any).workspaceId,
              attribs['data-mediaid']
            ),
          }),
        },
      };
    },
  },
};

/**
 * Sanitize HTML markup with allowed tags and attributes
 * Overload 1: With StorageService (for components that have it injected)
 * Overload 2: Without StorageService (for standalone usage)
 * 
 * (originally ported from the React chatbot)
 */
export function getSanitizedMarkup(value: string, storageService: StorageService): string;
export function getSanitizedMarkup(value: string): string;
export function getSanitizedMarkup(value: string, storageService?: StorageService): string {
  if (!value) {
    return '';
  }

  // Ensure workspaceId is available on window for media URL transformation
  if (storageService && (window as any).workspaceId === undefined) {
    const workspaceId = storageService.getWorkspaceId();
    if (workspaceId) {
      (window as any).workspaceId = workspaceId;
    }
  }

  const sanitized = sanitizeHtml(value, AllowedHtmlTags);

  return sanitized;
}

/**
 * Strip all HTML tags from a string
 * (originally ported from the React chatbot)
 */
export function stripHtml(htmlString: string): string {
  if (!htmlString) {
    return '';
  }
  const temporalDivElement = document.createElement('div');
  temporalDivElement.innerHTML = htmlString;
  return temporalDivElement.textContent || temporalDivElement.innerText || '';
}

