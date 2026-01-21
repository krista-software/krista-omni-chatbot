import { KSDKFormField } from "./../../../services/messaging/form/KSDKFormField";
import { UserAccount } from "./../../../classes/UserAccount";
import { KSDKFormResponse } from "./../../../services/messaging/form/KSDKFormResponse";
import { KSDKMedia } from "./../../../services/messaging/message/KSDKMedia";
import { KSDKTargetAudience } from "./../../../services/messaging/message/KSDKTargetAudience";
import { KSDKMessage } from "./../../../services/messaging/message/KSDKMessage";
import { KSDKExecution } from "../../../services/messaging/message/KSDKExecution";
import { Workspace } from "../../../classes/Workspace";
import { UnauthorizedWorkspace } from "../../../classes/UnauthorizedWorkspace";
import { ConversationMeta } from "../../../classes/ConversationMeta";
import { Conversation } from "../../../classes/Conversation";
import { UserPreferences } from "../../../classes/UserPreferences";
import { DashboardWidget } from "../../../classes/DashboardWidget";
import { DashboardLayout } from "../../../classes/DashboardLayout";
import { ContextVariable } from "../../../classes/ContextVariable";
import { ConversationMetaNLP } from "../../../classes/ConversationMetaNLP";

export interface GetExecutionsParams {
  workspaceId: string;
  inboxId: string;
  conversationOffset: string | undefined;
  before: number;
  after: number;
  inclusiveOffset: boolean;
}

export interface GetMessagesParams {
  inboxId: string;
  offset: number | string | undefined;
  pageSize: number;
}

export interface WidgetMeta {
  graphTitle: string;
  fieldStack: string;
  onColumns: string[];
  byColumn: string;
  includeZero: boolean;
}

const graphCategories = [
  "single",
  "multi",
  "count",
  "stacked",
  "candlestick",
] as const;
export type GraphCategory = (typeof graphCategories)[number];

const graphStyles = [
  "simple_widget",
  "area",
  "bar",
  "column",
  "stackedBar",
  "stackedColumn",
  "line",
  "doughnut",
  "pie",
  "candlestick",
] as const;
export type GraphStyle = (typeof graphStyles)[number];

// Get Inbox Messages

// TODO add description about inclusive and offset
export interface GetMessagesRequest {
  pageSize: number;
  inclusive?: boolean;
  offset?: string;
}
export type GetMessagesResponse = KSDKMessage[];

// Send Direct Message

/**
 * Either "message" or "media" is mandatory
 */
interface SendMessagePayload {
  id: string;
  type: "inform";
  message?: string;
  targetAudience?: KSDKTargetAudience;
  media?: KSDKMedia[];
}

// export type SendMessageRequest = RequireAtLeastOne<SendMessagePayload, "message" | "media">;

export type SendMessageResponse = KSDKMessage;

// Submit "Ask a Person" step

export type SubmitMessageRequest = KSDKFormResponse;

export type SubmitMessageResponse = KSDKMessage;

// Get Message

export type GetMessageResponse = KSDKMessage;

// Get Executions

// TODO add description about inclusive and offset
export interface GetExecutionsRequest {
  pageSize: number;
  offset?: string;
  inclusive?: boolean;
  searchString?: string;
  target?: "active" | "attentionRequired";
}

// TODO explain invalidOffset
export interface GetExecutionsResponse {
  executions: KSDKExecution[];
  invalidOffset: boolean;
}

// Get Workspaces List

export interface GetWorkspacesResponse {
  workspaces: Workspace[];
  unauthorizedWorkspaces: UnauthorizedWorkspace[];
}

// Get Workspace Details

export type GetWorkspaceResponse = Workspace;

// Get Conversations List

export interface GetConversationsResponse {
  conversations: ConversationMeta[];
  hasContextVariables: boolean;
  isNlpSearchAllowed: boolean;
}

// Get Conversation

export type GetConversationResponse = Conversation;

// Submit Conversation

export type SubmitConversationRequest = KSDKFormResponse;

export type SubmitConversationResponse = KSDKMessage;

// Get Recent Chats

export type GetRecentChatsResponse = UserAccount[];

// Add User to Recent Chat

export type AddToRecentChatRequest = UserAccount;

export type AddToRecentChatResponse = UserAccount;

// Get User Accounts

export interface GetUserAccountsRequest {
  limit?: number;
  search?: string;
}

export type GetUserAccountsResponse = UserAccount[];

// Get User Account

export type GetUserAccountResponse = UserAccount;

// Get User Preferences

export type GetUserPreferencesResponse = UserPreferences;

// Update User Preferences

export type UpdatePreferencesRequest = { [key: string]: any };

// Get EULA Status

export interface GetEULAStatusResponse {
  showBanner: boolean;
  enforceUserAfterUpdate: boolean;
  acceptedEulaId: string;
  pendingEulaId?: string;
}

// Get Workspace EULA

export interface GetWorkspaceEULAResponse {
  id: string;
  version: number;
  content: string;
  author: {
    name: string;
  };
}

// Get EULA

export interface GetEULAResponse {
  id: string;
  version: number;
  content: string;
  author: {
    name: string;
  };
}

// Create Widget

export interface CreateWidgetRequest {
  message: KSDKMessage;
  widgetMeta: WidgetMeta;
  graphStyle: GraphStyle;
  graphCategory?: GraphCategory;
}

export type CreateWidgetResponse = DashboardWidget;

// Update Widget

export interface UpdateWidgetRequest {
  inputFormResponse: KSDKFormResponse;
  widgetMeta: WidgetMeta;
}

// Clone Widget

export interface CloneWidgetRequest {
  title: string;
}

export type CloneWidgetResponse = DashboardWidget;

// Get Widget

export type GetWidgetResponse = DashboardWidget;

// Get Dashboard

export interface GetDashboardRequest {
  forceReload?: boolean;
}

export interface GetDashboardResponse {
  widgets: DashboardWidget[];
  layout: DashboardLayout[];
}

// Update Dashboard Layout

export interface UpdateDashboardRequest {
  layout: DashboardLayout[];
}

// Get Context variables

export type GetContextVariablesResponse = ContextVariable[];

// Date Context Variables

/**
 * ids - comma separated IDs
 */
export interface DeleteContextVariablesRequest {
  ids?: string;
}

// Update Profile

export interface UpdateProfileRequest {
  icon: string;
}

// Get Topic Summary

export interface GetTopicSummaryResponse {
  unreadMessages: number;
  activeConversations: number;
  attentionNeeded: number;
}

// NLP Conversations Search

export interface NLPConversationsSearchRequest {
  message: string;
}

export interface NLPConversationsSearchResponse {
  matchingConversations: ConversationMetaNLP[];
  winningConversation?: ConversationMetaNLP;
}

// Resolve NLP Text

export interface ResolveNLPTextRequest {
  message: string;
}

// TODO verify for all fields
export interface ResolveNLPTextResponse {
  field: KSDKFormField;
  descriptions: string[];
  type: number;
  optional: boolean;
  skipped: boolean;
  bestMatchPhrase: string;
  bestMatchContent: string;
  pickOneOptions?: string[];
}

// NLP Workspace Search

export interface NLPWorkspaceSearchRequest {
  message: string;
}

export interface NLPWorkspaceSearchResponse {
  matchingConversations: ConversationMetaNLP[];
  winningConversation?: ConversationMetaNLP;
}
