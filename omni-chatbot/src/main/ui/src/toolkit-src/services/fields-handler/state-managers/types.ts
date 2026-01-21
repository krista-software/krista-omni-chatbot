export interface DateRangeJson {
  type?: "com.krista.net.model.fieldschemas.DateRange"; // TODO delete?
  from: number;
  to: number;
}

export interface EntityTypeJson {
  type: "EntityType"; // TODO delete?
  entityId: string;
  entityName: string;
  registry: {
    invokerId: string;
    catalogId: string;
    ecosystemId: string;
    domainId: string;
  };
}

export type GenericObject = { [key: string]: any };

export interface EntityDefinitionJson {
  type: "EntityDefinition"; // TODO delete?
  name: string;
  entityType: EntityTypeJson;
  options: GenericObject;
  fields: NamedFieldJson[];
}

export interface EntityMetaJson {
  entityType?: EntityTypeJson;
  primaryKey?: string;
}

export interface ValueJson {
  [key: string]: any;
}

export interface EntityValueJson {
  fields: ValueJson;
  meta: EntityMetaJson;
  textSummary?: string;
}

export interface CameraFieldJson {
  mediaId: string;
  filename: string;
  length: number;
  width: number;
  height: number;
  blurImageStr: string;
}

export interface LocationValueJson {
  type?: "com.krista.net.model.fieldschemas.Location"; // TODO delete?
  latitude: number;
  longitude: number;
  dateTime?: number;
  address?: string;
  city?: string;
  country?: string;
  zip?: string;
  area?: string;
  state?: string;
}

export interface PhoneNumberJson {
  countryCode: number;
  nationalNumber: number;
}

export interface NamedFieldJson {
  name: string;
  fieldType: string;
  attributeValues: GenericObject;
  options: GenericObject;
  value?: any;
}

export interface FieldOptionsJson {
  value: any;
  fieldType: string;
}

export interface FileValueJson {
  fileName: string;
  mediaId: string;
  length: number;
  height?: number;
  width?: number;
  blurImage?: string;
}

//stream types
export type StreamContentTypes = 'text';
export type StreamContent = { content: string; contentType: StreamContentTypes; }
export type StreamEvent = { streamId: string, eventId: string, content: StreamContent, timestamp: string }

export interface StreamValueJson {
  streamId: string,
  firstEvent: StreamEvent;
  finished: boolean
}
//end stream types

export type fieldVisualWidth = "s" | "m" | "l";
