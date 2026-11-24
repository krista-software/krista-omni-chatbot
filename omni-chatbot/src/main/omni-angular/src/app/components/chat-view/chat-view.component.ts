import { Component } from '@angular/core';

/**
 * ChatViewComponent
 * 
 * This component is used for the /chat route to match original app's routing pattern.
 * original app: <LoginGuardedRoute path="/chat" component={TimelineView} />
 * 
 * The actual chat UI is rendered by AppComponent's template which includes:
 * - Header (conditionally shown)
 * - TimelineView (main chat area)
 * - Footer
 * 
 * This component simply acts as a route target to enable /chat URL routing.
 */
@Component({
  selector: 'app-chat-view',
  template: '',
  standalone: false
})
export class ChatViewComponent {
  constructor() {}
}

