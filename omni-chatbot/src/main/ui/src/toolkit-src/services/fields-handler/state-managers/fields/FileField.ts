import i18next from "i18next";
import { FieldTypes } from "../FieldTypes";
import { FileValue } from "../field-values/FileValue";
import { FileFieldAttributes } from "../field-attributes/FileFieldAttributes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FileValueJson } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class FileField extends KristaTypeField<FileFieldAttributes, FileValue> {
  private isUploadingFiles = false;

  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.FILE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): FileFieldAttributes {
    return new FileFieldAttributes(_attributes);
  }

  protected createKristaValue(value: FileValueJson[]): FileValue {
    let correctedValue = value;
    if (value) {
      correctedValue = Array.isArray(value) ? value : [value];
    }
    return new FileValue(correctedValue);
  }

  setUploadingStatus(isUploading: boolean) {
    this.isUploadingFiles = isUploading;
  }

  public validate(): boolean {
    if (this.isUploadingFiles) {
      this.validators.errors = [i18next.t("krista.file.uploadInProgress")];
      this.validators.isValid = false;
      this.dispatchData();
      return this.isValid;
    }
    return super.validate();
  }
}
