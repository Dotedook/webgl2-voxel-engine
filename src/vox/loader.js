import { loadMagicaVoxel } from './magicavoxel.js'

export async function loadVoxModel(voxUrl) {
	if (typeof window.__VOX_LOADER__ === 'function') {
		return window.__VOX_LOADER__(voxUrl)
	}
	return loadMagicaVoxel(voxUrl)
}

