import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit, ElementRef, ComponentRef, ViewContainerRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getSanitizedMarkup } from '../../../utils/html-sanitizer.util';
import { StorageService } from '../../../services/storage.service';
import { ChatFacade } from '../../../core/facades';
import { SessionService } from '../../../services/session.service';
import { UserService } from '../../../services/user.service';
import { ConfigService } from '../../../services/config.service';
import { StreamProvider } from '@krista/field-types/core/services/stream/StreamProvider';
import { StreamEvent } from '@krista/field-types/core/value-schema/stream/StreamEvent';

/**
 * Stream field value structure matching backend's StreamValueJson
 */
interface StreamValueJson {
  streamId: string;
  firstEvent?: StreamEvent;
  finished: boolean;
  type?: string;
}

/**
 * MessageTextRendererComponent
 *
 * Renders message text with HTML sanitization and custom element handling.
 * Supports krista-button, krista-link, krista-field web components and images.
 *
 * (originally ported from the React chatbot)
 */
@Component({
  selector: 'app-message-text-renderer',
  standalone: false,
  templateUrl: './message-text-renderer.component.html',
  styleUrl: './message-text-renderer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageTextRendererComponent implements OnInit, OnChanges, AfterViewInit {
  /**
   * The message text to render (may contain HTML)
   */
  @Input() message: string = '';

  /**
   * Sanitized and transformed HTML content
   */
  sanitizedContent: SafeHtml = '';

  /**
   * Image modal state
   */
  imageModalVisible = false;
  imageModalSrc = '';
  imageModalAlt = '';

  /**
   * Copy-link fallback state. Shown only when a message link's new tab is
   * blocked because the chatbot is embedded inside a sandboxed host iframe that
   * lacks the 'allow-popups' permission. Purely a graceful degradation — it
   * never appears in a normally embedded chatbot (where the new tab opens).
   */
  linkFallbackVisible = false;
  linkFallbackUrl = '';
  linkFallbackCopied = false;

  /**
   * Stream provider instance (singleton)
   */
  private streamProvider?: StreamProvider;

  constructor(
    private sanitizer: DomSanitizer,
    private storageService: StorageService,
    private chatFacade: ChatFacade,
    private sessionService: SessionService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {
    this.processMessage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message']) {
      this.processMessage();
    }
  }

  ngAfterViewInit(): void {
    // After view is initialized, check for krista-field elements and render Stream fields
    this.renderStreamFields();
  }

  /**
   * Extracted stream fields from the message (parsed before sanitization)
   */
  private streamFields: Array<{
    streamValue: StreamValueJson;
    fieldName: string;
    placeholder: string;
  }> = [];

  /**
   * Process the message text and sanitize HTML
   * Mirrors original's useEffect with KristaFieldValueResolver.escapeNestedKristaField
   */
  private processMessage(): void {
    if (!this.message) {
      this.sanitizedContent = '';
      return;
    }

    // IMPORTANT: Extract Stream fields BEFORE sanitization to preserve the value attribute
    this.streamFields = this.extractStreamFields(this.message);

    // Escape nested krista-field elements (matches original's KristaFieldValueResolver.escapeNestedKristaField)
    const escapedMessage = this.escapeNestedKristaField(this.message);

    // Resolve krista-field elements first so inner HTML (anchors, images) becomes exposed
    // before sanitization. This lets transformTags in the sanitizer apply uniformly
    // (e.g. target="_blank" on <a>, media URL rewrite on <img>).
    const resolvedMessage = this.resolveKristaFieldValues(escapedMessage);

    // Sanitize the fully-resolved markup; transformTags now act on all anchors/images.
    const sanitizedHtml = getSanitizedMarkup(resolvedMessage, this.storageService);

    // Bypass Angular's sanitization to allow custom elements
    this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(sanitizedHtml);
    this.cdr.markForCheck();
  }

  /**
   * Replace krista-field elements with their resolved display values.
   * The value attribute contains the field's display content (may be HTML-encoded).
   * For Text fields this can contain rich HTML like <h3>, <p> etc.
   * For Percentage fields this is a plain number like "0.86".
   */
  private resolveKristaFieldValues(html: string): string {
    // Match krista-field elements and extract their value attribute and fieldtype
    return html.replace(
      /<krista-field\s+[^>]*?value="([^"]*)"[^>]*?fieldtype="([^"]*)"[^>]*>[\s\S]*?<\/krista-field>/gi,
      (match, value, fieldType) => {
        if (!value) return '';

        // Decode HTML entities in the value
        const decoded = this.decodeHtmlEntities(value);

        // For percentage fields, format as percentage
        if (fieldType === 'com.krista.fields.Percentage') {
          const num = parseFloat(decoded);
          if (!isNaN(num)) {
            return `${(num * 100).toFixed(0)}%`;
          }
        }

        return decoded;
      }
    );
  }

  /**
   * Decode HTML entities to their character equivalents
   */
  private decodeHtmlEntities(str: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }

  /**
   * Escape nested krista-field elements
   * Matches original's KristaFieldValueResolver.escapeNestedKristaField
   */
  private escapeNestedKristaField(str: string): string {
    if (!str || str === '') {
      return '';
    }

    let escapedString = str;
    const maxLevel = this.computeEscapeDepth(str);

    for (let currentLevel = maxLevel; currentLevel >= 1; currentLevel--) {
      const pattern = new RegExp('\\'.repeat(Math.pow(2, currentLevel)) + '"', 'g');
      escapedString = escapedString.replace(pattern, '&quot;');
    }

    return this.fillEmptyParagraphWithBreaks(escapedString);
  }

  private computeEscapeDepth(str: string): number {
    if (!str || str === '') {
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

  private fillEmptyParagraphWithBreaks(value: string): string {
    return value.replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, '<p><br></p>');
  }

  /**
   * Handle clicks on custom elements (images, krista-button)
   * Mirrors original's handleCustomLinkClick
   */
  onContentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const tagName = target.tagName?.toUpperCase();

    // Handle image clicks - open modal
    if (tagName === 'IMG') {
      event.preventDefault();
      event.stopPropagation();

      const imgElement = target as HTMLImageElement;
      this.imageModalSrc = imgElement.src;
      this.imageModalAlt = imgElement.alt || 'Image';
      this.imageModalVisible = true;
      this.cdr.detectChanges(); // Force immediate update
      return;
    }

    // Also check if parent is an anchor tag wrapping an image
    if (tagName === 'A' && target.querySelector('img')) {
      event.preventDefault();
      event.stopPropagation();

      const imgElement = target.querySelector('img') as HTMLImageElement;
      if (imgElement) {
        this.imageModalSrc = imgElement.src;
        this.imageModalAlt = imgElement.alt || 'Image';
        this.imageModalVisible = true;
        this.cdr.detectChanges(); // Force immediate update
        return;
      }
    }

    // Handle external hyperlink clicks. Message links open in a new tab (the
    // sanitizer forces target="_blank" on every anchor). When the chatbot is
    // embedded inside a sandboxed host iframe WITHOUT the 'allow-popups' token,
    // the browser blocks the new window and the click silently fails. Detect
    // the block (window.open returns null) and fall back to a copy-link prompt
    // so the user can still reach the destination.
    //
    // krista-link renders its real <a target="_blank"> inside its shadow DOM,
    // so event retargeting makes the click target the <krista-link> HOST and
    // closest('a[href]') can't see the inner anchor. Resolve the href from the
    // host attribute (matching KristaLinkElement's own https:// normalization).
    // preventDefault() here still cancels the shadow anchor's navigation because
    // the click event is composed and cancelable.
    const kristaLink = target.closest('krista-link') as HTMLElement | null;
    if (kristaLink) {
      let href = kristaLink.getAttribute('href') || '';
      if (href && href.toLowerCase().lastIndexOf('http') === -1) {
        href = `https://${href}`;
      }
      if (/^https?:/i.test(href)) {
        event.preventDefault();
        event.stopPropagation();
        this.openExternalLink(href);
        return;
      }
    }

    // Plain anchors rendered directly in the message text.
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (anchor && !anchor.querySelector('img') && /^https?:/i.test(anchor.href)) {
      event.preventDefault();
      event.stopPropagation();
      this.openExternalLink(anchor.href);
      return;
    }

    // Handle krista-button clicks
    if (tagName === 'KRISTA-BUTTON') {
      const buttonType = target.getAttribute('button-type');
      if (buttonType && buttonType.toLowerCase() === 'option') {
        const name = target.getAttribute('name');
        if (name) {
          const sessionId = this.sessionService.getCurrentSessionId();
          const userData = this.userService.getCurrentUser();
          if (sessionId && userData) {
            this.chatFacade.sendMessage(this.escapeHtml(name));
          }
        }
      }
    }
  }

  /**
   * Close the image modal
   */
  closeImageModal(): void {
    this.imageModalVisible = false;
    this.cdr.detectChanges(); // Force immediate update
  }

  /**
   * Open an external link in a new tab. If the new window is blocked (the
   * chatbot is inside a sandboxed host embed lacking 'allow-popups',
   * window.open returns null), show the copy-link fallback instead.
   */
  private openExternalLink(href: string): void {
    let opened: Window | null = null;
    try {
      opened = window.open(href, '_blank');
    } catch {
      opened = null;
    }
    if (opened) {
      // Sever the opener reference (equivalent to rel="noopener") for security.
      try {
        opened.opener = null;
      } catch {
      }
    } else {
      this.showLinkFallback(href);
    }
  }

  /**
   * Show the copy-link fallback for a link whose new tab was blocked.
   */
  private showLinkFallback(url: string): void {
    this.linkFallbackUrl = url;
    this.linkFallbackCopied = false;
    this.linkFallbackVisible = true;
    this.cdr.markForCheck();
  }

  /**
   * Copy the blocked link to the clipboard. Uses the async Clipboard API when
   * available and falls back to execCommand('copy') (the sandbox grants
   * allow-scripts, so both work inside the embed).
   */
  copyFallbackLink(): void {
    const url = this.linkFallbackUrl;
    const done = () => {
      this.linkFallbackCopied = true;
      this.cdr.markForCheck();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => this.copyViaExecCommand(url, done));
    } else {
      this.copyViaExecCommand(url, done);
    }
  }

  private copyViaExecCommand(text: string, done: () => void): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      // Copy unavailable — the URL is still shown for manual selection.
    }
    document.body.removeChild(textarea);
  }

  /**
   * Dismiss the copy-link fallback.
   */
  dismissLinkFallback(): void {
    this.linkFallbackVisible = false;
    this.cdr.markForCheck();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Extract Stream fields from raw message HTML BEFORE sanitization
   * This preserves the value attribute which gets corrupted during sanitization
   */
  private extractStreamFields(rawHtml: string): Array<{
    streamValue: StreamValueJson;
    fieldName: string;
    placeholder: string;
  }> {
    const streamFields: Array<{
      streamValue: StreamValueJson;
      fieldName: string;
      placeholder: string;
    }> = [];

    // Use regex to find all krista-field elements with Stream fieldtype
    // We need to extract the entire tag including all attributes
    const kristaFieldRegex = /<krista-field[^>]*?fieldtype="com\.krista\.fields\.Stream"[^>]*?>/gi;
    let match;

    while ((match = kristaFieldRegex.exec(rawHtml)) !== null) {
      const fieldTag = match[0];

      // Extract name attribute
      const nameMatch = fieldTag.match(/name="([^"]*)"/);
      const fieldName = nameMatch ? nameMatch[1] : 'stream-field';

      // Extract value attribute - need to handle escaped quotes properly
      // The value attribute format is: value="{\"type\":\"...\",\"streamId\":\"...\",\"finished\":false}"
      let valueAttr = '';
      const valueStartMatch = fieldTag.match(/value="/);

      if (valueStartMatch) {
        const valueStartIndex = fieldTag.indexOf('value="') + 7; // 7 = length of 'value="'
        let valueEndIndex = valueStartIndex;
        let escaped = false;

        // Find the closing quote, accounting for escaped quotes
        for (let i = valueStartIndex; i < fieldTag.length; i++) {
          const char = fieldTag[i];

          if (char === '\\' && !escaped) {
            escaped = true;
            continue;
          }

          if (char === '"' && !escaped) {
            valueEndIndex = i;
            break;
          }

          escaped = false;
        }

        valueAttr = fieldTag.substring(valueStartIndex, valueEndIndex);
      }

      if (!valueAttr) {
        console.warn('Stream field missing value attribute');
        continue;
      }

      try {
        // Unescape the JSON value
        const unescapedValue = valueAttr
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\');

        const streamValue: StreamValueJson = JSON.parse(unescapedValue);

        if (!streamValue.streamId) {
          console.warn('Stream field missing streamId');
          continue;
        }

        // Create a unique placeholder that we'll replace in the DOM
        const placeholder = `stream-field-placeholder-${streamValue.streamId}`;

        streamFields.push({
          streamValue,
          fieldName,
          placeholder
        });

      } catch (error) {
        console.error('Error parsing Stream field value:', error);
      }
    }

    return streamFields;
  }

  /**
   * Render Stream fields from krista-field tags
   * Uses pre-extracted stream field data to avoid sanitization issues
   */
  private renderStreamFields(): void {
    const container = this.elementRef.nativeElement.querySelector('.message-text');
    if (!container || this.streamFields.length === 0) {
      return;
    }

    // Find all krista-field elements with Stream fieldtype
    const kristaFields = container.querySelectorAll('krista-field[fieldtype="com.krista.fields.Stream"]');

    // Match krista-field elements with our pre-extracted data
    kristaFields.forEach((kristaFieldElement: Element, index: number) => {
      if (index >= this.streamFields.length) {
        return;
      }

      const streamFieldData = this.streamFields[index];
      const { streamValue, fieldName } = streamFieldData;

      // Create a container div for the stream content
      const componentContainer = document.createElement('div');
      componentContainer.className = 'stream-field-container';

      // Replace the krista-field element with our container
      kristaFieldElement.parentNode?.replaceChild(componentContainer, kristaFieldElement);

      // Render the stream component
      this.renderStreamComponent(componentContainer, streamValue, fieldName);
    });
  }

  /**
   * Render a Stream component into a container element
   */
  private renderStreamComponent(container: HTMLElement, streamValue: StreamValueJson, fieldName: string): void {
    // Get or create StreamProvider singleton
    if (!this.streamProvider) {
      const config = this.configService.getCurrentConfig();
      this.streamProvider = StreamProvider.getInstance(
        config.workspaceId,
        config.nodeName,
        this.storageService.getClientSessionId() || ''
      );

      // StreamProvider singleton created successfully
    }

    // Create the stream UI with enhanced styling
    const streamContainer = document.createElement('div');
    streamContainer.className = 'content-stream-field';
    streamContainer.style.position = 'relative';
    streamContainer.style.minHeight = '24px';
    streamContainer.style.display = 'flex';
    streamContainer.style.alignItems = 'flex-start';
    streamContainer.style.gap = '8px';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'stream-content';
    contentDiv.style.whiteSpace = 'pre-wrap';
    contentDiv.style.wordBreak = 'break-word';
    contentDiv.style.flex = '1';
    contentDiv.style.lineHeight = '1.6';
    contentDiv.style.opacity = '0';
    contentDiv.style.transition = 'opacity 0.3s ease-in';

    // Create controls container (pause button + blinking dot)
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.alignItems = 'center';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.marginTop = '8px';
    controlsContainer.style.flexShrink = '0';

    // Create pause/resume button
    const pauseButton = document.createElement('button');
    pauseButton.className = 'stream-pause-button';
    pauseButton.innerHTML = '⏸️'; // Pause icon
    pauseButton.title = 'Pause streaming';
    pauseButton.style.display = 'none'; // Hidden initially, shown when streaming starts
    pauseButton.style.background = 'transparent';
    pauseButton.style.border = '1px solid #ccc';
    pauseButton.style.borderRadius = '4px';
    pauseButton.style.padding = '4px 8px';
    pauseButton.style.cursor = 'pointer';
    pauseButton.style.fontSize = '14px';
    pauseButton.style.transition = 'all 0.2s ease';
    pauseButton.style.opacity = '0.7';

    // Hover effect
    pauseButton.addEventListener('mouseenter', () => {
      pauseButton.style.opacity = '1';
      pauseButton.style.borderColor = '#1976d2';
    });
    pauseButton.addEventListener('mouseleave', () => {
      pauseButton.style.opacity = '0.7';
      pauseButton.style.borderColor = '#ccc';
    });

    const blinkingDot = document.createElement('span');
    blinkingDot.className = 'blinking-dot';
    blinkingDot.style.display = 'inline-block';
    blinkingDot.style.width = '6px';
    blinkingDot.style.height = '6px';
    blinkingDot.style.borderRadius = '50%';
    blinkingDot.style.backgroundColor = '#1976d2';
    blinkingDot.style.flexShrink = '0';
    blinkingDot.style.animation = 'stream-pulse 1.5s ease-in-out infinite';
    blinkingDot.style.boxShadow = '0 0 8px rgba(25, 118, 210, 0.4)';

    // Add CSS animation for the pulsing dot
    this.addStreamAnimationStyles();

    controlsContainer.appendChild(pauseButton);
    controlsContainer.appendChild(blinkingDot);
    streamContainer.appendChild(contentDiv);
    streamContainer.appendChild(controlsContainer);
    container.appendChild(streamContainer);

    // Initialize streaming
    this.initializeStreaming(streamValue, fieldName, contentDiv, blinkingDot, pauseButton);
  }

  /**
   * Initialize streaming for a Stream field with pause/resume functionality
   */
  private initializeStreaming(
    streamValue: StreamValueJson,
    fieldName: string,
    contentDiv: HTMLElement,
    blinkingDot: HTMLElement,
    pauseButton: HTMLButtonElement
  ): void {
    if (!this.streamProvider || !streamValue.streamId) {
      return;
    }

    // Initialize streaming state (matching original implementation)
    let displayedContent = '';
    let typingQueue = '';  // Queue of characters to type
    let typeInterval: any = null;
    let isPaused = false;

    const handleStreamTextChunk = (fullText?: string) => {
      if (!fullText) {
        return;
      }
      // Calculate what's new and add to typing queue
      const alreadyDisplayed = displayedContent + typingQueue;
      const newPart = fullText.slice(alreadyDisplayed.length);
      typingQueue += newPart;
    };

    const stopTyping = () => {
      if (typeInterval) {
        clearInterval(typeInterval);
        typeInterval = null;
      }
    };

    const startTyping = () => {
      if (typeInterval) {
        return;
      }

      // Fade in the content div when typing starts
      contentDiv.style.opacity = '1';

      // Show pause button when streaming starts
      pauseButton.style.display = 'inline-block';

      // Typing animation matching original: process 1-5 characters every 10ms
      typeInterval = setInterval(() => {
        if (typingQueue.length > 0) {
          // Dynamically calculate chars to process based on queue length
          // This creates a natural typing effect that speeds up with more content
          const charsToProcess = Math.min(
            Math.max(1, Math.floor(typingQueue.length / 50)),
            5
          );

          const chunk = typingQueue.slice(0, charsToProcess);
          typingQueue = typingQueue.slice(charsToProcess);

          displayedContent += chunk;
          contentDiv.innerHTML = displayedContent;
        } else if (this.streamProvider?.isCompleted(streamValue.streamId)) {
          // Hide blinking dot and pause button when streaming is complete
          blinkingDot.style.opacity = '0';
          blinkingDot.style.transition = 'opacity 0.3s ease-out';
          pauseButton.style.opacity = '0';
          pauseButton.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            blinkingDot.style.display = 'none';
            pauseButton.style.display = 'none';
          }, 300);
          stopTyping();
        }
      }, 10); // 10ms interval for smooth typing effect (matching original)
    };

    // Pause/Resume button click handler
    pauseButton.addEventListener('click', () => {
      const provider = this.streamProvider;
      if (!provider) return;

      const isCancelled = provider.isStreamCancelled(streamValue.streamId);

      if (!isCancelled) {
        // Pause the stream (this will affect ALL instances of this stream)
        provider.cancelTask(streamValue.streamId, false);
        stopTyping();
        pauseButton.innerHTML = '▶️'; // Play icon
        pauseButton.title = 'Resume streaming';
        blinkingDot.style.animationPlayState = 'paused';
      } else {
        // Resume the stream (this will affect ALL instances of this stream)
        // Re-register the stream to resume
        const cacheObject = provider.getCacheObject(streamValue.streamId);
        const initialEvent = cacheObject?.initialStreamEvent || streamValue.firstEvent;

        if (initialEvent) {
          provider.addOrGetStreaming(
            streamValue.streamId,
            fieldName,
            initialEvent as any,
            streamCallback
          );
        }

        // Update button UI
        pauseButton.innerHTML = '⏸️'; // Pause icon
        pauseButton.title = 'Pause streaming';
        pauseButton.style.display = 'inline-block'; // Show button
        pauseButton.style.opacity = '1'; // Make visible
        blinkingDot.style.animationPlayState = 'running';
        startTyping();
      }
    });

    // Get cache object to check for existing stream data
    const cacheObject = this.streamProvider.getCacheObject(streamValue.streamId);
    const initialEvent = cacheObject?.initialStreamEvent || streamValue.firstEvent;

    // Check if stream is already completed AND not cancelled (paused)
    // If stream is cancelled (paused), we want to show typing animation when resumed
    const isCancelled = this.streamProvider.isStreamCancelled(streamValue.streamId);
    if (this.streamProvider.isCompleted(streamValue.streamId) && !isCancelled) {
      const content = cacheObject?.getRealContent() || initialEvent?.content?.content || '';
      displayedContent = content;
      contentDiv.innerHTML = displayedContent;
      contentDiv.style.opacity = '1';
      blinkingDot.style.display = 'none';
      pauseButton.style.display = 'none';
      return;
    }

    // Set up stream callback to handle SSE events
    const streamCallback = (event: string, streamCache?: any) => {
      switch (event) {
        case 'stream-event':
          handleStreamTextChunk(streamCache?.getRealContent());
          break;
        case 'stream-finished':
          handleStreamTextChunk(streamCache?.getRealContent());
          // Don't stop typing here! Let the typing animation finish displaying the queue
          // The typing animation will stop naturally when queue is empty and stream is completed
          blinkingDot.style.display = 'none';
          // Hide pause button when stream is finished (all data received from backend)
          pauseButton.style.opacity = '0';
          pauseButton.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            pauseButton.style.display = 'none';
          }, 300);
          break;
        case 'stream-error':
          contentDiv.innerHTML = '<span style="color: #d32f2f; font-style: italic;">⚠️ Stream unavailable</span>';
          contentDiv.style.opacity = '1';
          blinkingDot.style.opacity = '0';
          blinkingDot.style.transition = 'opacity 0.3s ease-out';
          pauseButton.style.opacity = '0';
          pauseButton.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            blinkingDot.style.display = 'none';
            pauseButton.style.display = 'none';
          }, 300);
          stopTyping();
          break;
        case 'stream-closed':
          // Don't stop typing on stream-closed! Let the queue finish displaying
          blinkingDot.style.display = 'none';
          break;
        case 'stream-cancelled':
          // Update button to show play icon when cancelled
          pauseButton.innerHTML = '▶️';
          pauseButton.title = 'Resume streaming';
          blinkingDot.style.animationPlayState = 'paused';
          stopTyping();
          break;
      }
    };

    // Register stream with provider to start receiving SSE events
    this.streamProvider.addOrGetStreaming(
      streamValue.streamId,
      fieldName,
      initialEvent as any,
      streamCallback
    );

    // CRITICAL: Always use cached content if available
    // This ensures all instances show the same content even if they render at different times
    // Priority: cache > initialEvent
    const cachedContent = cacheObject?.getRealContent();
    const initialContent = cachedContent || initialEvent?.content?.content || '';

    if (initialContent) {
      handleStreamTextChunk(initialContent);
    }

    // Start the typing animation
    startTyping();
  }

  /**
   * Add CSS animation styles for stream UI
   */
  private addStreamAnimationStyles(): void {
    // Check if styles already exist
    if (document.getElementById('stream-animation-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'stream-animation-styles';
    style.textContent = `
      @keyframes stream-pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.4;
          transform: scale(1.2);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

