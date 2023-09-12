//type ComfyNumber = ComfyNode | number;
function getNumberValue(input) {
  if (typeof input === "number") return input;
  return input.inputs.Value;
}

/* // #region [types]
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

type AdditionalResource = {
  name: string;
  type: string;
  strength: number;
  strengthClip: number;
};
 */

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

function modelFileName(name) {
  const sep_expr = /\\(\\\\)*/g;
  name = name.replace(sep_expr, "/");
  const parts = name.split("/");
  return parts[parts.length - 1];
}

const AIR_KEYS = ["ckpt_airs", "lora_airs", "embedding_airs"];

export const comfyMetadataProcessor = {
  canParse: (exif) => exif.prompt && exif.workflow,
  parse: (exif) => {
    //const prompt = JSON.parse(exif.prompt);
    const prompt = exif.prompt;
    const samplerNodes = [];
    const models = [];
    const upscalers = [];
    const vaes = [];
    const controlNets = [];
    const additionalResources = [];
    const hashes = {};

    for (const node of Object.values(prompt)) {
      for (const [key, value] of Object.entries(node.inputs)) {
        if (Array.isArray(value)) node.inputs[key] = prompt[value[0]];
      }

      if (node.class_type == "KSamplerAdvanced") {
        const simplifiedNode = asSamplerNode(node);

        simplifiedNode.steps = getNumberValue(simplifiedNode.steps);
        simplifiedNode.cfg = getNumberValue(simplifiedNode.cfg);

        samplerNodes.push(simplifiedNode);
      }

      if (node.class_type == "KSampler") samplerNodes.push(asSamplerNode(node));

      if (node.class_type == "LoraLoader") {
        // Ignore lora nodes with strength 0
        const strength = node.inputs.strength_model;
        if (strength < 0.001 && strength > -0.001) continue;

        const lora_name = modelFileName(node.inputs.lora_name);
        hashes[`lora:${lora_name}`] = node.lora_hash;

        additionalResources.push({
          name: lora_name,
          type: "lora",
          strength,
          strengthClip: node.inputs.strength_clip,
          hash: node.lora_hash,
        });
      }

      if (node.class_type == "CheckpointLoaderSimple") {
        const model_name = modelFileName(node.inputs.ckpt_name);
        models.push(model_name);
        if (!hashes.model) hashes.model = node.ckpt_hash;

        additionalResources.push({ type: "model", name: model_name, hash: node.ckpt_hash });
      }

      if (node.class_type == "UpscaleModelLoader") upscalers.push(node.inputs.model_name);

      if (node.class_type == "VAELoader") vaes.push(node.inputs.vae_name);

      if (node.class_type == "ControlNetLoader") controlNets.push(node.inputs.control_net_name);
    }

    const initialSamplerNode =
      samplerNodes.find((x) => x.latent_image.class_type == "EmptyLatentImage") ?? samplerNodes[0];

    //const workflow = JSON.parse(exif.workflow);
    const workflow = exif.workflow;
    const versionIds = [];
    const modelIds = [];
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

    const metadata = {
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
      resources: additionalResources,
      controlNets,
      versionIds,
      modelIds,
      comfy: {
        prompt,
        workflow,
      },
    };

    // Handle control net apply
    if (initialSamplerNode.positive.class_type === "ControlNetApply") {
      const conditioningNode = initialSamplerNode.positive.inputs.conditioning;
      metadata.prompt = conditioningNode.inputs.text;
    }

    return metadata;
  },
  encode: ({ comfy }) => {
    return JSON.stringify(comfy.workflow);
  },
};
