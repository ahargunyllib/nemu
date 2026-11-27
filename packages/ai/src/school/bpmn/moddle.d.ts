// bpmn-moddle ships types only under "bpmn-moddle/types"; this is the slice Nemu uses.
declare module "bpmn-moddle" {
  export type ModdleElement = {
    $type: string;
    id?: string;
    name?: string;
    $attrs?: Record<string, string>;
    $children?: ModdleElement[];
    [key: string]: unknown;
  };
  export type FromXmlResult = {
    rootElement: ModdleElement;
    warnings: Array<{ message: string }>;
  };
  export class BpmnModdle {
    constructor(packages?: Record<string, unknown>);
    fromXML(xml: string, typeName?: string): Promise<FromXmlResult>;
    create(type: string, attrs?: Record<string, unknown>): ModdleElement;
    toXML(element: ModdleElement, options?: { format?: boolean }): Promise<{ xml: string }>;
  }
}

declare module "bpmn-auto-layout" {
  /** Adds BPMN DI (shapes and edges) to a diagram that has none. */
  export function layoutProcess(xml: string): Promise<string>;
}
