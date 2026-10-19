export const META_LOGIN = Symbol("META_LOGIN");

export interface MetaLogin {
  configured(): boolean;
  dialogUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<string>;
}
