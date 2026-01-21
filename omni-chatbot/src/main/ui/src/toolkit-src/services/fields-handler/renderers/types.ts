import { CancelTokenSource } from "axios";
import { Priorities } from "../Priorities";
import { KristaFieldAttributes } from "../state-managers";
import { KristaValue } from "../state-managers";
import { KristaTypeField } from "../state-managers";
import { EntitySearchResultProps } from "../../../api";
import { EntitySearchDto } from "./react";
import { MessageType } from "../../messaging";

export type FieldOptions = {
  readOnly?: boolean;
  hideLabel?: boolean;
  getEntities?(data: { payload: EntitySearchDto; timeout?: number }): {
    cancelToken: CancelTokenSource;
    axiosPromise: Promise<EntitySearchResultProps>;
  };
  messageType?: MessageType;
  autoFocus?: boolean;
  onEnter?: () => void;
};

export type ReactFieldRenderer = {
  (props: {
    kristaTypeField: KristaTypeField<KristaFieldAttributes, KristaValue>;
    options?: FieldOptions;
  }): JSX.Element;
  getPriority: (
    field: KristaTypeField<KristaFieldAttributes, KristaValue>
  ) => Priorities;
};

export type UITechnology = "react";
