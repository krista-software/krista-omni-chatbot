import { v4 as uuidv4 } from "uuid";

export function isDefined(actual: any): boolean {
  return actual !== undefined && actual !== null;
}

export function compareNumber(v1: number, v2: number): number {
  return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
}

export function lastElement<T>(array: Array<T>): T | undefined {
  if (!array || array.length === 0) {
    return undefined;
  }
  return array[array.length - 1];
}

export function firstElement<T>(array: Array<T>): T | undefined {
  if (!array || array.length === 0) {
    return undefined;
  }
  return array[0];
}

export function newGuid(): string {
  return uuidv4();
}

export function consoleLog(...args: any[]) {
  // @ts-ignore
  // console.log.apply(this, args);
}
