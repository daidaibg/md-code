import type MarkdownIt from 'markdown-it';

export interface MarkdownPlugin {
  name: string;
  setup: (markdown: MarkdownIt) => void;
  enabled?: boolean;
}

export class MarkdownPluginRegistry {
  private readonly plugins = new Map<string, MarkdownPlugin>();

  register(plugin: MarkdownPlugin): this {
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  install(markdown: MarkdownIt): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled !== false) plugin.setup(markdown);
    }
  }

  list(): readonly MarkdownPlugin[] {
    return [...this.plugins.values()];
  }
}
