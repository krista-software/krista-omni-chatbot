import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// Shared Module (includes CommonModule, MaterialModule, Pipes)
import { SharedModule } from '../../shared/shared.module';

// Fields Module (all field components)
import { FieldsModule } from '../fields/fields.module';

// Chat Components
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { TimelineViewComponent } from '../timeline-view/timeline-view.component';
import { TextInputAreaComponent } from '../footer/text-input-area/text-input-area.component';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';
import { FormMessageComponent } from '../form-message/form-message.component';
import { BannerWrapperComponent } from '../shared/banner-wrapper/banner-wrapper.component';

// Message Components
import { MessageSidebarsComponent } from '../message/message-sidebars/message-sidebars.component';
import { MessagePathsComponent } from '../message/message-paths/message-paths.component';
import { EphemeralComponent } from '../message/ephemeral/ephemeral.component';
import { ErrorFocusComponent } from '../message/error-focus/error-focus.component';
import { MessageTextRendererComponent } from '../message/message-text-renderer/message-text-renderer.component';
import { StatusOverlayComponent } from '../status-overlay/status-overlay.component';

// Standalone Components
import { LanguageDropdownComponent } from '../header/language-dropdown/language-dropdown.component';

/**
 * ChatModule
 * Contains all chat-specific components including header, footer,
 * timeline view, message bubbles, and form messages.
 */
@NgModule({
  declarations: [
    // Layout Components
    HeaderComponent,
    FooterComponent,

    // Chat Components
    TimelineViewComponent,
    TextInputAreaComponent,
    MessageBubbleComponent,
    FormMessageComponent,
    BannerWrapperComponent,

    // Message Components
    MessageSidebarsComponent,
    MessagePathsComponent,
    EphemeralComponent,
    ErrorFocusComponent,
    MessageTextRendererComponent,
    StatusOverlayComponent,
  ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    SharedModule,
    FieldsModule,
    // Standalone Components
    LanguageDropdownComponent,
  ],
  exports: [
    // Export main chat components for use in AppModule
    HeaderComponent,
    FooterComponent,
    TimelineViewComponent,
    TextInputAreaComponent,
    MessageBubbleComponent,
    FormMessageComponent,

    // Re-export FieldsModule for convenience
    FieldsModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatModule { }

