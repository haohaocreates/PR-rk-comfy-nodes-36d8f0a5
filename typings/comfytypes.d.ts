import { INodeInputSlot, IWidget, LGraphNode, Vector2 } from "/types/litegraph";

// This should really come from ComfyUI, but, alas, no change. So, I define the types to
// the best of my knowledge...

export interface ComfyWidget {
    name: string,
    config: any[]
}

export interface ComfyNodeInputSlot extends INodeInputSlot {
    widget: ComfyWidget
}

export interface ComfyNode extends LGraphNode {
    inputs: ComfyNodeInputSlot[],
    widgets: IWidget<any, any>[];
	isVirtualNode: boolean;
    class_type: string;
    comfyClass: string;
    onExecuted(detail: any): void;
    setSize(size: Vector2): void;
}
