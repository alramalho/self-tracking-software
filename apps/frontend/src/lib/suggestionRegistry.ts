import { SuggestionBase, SuggestionHandler } from "../types/suggestions";

export class SuggestionRegistry {
  private handlers = new Map<string, SuggestionHandler<any>>();

  register<T extends SuggestionBase>(handler: SuggestionHandler<T>) {
    this.handlers.set(handler.type, handler);
  }

  getHandler(type: string): SuggestionHandler<any> | undefined {
    return this.handlers.get(type);
  }

  clear() {
    this.handlers.clear();
  }
}

export const suggestionRegistry = new SuggestionRegistry();
