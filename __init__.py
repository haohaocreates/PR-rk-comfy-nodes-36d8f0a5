from .nodes.RK_CivitAINodes import RK_CivitAIMetaChecker
from .nodes.RK_CivitAINodes import RK_CivitAIAddHashes

NODE_CLASS_MAPPINGS = {
    "RK_CivitAIMetaChecker": RK_CivitAIMetaChecker,
    "RK_CivitAIAddHashes": RK_CivitAIAddHashes,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RK_CivitAIMetaChecker": "CivitAI Meta Checker",
    "RK_CivitAIAddHashes": "CivitAI Add Model Hashes",
}

WEB_DIRECTORY = "dist"
