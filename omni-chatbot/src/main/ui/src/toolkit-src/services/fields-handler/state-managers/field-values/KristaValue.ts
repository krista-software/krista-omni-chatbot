import { v4 as uuidv4 } from "uuid";

export abstract class KristaValue {
  public readonly objectId = uuidv4();

  public abstract getValue(): any;

  public abstract toResponse(): any;

  public abstract equals(value: KristaValue): boolean;

  public abstract toString(): string;
}
