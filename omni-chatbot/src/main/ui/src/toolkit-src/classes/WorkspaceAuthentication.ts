export class WorkspaceAuthentication {
  constructor(public readonly type: string, public readonly oAuthUrl: string) {}

  static fromJSON(json: any): WorkspaceAuthentication {
    return new WorkspaceAuthentication(json["type"], json["oAuthUrl"]);
  }
}
