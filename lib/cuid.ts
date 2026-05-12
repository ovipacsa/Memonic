import { nanoid } from "nanoid";

export function id(): string {
  return nanoid(16);
}
