import { KristaId } from "../../../toolkit-src";
import KristaStorage from "./KristaStorage";

const LOGIN_TIME = "loginTime";
const CLIENT_SESSION_ID = "clientSessionId";
const KRISTA_ACCOUNT_ID = "kristaAccountId";
const MY_ACCOUNT_ID = "myAccountId";
const PERSON_ID = "personId";
const NAME = "name";
const LOGIN_DETAILS = "loginDetails";

export class PrefStorage {

  private static generateKey(
    keyId: string,
    pref: string = "pref",
    type: string = "device"
  ): string {
    return `${pref}/${type}/${keyId}`;
  }

  public static getLoginTime(): null | number {
    let time = null;
    const logTime = KristaStorage.getValue(this.generateKey(LOGIN_TIME));
    if (logTime) {
      time = parseInt(logTime, 10);
    }
    return time;
  }

  public static setLoginTime(time: number): void {
    KristaStorage.setValue(
      this.generateKey(LOGIN_TIME),
      Number(time).toString()
    );
  }

  public static getClientSessionId(): string | undefined {
    const id = KristaStorage.getValue(this.generateKey(CLIENT_SESSION_ID));
    if (!id) {
      return undefined;
    }
    return id;
  }

  public static getKristaAccountId(): KristaId | undefined {
    const id = KristaStorage.getValue(this.generateKey(KRISTA_ACCOUNT_ID));
    if (!id) {
      return undefined;
    }
    return KristaId.parse(id);
  }

  public static setClientSessionId(sessionId: string): void {
    KristaStorage.setValue(this.generateKey(CLIENT_SESSION_ID), sessionId);
  }

  public static setKristaAccountId(kristaAccountId: string): void {
    KristaStorage.setValue(
      this.generateKey(KRISTA_ACCOUNT_ID),
      kristaAccountId
    );
  }

  static setMyContactId(myAccountId: string) {
    KristaStorage.setValue(this.generateKey(MY_ACCOUNT_ID), myAccountId);
  }

  static setPersonId(personId: string) {
    KristaStorage.setValue(this.generateKey(PERSON_ID), personId);
  }

  static setName(name: string) {
    KristaStorage.setValue(this.generateKey(NAME), name);
  }

  static getMyContactId(): KristaId {
    const id = KristaStorage.getValue(this.generateKey(MY_ACCOUNT_ID));
    if (!id) {
      throw new Error("Ws contact id can not be null");
    }
    return KristaId.parse(id);
  }

  static getPersonId(): KristaId {
    const id = KristaStorage.getValue(this.generateKey(PERSON_ID));
    if (!id) {
      throw new Error("PERSON_ID id can not be null");
    }
    return KristaId.parse(id);
  }

  static getName() {
    return KristaStorage.getValue(this.generateKey(NAME)) || "";
  }

  public static getSessionDetails(): {
    clientSessionId: string | undefined;
    loginTime: number | null;
  } {
    const sessionDetails = {
      clientSessionId: this.getClientSessionId(),
      loginTime: this.getLoginTime(),
    };

    return sessionDetails;
  }

  public static getLoggedInDetails(): any {
    let loggedInDetails = null;
    try {
      loggedInDetails = KristaStorage.getValueAsObject(
        this.generateKey(LOGIN_DETAILS)
      );
    } catch (e) {}
    return loggedInDetails;
  }

  public static setLoggedInDetails(value: any): void {
    KristaStorage.setValueAsObject(this.generateKey(LOGIN_DETAILS), value);
    this.setClientSessionId(value?.clientSessionId);
    this.setKristaAccountId(value?.kristaAccountId);
    this.setMyContactId(value?.accountId);
    this.setPersonId(value?.personId);
    this.setName(value?.name);
    this.setLoginTime(Date.now());
  }

  public static logOut(): void {
    KristaStorage.clear();
  }

  static setSelectedLanguage(languageCode: string) {
    KristaStorage.setValue(this.generateKey("chatbotLanguage"), languageCode);
  }

  static getSelectedLanguage(): string {
    return KristaStorage.getValue(this.generateKey("chatbotLanguage")) || "en";
  }
}
