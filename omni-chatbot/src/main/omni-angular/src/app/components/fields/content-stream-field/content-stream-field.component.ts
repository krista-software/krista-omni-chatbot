import { Component, Input, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StreamProvider, StreamCallback } from '@krista/field-types/core/services/stream/StreamProvider';
import { StreamEvent } from '@krista/field-types/core/value-schema/stream/StreamEvent';
import { StreamEventTypes } from '@krista/field-types/core/services/stream/StreamEventExecutor';
import { StreamCacheObject } from '@krista/field-types/core/services/stream/StreamCacheObject';

/**
 * Content Stream Field Component
 * Displays streaming content with typing animation effect
 * Matches kristaclient's StreamFieldRenderer implementation
 */
@Component({
  selector: 'app-content-stream-field',
  templateUrl: './content-stream-field.component.html',
  styleUrls: ['./content-stream-field.component.css'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentStreamFieldComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() streamId!: string;
  @Input() fieldId!: string;
  @Input() streamProvider!: StreamProvider;
  @Input() firstEvent?: StreamEvent;

  // Displayed content with typing effect
  displayedContent: string = '';

  // Typing animation state
  private typingQueue: string = '';
  private typingInterval: any;
  private streamCallback!: StreamCallback;
  private isMounted: boolean = true;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    // Delay streaming initialization to ensure view is ready
    setTimeout(() => {
      if (this.streamId && this.streamProvider) {
        this.prepareStreaming();
      }
    });
  }

  ngOnDestroy(): void {
    this.isMounted = false;
    this.clearTypeInterval();
  }

  private prepareStreaming(): void {
    if (!this.streamValue || !this.streamId) {
      return;
    }

    const cacheObject = this.streamProvider.getCacheObject(this.streamId);
    // Use cached event, provided firstEvent, or create a minimal placeholder
    // Backend may not send firstEvent — the SSE connection will deliver content
    const initialEvent = cacheObject?.initialStreamEvent || this.firstEvent || {
      streamId: this.streamId,
      eventId: '',
      content: { content: '', contentType: 'text' as const },
      timestamp: String(Date.now())
    } as StreamEvent;

    // If stream is already completed, show all content immediately
    if (this.isCompleted) {
      const content = cacheObject?.getRealContent() || initialEvent?.content?.content || '';
      this.displayedContent = content;
      this.cdr.markForCheck();
      return;
    }

    // Register callback for stream events
    this.streamCallback = (event: StreamEventTypes, streamCache?: StreamCacheObject) => {
      if (!this.isMounted) {
        return;
      }

      switch (event) {
        case 'stream-event':
          this.handleStreamTextChunk(streamCache?.getRealContent());
          break;
        case 'stream-finished':
          if (streamCache) {
            this.handleStreamTextChunk(streamCache?.getRealContent());
          }
          break;
        case 'stream-closed':
        case 'stream-error':
        case 'stream-cancelled':
          this.cdr.markForCheck();
          break;
      }
    };

    // Start streaming — call addOrGetStreaming directly (matches original implementation)
    // This both registers the callback and initiates the SSE connection
    this.streamProvider.addOrGetStreaming(this.streamId, this.fieldId, initialEvent, this.streamCallback);

    // Initialize with first event content
    this.handleStreamTextChunk(initialEvent?.content?.content || '');
    this.startTyping();
  }

  private handleStreamTextChunk(fullText?: string): void {
    if (!fullText) {
      return;
    }

    const alreadyDisplayed = this.displayedContent + this.typingQueue;
    const newPart = fullText.slice(alreadyDisplayed.length);
    this.typingQueue = this.typingQueue + newPart;
  }

  private startTyping(): void {
    if (this.typingInterval) {
      return;
    }

    this.typingInterval = setInterval(() => {
      if (this.typingQueue.length > 0) {
        // Dynamically calculate chars to process based on queue length
        const charsToProcess = Math.min(
          Math.max(1, Math.floor(this.typingQueue.length / 50)),
          5
        );

        this.displayedContent += this.typingQueue.substring(0, charsToProcess);
        this.typingQueue = this.typingQueue.slice(charsToProcess);
        this.cdr.markForCheck();
      } else if (this.streamProvider.isCompleted(this.streamId)) {
        this.clearTypeInterval();
      }
    }, 10);
  }

  private clearTypeInterval(): void {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = undefined;
    }
  }

  // Getters for template
  get streamValue(): boolean {
    return !!(this.streamId && this.streamProvider);
  }

  get isStreamInQueue(): boolean {
    return this.streamProvider?.isStreamInQueue(this.streamId) || false;
  }

  get isCancelled(): boolean {
    return this.streamProvider?.isStreamCancelled(this.streamId) || false;
  }

  get isCompleted(): boolean {
    return this.streamProvider?.isCompleted(this.streamId) && !this.isCancelled;
  }

  // Control methods for pause/resume
  pauseStreaming(): void {
    if (this.streamId) {
      this.streamProvider.cancelTask(this.streamId, false);
      this.cdr.markForCheck();
    }
  }

  resumeStreaming(): void {
    this.prepareStreaming();
    this.cdr.markForCheck();
  }
}

