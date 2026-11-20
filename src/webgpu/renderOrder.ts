/** The default Unity queue of a transparent lilToon shader ("Queue" = "Transparent"). */
export const LILTOON_TRANSPARENT_QUEUE = 3000;

/** A mesh that another loader ordered: its Unity render queue and the `renderOrder` it got. */
export interface RenderOrderAnchor {
	queue: number;
	renderOrder: number;
}

/**
 * The `renderOrder` of a transparent mesh with a Unity render queue.
 *
 * Without anchors it is `queue - 2981`, the scheme of three-vrm 3.5.5 MToonMaterialLoaderPlugin._parseRenderOrder
 * for a VRM 1 transparent material (queue 3000 + offset gives 19 + offset). So queue 3000 gives 19, as a default
 * MToon transparent mesh.
 *
 * With anchors (the MToon meshes of the same file), the order goes between the anchors by queue. A queue equal to an
 * anchor queue gets its order. A queue between two anchors gets an order between theirs, in proportion to the queue.
 * A queue below or above all anchors gets an order less than 1 below the lowest or above the highest. Three-vrm
 * gives VRM 0 queues consecutive orders by rank, so the result is often a fraction; `renderOrder` sorts as a number.
 */
export function lilToonRenderOrder(
	queue: number,
	anchors: readonly RenderOrderAnchor[] = [],
): number {
	if (anchors.length === 0) return queue - 2981;
	const equal = anchors.filter((anchor) => anchor.queue === queue);
	if (equal.length > 0)
		return Math.max(...equal.map((anchor) => anchor.renderOrder));
	const below = anchors.filter((anchor) => anchor.queue < queue);
	const above = anchors.filter((anchor) => anchor.queue > queue);
	// 1 / (1 + gap) is in (0, 1) and gets smaller as the queue goes away from the anchor.
	const near = (gap: number) => 1 / (1 + Math.max(gap, 0));
	if (below.length > 0) {
		const low = Math.max(...below.map((anchor) => anchor.renderOrder));
		const lowQueue = Math.max(...below.map((anchor) => anchor.queue));
		if (above.length > 0) {
			const high = Math.min(...above.map((anchor) => anchor.renderOrder));
			const highQueue = Math.min(...above.map((anchor) => anchor.queue));
			if (low < high)
				return (
					low + ((high - low) * (queue - lowQueue)) / (highQueue - lowQueue)
				);
		}
		// Above all anchors, or anchors whose orders do not follow their queues: draw after the lower queues.
		return low + 1 - near(queue - lowQueue);
	}
	const high = Math.min(...above.map((anchor) => anchor.renderOrder));
	const highQueue = Math.min(...above.map((anchor) => anchor.queue));
	return high - 1 + near(highQueue - queue);
}
