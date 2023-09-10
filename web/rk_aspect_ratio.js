import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import {forwardOutputValues } from "../core/utilities.js"

export class RK_AspectRatio {
  constructor() {
    this.parameters = {
      longest_side: ComfyWidgets.INT(
        this,
        "longest_side",
        ["INT", { default: 1024, min: 128, max: 4096, step: 16 }],
        app
      ).widget,
      ratio: ComfyWidgets.COMBO(
        this,
        "ratio",
        [["1:1", "1:2", "3:4", "2:5", "3:5", "4:5", "9:16"], { default: "3:5" }],
        app
      ).widget,
      swap: ComfyWidgets.COMBO(
        this,
        "swap",
        [["min:max", "max:min"], { default: "min:max" }],
        app
      ).widget,
      info: ComfyWidgets.STRING(this, "", ["", { default: "", multiline: true }], app).widget,
    };

    this.addOutput("width", "INT", 1024);
    this.addOutput("height", "INT", 1024);

    this.#setCallback(this.parameters.longest_side);
    this.#setCallback(this.parameters.ratio);
    this.#setCallback(this.parameters.swap);

    this.serialize_widgets = true;
    this.isVirtualNode = true;

    this.#computeOutputs();
  }

  onConfigure(into) {
    this.#computeOutputs();
  }

  applyToGraph() {
    this.#computeOutputs();
    forwardOutputValues(this, (output) => output.value);
  }

  #computeOutputs() {
    var longest_side = Number(this.parameters.longest_side.value);
    const ratio = this.parameters.ratio.value.split(":").map((t) => Number(t));
    let other_side = Math.trunc((longest_side * ratio[0]) / ratio[1]);
    other_side = other_side + (other_side % 2);

    if (this.parameters.swap.value == "max:min") {
      const v = longest_side;
      longest_side = other_side;
      other_side = v;
    }
    
    this.outputs[0].value = other_side; // height
    this.outputs[1].value = longest_side; // width

    this.parameters.info.value = `${other_side} x ${longest_side}`;
  }

  #setCallback(widget) {
    const widget_callback = widget.callback;
    const self = this;
    widget.callback = function () {
      const result = widget_callback ? widget_callback.apply(this, arguments) : undefined;
      self.applyToGraph();
      return result;
    };
  }
}
