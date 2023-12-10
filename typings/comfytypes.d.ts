import { INodeInputSlot, IWidget, LGraphNode, Vector2 } from "/types/litegraph";

// This should really come from ComfyUI, but, alas, no change. So, I define the types to
// the best of my knowledge...

export interface ComfyWidget extends IWidget {
	name: string;
	config: any[];
	afterQueued(): void;
}

export interface ComfyConvertedWidget extends ComfyWidget {
    origType: string;
	origComputeSize(): Vector2;
	origSerializeValue(): void;
}

export interface ComfyNodeInputSlot extends INodeInputSlot {
	widget: ComfyWidget;
}

export interface ComfyNode extends LGraphNode {
	inputs: ComfyNodeInputSlot[];
	widgets: IWidget<any, any>[];
	isVirtualNode: boolean;
	class_type: string;
	comfyClass: string;
	onExecuted(detail: any): void;
	setSize(size: Vector2): void;
	onAfterGraphConfigured?(): void;
	refreshComboInNode?(): void;
}

export type ComfyTracedNode = { node: ComfyNode; config_slot?: number };
