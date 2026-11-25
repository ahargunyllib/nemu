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
  }
}
