import pprint
import folder_paths
import hashlib
import os

from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key):
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        return None

    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        elif len(self.cache) >= self.capacity:
            self.cache.popitem(last=False)
        self.cache[key] = value


class RK_CivitAIMetaChecker:
    '''Parse the prompt (image meta-data) and verify that CivitAI might find the
    expected information on parameters and used resources.'''

    @classmethod
    def INPUT_TYPES(self):
        return {"required": {"image": ("IMAGE", )},
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"}
                }

    RETURN_TYPES = ()

    FUNCTION = "execute"

    OUTPUT_NODE = True
    CATEGORY = "RK_Nodes/image"

    def execute(self, image, prompt=None, extra_pnginfo=None):
        return {"ui": {"prompt": [prompt], "extra_pnginfo": [extra_pnginfo]}}


class RK_CivitAIAddHashes:
    '''Parse the prompt (image meta-data) and add model hashes for various models.
       We're looking for input widgets with specific names and will examine the model
       files to generate the hashes.'''

    @classmethod
    def INPUT_TYPES(self):
        return {"required": {"image": ("IMAGE",)},
                "hidden": {"prompt": "PROMPT"}
                }

    RETURN_TYPES = ("IMAGE",)

    FUNCTION = "execute"

    OUTPUT_NODE = True
    CATEGORY = "RK_Nodes/image"

    _SHA_CACHE = LRUCache(10)

    def execute(self, image, prompt: dict = None):
        for id, node in prompt.items():
            try:
                self._visitNode(node)
            except:
                pass

        return (image, {"prompt": prompt})

    def _visitNode(self, node: dict) -> dict:
        MODEL_PARAMETERS = {"ckpt_name": "checkpoints",
                            "lora_name": "loras", "vae_name": "vae"}

        if not "inputs" in node or not isinstance(node["inputs"], dict):
            return

        for parameter, value in node["inputs"].items():
            if parameter in MODEL_PARAMETERS.keys():
                model_path = os.path.normpath(
                    folder_paths.get_full_path(MODEL_PARAMETERS[parameter], value))

                digest = self._SHA_CACHE.get(model_path)
                if digest is None:
                    digest = self._computeFileSha(model_path)
                    self._SHA_CACHE.put(model_path, digest)

                hash_key = str(parameter).replace("_name", "_hash")
                print(f"{model_path}: assign sha256 {digest} as {hash_key}")
                node.update({hash_key: digest})

    @staticmethod
    def _computeFileSha(model_path: str) -> str:
        with open(model_path, "rb") as model_file:
            make_hash = hashlib.sha256()
            make_hash.update(model_file.read())
            digest = make_hash.digest().hex()[:10]
            return digest
