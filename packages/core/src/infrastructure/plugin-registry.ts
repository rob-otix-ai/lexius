import type { LegislationPlugin, LegislationPluginRegistry } from "../domain/plugin.js";

export class InMemoryPluginRegistry implements LegislationPluginRegistry {
  private readonly plugins = new Map<string, LegislationPlugin>();

  register(plugin: LegislationPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  get(legislationId: string): LegislationPlugin {
    const plugin = this.plugins.get(legislationId);
    if (!plugin) {
      throw new Error(`No plugin registered for legislation: ${legislationId}`);
    }
    return plugin;
  }

  list(): LegislationPlugin[] {
    return Array.from(this.plugins.values());
  }
}
