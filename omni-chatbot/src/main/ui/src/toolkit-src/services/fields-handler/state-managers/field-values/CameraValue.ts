import { KristaValue } from "./KristaValue";
import { CameraFile } from "../classes/CameraFile";
import { CameraFieldJson } from "../types";

export class CameraValue extends KristaValue {
  private readonly camera: CameraFile | undefined = undefined;

  constructor(protected readonly _value?: CameraFieldJson) {
    super();
    if (_value) {
      this.camera = CameraFile.fromJSON(_value);
    }
  }

  getValue(): CameraFile | undefined {
    return this.camera;
  }

  toResponse(): CameraFieldJson | undefined {
    return this.camera?.toJSON();
  }

  equals(/*value: KristaValue*/): boolean {
    return false;
  }

  toString(): string {
    return this.camera ? this.camera.toString() : "";
  }
}
