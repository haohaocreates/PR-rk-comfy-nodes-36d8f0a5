type ComfyNumber = ComfyNode | number;
function getNumberValue(input) {
	if (typeof input === "number") return input;
	return input.inputs.Value;
}

// #region [types]
type ComfyNode = {
	inputs: Record<string, number | string | Array<string | number> | ComfyNode>;
	class_type: string;
};

type SamplerNode = {
	seed: number;
	steps: number;
	cfg: number;
	sampler_name: string;
	scheduler: string;
	denoise: number;
	model: ComfyNode;
	positive: ComfyNode;
	negative: ComfyNode;
	latent_image: ComfyNode;
};

type SDResource = {
	type: string;
	name: string;
	weight?: number;
	weightClip?: number;
	hash?: string;
};

type ImageMetaProps = Record<string, unknown>;

function getPromptText(node) {
	if (!node.inputs) return "";

	/* Getting the prompt text might encounter another node as input (e.g., when linked with some other
     generator node other than a primitive). So, unless we see a raw string, we recursively follow the
     attributes with specific names until we find the first string. */
	function followAttribute(inputs, attributes) {
		if (!inputs) return null;

		if (inputs instanceof String) return inputs;

		const keys = Object.keys(inputs);
		for (const attribute of attributes) {
			if (keys.includes(attribute)) {
				const attribute_value = inputs[attribute];
				if (attribute_value.inputs) return followAttribute(attribute_value.inputs, attributes);
				else return attribute_value;
			}
		}
		return null;
	}

	var prompt = followAttribute(node.inputs, ["text", "value"]);
	if (prompt) return prompt;

	prompt = followAttribute(node.inputs.text_g, ["text_g", "text"]);
	if (prompt) {
		const prompt_l = followAttribute(node.inputs.text_l, ["text_l", "text"]);
		if (!prompt_l || prompt_l === prompt) return prompt;
		else return `${prompt}, ${prompt_l}`;
	}
}

function asSamplerNode(object) {
	return { ...object.inputs };
}

function cleanBadJson(str: string) {
	return str.replace(/\[NaN\]/g, "[]").replace(/\[Infinity\]/g, "[]");
}

function modelFileName(name) {
	const sep_expr = /\\(\\\\)*/g;
	name = name.replace(sep_expr, "/");
	const parts = name.split("/");
	return parts[parts.length - 1];
}

function a1111Compatability(metadata: ImageMetaProps) {}

function findKeyForValue<K, V>(m: Map<K, V[]>, v: V): K | undefined {
	for (const [k, vs] of m) {
		if (vs.includes(v)) return k;
	}
	return undefined;
}
const AIR_KEYS = ["ckpt_airs", "lora_airs", "embedding_airs"];

export const comfyMetadataProcessor = {
	canParse: (exif) => exif.prompt && exif.workflow,
	parse: (exif) => {
		//const prompt = JSON.parse(cleanBadJson(exif.prompt as string)) as Record<string, ComfyNode>;
		const prompt: Record<string,ComfyNode> = exif.prompt;
		const samplerNodes: SamplerNode[] = [];
		const models: string[] = [];
		const upscalers: string[] = [];
		const vaes: string[] = [];
		const controlNets: string[] = [];
		const additionalResources: SDResource[] = [];
		let hashes: Record<string, string> = {};

		for (const node of Object.values(prompt)) {
			for (const [key, value] of Object.entries(node.inputs)) {
				if (Array.isArray(value)) node.inputs[key] = prompt[value[0]];
			}

			if (node.class_type == "CivitAI_AddModelHashes") {
				hashes = (node as any).hashes || {};
			}

			if (node.class_type == "KSamplerAdvanced") {
				const simplifiedNode = { ...node.inputs };

				simplifiedNode.steps = getNumberValue(simplifiedNode.steps as ComfyNumber);
				simplifiedNode.cfg = getNumberValue(simplifiedNode.cfg as ComfyNumber);

				samplerNodes.push(simplifiedNode as SamplerNode);
			}

			if (node.class_type == "KSampler") samplerNodes.push(node.inputs as SamplerNode);

			if (node.class_type == "LoraLoader") {
				// Ignore lora nodes with strength 0
				const strength = node.inputs.strength_model as number;
				if (strength < 0.001 && strength > -0.001) continue;

				const lora_name = modelFileName(node.inputs.lora_name as string);

				additionalResources.push({
					name: lora_name,
					type: "lora",
					weight: strength,
					weightClip: node.inputs.strength_clip as number,
				});
			}

			if (node.class_type == "CheckpointLoaderSimple") {
				const model_name = modelFileName(node.inputs.ckpt_name as string);
				models.push(model_name);

				additionalResources.push({ name: model_name, type: "model" });
			}

			if (node.class_type == "UpscaleModelLoader") upscalers.push(node.inputs.model_name as string);

			if (node.class_type == "VAELoader") vaes.push(node.inputs.vae_name as string);

			if (node.class_type == "ControlNetLoader") controlNets.push(node.inputs.control_net_name as string);
		}

		const initialSamplerNode =
			samplerNodes.find((x) => x.latent_image.class_type == "EmptyLatentImage") ?? samplerNodes[0];

		//const workflow = JSON.parse(exif.workflow as string) as any;
    		const workflow = exif.workflow;
		const versionIds: number[] = [];
		const modelIds: number[] = [];
		if (workflow?.extra) {
			for (const key of AIR_KEYS) {
				const airs = workflow.extra[key];
				if (!airs) continue;

				for (const air of airs) {
					const [modelId, versionId] = air.split("@");
					if (versionId) versionIds.push(parseInt(versionId));
					else if (modelId) modelIds.push(parseInt(modelId));
				}
			}
		}

		const metadata: ImageMetaProps = {
			prompt: getPromptText(initialSamplerNode.positive),
			negativePrompt: getPromptText(initialSamplerNode.negative),
			cfgScale: initialSamplerNode.cfg,
			steps: initialSamplerNode.steps,
			seed: initialSamplerNode.seed,
			sampler: initialSamplerNode.sampler_name,
			scheduler: initialSamplerNode.scheduler,
			denoise: initialSamplerNode.denoise,
			width: initialSamplerNode.latent_image.inputs.width,
			height: initialSamplerNode.latent_image.inputs.height,
			hashes: hashes,
			models,
			upscalers,
			vaes,
			additionalResources,
			controlNets,
			versionIds,
			modelIds,
			// Converting to string to reduce bytes size
			comfy: JSON.stringify({ prompt, workflow }),
		};

		// Paranoia! If all else fails, the meta data lookup also checks these attributes.
		const model_resource = additionalResources.find((resource) => resource.type === "model");
		if (model_resource) {
			metadata["Model"] = model_resource.name;
			metadata["Model hash"] = model_resource.hash;
		}

		// Handle control net apply
		if (initialSamplerNode.positive.class_type === "ControlNetApply") {
			const conditioningNode = initialSamplerNode.positive.inputs.conditioning as ComfyNode;
			metadata.prompt = conditioningNode.inputs.text as string;
		}

		// Map to automatic1111 terms for compatibility
		a1111Compatability(metadata);

		return metadata;
	},
	encode: ({ comfy }) => {
		return JSON.stringify(comfy.workflow);
	},
};
