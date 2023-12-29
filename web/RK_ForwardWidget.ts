import { IWidget, widgetTypes } from "/types/litegraph";

/** A widget that reacts on setting its value property.
 */
export class RK_ForwardWidget implements IWidget {
	name: string;
	type: widgetTypes;
	options?: any;
	_value: any;
	_action: (v: any) => void;

	/** Construct a widget that executes a function when someone sets it's value property.
	 *
	 * @param name The widget's name.
	 * @param value The initial value for the widget.
	 * @param action The action to perform when someone sets the value.
	 */
	constructor(name: string, value: any, action: (v: string | number) => void) {
		this.name = name;
		this._value = value;
		this._action = action;
	}

	set value(value: any) {
		this._value = value;
		this._action(this._value);
	}

	get value(): any {
		return this._value;
	}
}
