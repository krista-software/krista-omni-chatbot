import { isDefined } from "../../../../common/utils";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { EntityDefinition } from "./EntityDefinition";
import { EntityType } from "./EntityType";

export class EntitySelectorMeta {
  readonly invokerId: string;
  readonly selectionSize: string;
  readonly isMultiSelect: boolean = false;
  readonly allowDefaultSearch: boolean = false;
  readonly defaultSearchTimeout: number;
  readonly availableFilters: EntitySearchFilter[] = [];
  readonly entityTypeDomain?: EntityType;
  readonly entityDefinition?: EntityDefinition;
  readonly invokeAsUser: boolean;

  constructor(attributes: Map<string, any>) {
    this.invokerId = attributes.get("invokerId");
    this.selectionSize = attributes.get("selectionSize");
    this.allowDefaultSearch = attributes.get("allowDefaultSearch");
    this.defaultSearchTimeout = attributes.get("defaultSearchTimeout");
    this.isMultiSelect = this.selectionSize
      ? this.selectionSize !== "1"
      : false;
    this.entityTypeDomain = EntityType.fromJSON(
      attributes.get("entityTypeDomain")
    );
    this.entityDefinition = EntityDefinition.fromJSON(
      attributes.get("entityDefinition")
    );
    const actualFilters: any[] = attributes.get("filters") || [];
    // Create filters directly from attributes.get("filters") after they are rightly parsed to ksdk.
    if (this.entityDefinition) {
      const _filters: EntitySearchFilter[] = [];
      actualFilters.forEach((filter) => {
        const field = this.entityDefinition!.fields.find(
          (f) => f.name === filter["fieldName"]
        );
        if (field) {
          _filters.push(new EntitySearchFilter(field, filter["timeout"]));
        }
      });
      this.availableFilters = _filters;
    }
    this.invokeAsUser = attributes.get("invokeAsUser") || false;
  }

  getFirstFilter(): EntitySearchFilter | undefined {
    if (this.availableFilters && this.availableFilters.length > 0) {
      return this.availableFilters[0];
    }
    return undefined;
  }

  hasFilter(): boolean {
    return this.availableFilters.length > 0;
  }

  public get hasEntity(): boolean {
    return isDefined(this.entityTypeDomain);
  }

  public get entityName(): string {
    if (this.entityTypeDomain) {
      return this.entityTypeDomain.entityName;
    }
    return "";
  }
}

export class EntitySearchFilter {
  constructor(
    public readonly field: KSDKFormField,
    public readonly timeout?: number
  ) {}

  static fromJSON(json: any): EntitySearchFilter | undefined {
    if (!json) {
      return undefined;
    }

    const filter = KSDKFormField.fromJSON(json["field"]);
    if (!filter) {
      return undefined;
    }
    return new EntitySearchFilter(filter, json["timeout"]);
  }

  static fromJSONArray(jsonArray: any[]): EntitySearchFilter[] {
    if (!jsonArray) {
      return [];
    }
    const filters: EntitySearchFilter[] = [];
    for (const json of jsonArray) {
      const filter = this.fromJSON(json);
      if (filter) {
        filters.push(filter);
      }
    }

    return filters;
  }
}
