import hashlib
from aiohttp import web
import aiohttp

from functools import lru_cache
import os
import folder_paths
import server
import pprint

@lru_cache(maxsize=20)
def compute_hash(model_path: str):
    with open(model_path, "rb") as model_file:
        make_hash = hashlib.sha256()
        make_hash.update(model_file.read())
        digest = make_hash.digest().hex()[:10]
        return digest

async def RK_Nodes_CivitAI_QueryModelInfo(model_hash: str) :
    async with aiohttp.ClientSession() as session:
        async with session.get(f'https://civitai.com/api/v1/model-versions/by-hash/{model_hash}') as response:
            return await response.json()

@server.PromptServer.instance.routes.post("/RK_Nodes/get_model_info")
async def RK_Nodes_CivitAI_get_model_info(request: web.Request):
    '''Find the given model file in the configured file paths and compute the sha256 for it.
    @param request {name: str}
    @returns response {sha256: str}
    '''
    query = await request.json()

    if not "name" in query:
        return web.Response(status=404, reason="missing name in request")

    try:
        name = os.path.normpath(query["name"].strip())

        for directory in folder_paths.folder_names_and_paths.keys() :
            model_path = folder_paths.get_full_path(directory, name)
            if model_path is None :
                continue

            model_path = os.path.normpath(model_path)

            hash = compute_hash(model_path)
            print(name, hash)
            if hash:
                info = await RK_Nodes_CivitAI_QueryModelInfo(hash)
                return web.json_response(info)
            else:
                return web.Response(status=404, reason=f'failed to generate a file hash.')
        
        return web.Response(status=404, reason=f"failed to find a model for '{name}'.")
    except Exception as ex:
        return web.Response(status=404, reason=str(ex))
