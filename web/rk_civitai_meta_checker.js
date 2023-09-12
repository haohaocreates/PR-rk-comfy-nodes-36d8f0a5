import { comfyMetadataProcessor } from "./civitai_parser.js";
import { ComfyWidgets } from "../../scripts/widgets.js"

export const CivitAIMetaChecker = {
    onExecuted(detail) {
        const exif = { prompt: detail.prompt[0], workflow: detail.extra_pnginfo[0]};
        const metadata = { ...comfyMetadataProcessor.parse(exif), comfy: undefined };
        
        if (!this.widgets || this.widgets.length == 0)
            ComfyWidgets.STRING(this, "text", ["text", { default: "", multiline: true}], app);

        var widget = this.widgets[0];
        widget.value = JSON.stringify(metadata, null, 2);
    }
};