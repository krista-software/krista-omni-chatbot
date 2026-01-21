const storage = ["local", "session"] as const;
export type StorageType = (typeof storage)[number];
const isValidKey = (key: string) => {
  return key !== "";
};
const getStorage = (type: string) => {
  return type === "local" ? window.localStorage : window.sessionStorage;
};
export class KristaStorage extends Storage {

  public static getValue(
    key: string,
    storage: StorageType = "local"
  ): string | null {
    if (isValidKey(key)) {
      const _storage = getStorage(storage);
      return _storage.getItem(key);
    } else {
      throw new Error("Invalid key");
    }
  }
  public static setValue(
    key: string,
    value: string,
    storage: StorageType = "local"
  ): void {
    if (isValidKey(key)) {
      const _storage = getStorage(storage);
      _storage.setItem(key, value);
    } else {
      throw new Error("Invalid key");
    }
  }

  public static getValueAsObject(
    key: string,
    storage: StorageType = "local"
  ): any {
    if (isValidKey(key)) {
      const _storage = getStorage(storage);
      try {
        let value = _storage.getItem(key);
        if (value) {
          value = JSON.parse(window.atob(value));
        }
        return value;
      } catch (e) {
        throw new Error("Invalid value");
      }
    } else {
      throw new Error("Invalid key");
    }
  }
  public static setValueAsObject(
    key: string,
    value: any,
    storage: StorageType = "local"
  ): any {
    if (isValidKey(key)) {
      try {
        const _storage = getStorage(storage);
        if (value) {
          _storage.setItem(key, window.btoa(JSON.stringify(value)));
        } else {
          _storage.removeItem(key);
        }
      } catch (e) {
        throw new Error("Invalid value");
      }
    } else {
      throw new Error("Invalid key");
    }
  }

  public static removeItem(key: string, storage: StorageType = "local") {
    if (isValidKey(key)) {
      const _storage = getStorage(storage);
      _storage.removeItem(key);
    } else {
      throw new Error("Invalid key");
    }
  }

  public static clear(storage: StorageType = "local") {
    const _storage = getStorage(storage);
    _storage.clear();
  }
}

export default KristaStorage;
