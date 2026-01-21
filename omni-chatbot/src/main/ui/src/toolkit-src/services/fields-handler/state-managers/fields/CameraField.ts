import i18next from "i18next";
import { FieldTypes } from "../FieldTypes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { CameraValue } from "../field-values/CameraValue";
import { FileFieldAttributes } from "../field-attributes/FileFieldAttributes";
import { CameraFieldJson } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class CameraField extends KristaTypeField<
  FileFieldAttributes,
  CameraValue
> {
  private isUploadingFiles = false;

  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.CAMERA_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): FileFieldAttributes {
    return new FileFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: CameraFieldJson): CameraValue {
    return new CameraValue(rawValue);
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
