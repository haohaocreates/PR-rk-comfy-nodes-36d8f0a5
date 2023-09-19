import { LGraphNode } from "g:/github/ComfyUI/web/types/litegraph";

// This should really come from ComfyUI, but, alas, no change. So, I define the types to
// the best of my knowledge...

export interface ComfyNode extends LGraphNode {
	isVirtualNode: boolean;
    class_type: string;
    comfyClass: string;
    onExecuted(detail: any): void;
}
