// Section configs are free-form JSON edited through forms generated from `fields`.
export type Cfg = Record<string, any>;

export type Site = {
  id: string;
  slug: string;
  name: string;
  hostnames: string[];
  config: Cfg;
  template: { tokens: Record<string, string>; css: string | null };
};

export type ModuleProps = { c: Cfg; site: Site };
